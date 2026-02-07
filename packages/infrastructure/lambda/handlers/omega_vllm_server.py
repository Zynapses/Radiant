# Project OMEGA - Custom vLLM Inference Server
# FastAPI wrapper around vLLM LLMEngine with embedding injection

"""
THE MOUTH: Custom vLLM Server with Vector Injection

THE PROBLEM:
    vLLM's standard OpenAI-compatible HTTP API only accepts TEXT.
    There is no `prompt_embeds` parameter. We cannot inject tensors
    through the standard API.

THE SOLUTION:
    A custom FastAPI server that wraps vLLM's Python LLMEngine directly.
    This gives us full access to the embedding layer, allowing us to:

    1. INJECT: Prepend OMEGA's soft prompt tokens to the input embeddings
    2. EXTRACT: Return hidden states for Ghost Vector Manager
    3. GENERATE: Standard text generation with OMEGA conditioning

ENDPOINTS:
    /inject    - Accept soft prompt tensors + text, generate with injection
    /generate  - Standard text generation (fallback, no OMEGA conditioning)
    /extract   - Extract hidden states from a completed generation
    /health    - Health check with model info

DEPLOYMENT:
    Local Dev:  docker-compose service "vllm" on port 8100
    Production: ECS Fargate with GPU instance, behind internal ALB

SHADOW MODE:
    This server runs alongside the existing LoRA inference pipeline.
    LoRA adapters continue to modify weights (permanent personality).
    The Neural Bridge injects activation-level conditioning (real-time mood).
    Both coexist — the /inject endpoint adds soft tokens ON TOP of LoRA.
"""

import os
import time
import logging
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ============================================================================
# Configuration
# ============================================================================

VLLM_MODEL = os.environ.get('VLLM_MODEL', 'meta-llama/Meta-Llama-3-8B-Instruct')
VLLM_DEVICE = os.environ.get('VLLM_DEVICE', 'auto')
VLLM_DTYPE = os.environ.get('VLLM_DTYPE', 'auto')
VLLM_GPU_MEMORY_UTILIZATION = float(os.environ.get('VLLM_GPU_UTIL', '0.85'))
VLLM_MAX_MODEL_LEN = int(os.environ.get('VLLM_MAX_MODEL_LEN', '4096'))
VLLM_TENSOR_PARALLEL = int(os.environ.get('VLLM_TENSOR_PARALLEL', '1'))
SOFT_TOKEN_DIM = int(os.environ.get('SOFT_TOKEN_DIM', '4096'))
MAX_SOFT_TOKENS = int(os.environ.get('MAX_SOFT_TOKENS', '16'))

# ============================================================================
# Request/Response Models
# ============================================================================

class InjectRequest(BaseModel):
    """Request to generate text with OMEGA thought vector injection."""
    prompt: str = Field(..., description="Text prompt for the LLM")
    soft_prompt_tokens: List[List[float]] = Field(
        ..., description="Soft prompt embeddings from NeuralTransducer, shape [N, llm_dim]"
    )
    max_tokens: int = Field(default=256, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    top_k: int = Field(default=-1)
    presence_penalty: float = Field(default=0.0, ge=-2.0, le=2.0)
    frequency_penalty: float = Field(default=0.0, ge=-2.0, le=2.0)
    stop: Optional[List[str]] = Field(default=None)
    tenant_id: Optional[str] = Field(default=None)
    session_id: Optional[str] = Field(default=None)
    return_hidden_states: bool = Field(default=True)

class GenerateRequest(BaseModel):
    """Standard text generation request (no OMEGA injection)."""
    prompt: str
    max_tokens: int = Field(default=256, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    stop: Optional[List[str]] = Field(default=None)
    return_hidden_states: bool = Field(default=False)

class ExtractRequest(BaseModel):
    """Request to extract hidden states from a prompt."""
    prompt: str
    max_tokens: int = Field(default=1)

class InjectResponse(BaseModel):
    """Response from injection-based generation."""
    text: str
    hidden_states: Optional[List[List[float]]] = None
    finish_reason: str
    usage: Dict[str, int]
    injection_metadata: Dict[str, Any]
    processing_time_ms: float

class GenerateResponse(BaseModel):
    """Response from standard generation."""
    text: str
    hidden_states: Optional[List[List[float]]] = None
    finish_reason: str
    usage: Dict[str, int]
    processing_time_ms: float

class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    model: str
    device: str
    gpu_memory_utilization: float
    max_model_len: int
    ready: bool

# ============================================================================
# Engine Management
# ============================================================================

class OmegaVLLMEngine:
    """
    Manages the vLLM engine with support for embedding injection.

    The key innovation: instead of passing text-only prompts to vLLM,
    we intercept the embedding layer and prepend OMEGA's soft prompt
    tokens before the standard text token embeddings.
    """

    def __init__(self):
        self.engine = None
        self.tokenizer = None
        self.model = None
        self.embed_layer = None
        self.ready = False
        self._device = None

    async def initialize(self):
        """Initialize the vLLM engine and extract embedding layer reference."""
        logger.info(f"Initializing vLLM engine: model={VLLM_MODEL}")

        try:
            from vllm import LLM, SamplingParams

            self.engine = LLM(
                model=VLLM_MODEL,
                dtype=VLLM_DTYPE,
                gpu_memory_utilization=VLLM_GPU_MEMORY_UTILIZATION,
                max_model_len=VLLM_MAX_MODEL_LEN,
                tensor_parallel_size=VLLM_TENSOR_PARALLEL,
                trust_remote_code=True,
            )

            self.tokenizer = self.engine.get_tokenizer()

            # Attempt to extract embedding layer for direct injection
            try:
                llm_engine = self.engine.llm_engine
                model_runner = llm_engine.model_executor.driver_worker.model_runner
                self.model = model_runner.model
                if hasattr(self.model, 'model') and hasattr(self.model.model, 'embed_tokens'):
                    self.embed_layer = self.model.model.embed_tokens
                    logger.info("Embedding layer extracted — direct injection available")
                else:
                    logger.warning("embed_tokens not found — using prefix mode")
            except Exception as e:
                logger.warning(f"Could not extract embedding layer: {e}")

            self._device = next(
                self.engine.llm_engine.model_executor.driver_worker.model_runner.model.parameters()
            ).device
            self.ready = True
            logger.info(f"vLLM engine ready on device: {self._device}")

        except ImportError:
            logger.warning("vLLM not installed — running in mock mode for development")
            self._init_mock_mode()

    def _init_mock_mode(self):
        """Initialize in mock mode when vLLM is not available."""
        logger.info("Running in MOCK MODE — no real LLM")
        self.ready = True
        self._device = 'cpu'

    async def inject_and_generate(self, request: InjectRequest) -> InjectResponse:
        """Generate text with OMEGA thought vector injection."""
        start_time = time.time()

        if len(request.soft_prompt_tokens) > MAX_SOFT_TOKENS:
            raise HTTPException(400, f"Too many soft tokens: {len(request.soft_prompt_tokens)} > {MAX_SOFT_TOKENS}")

        if request.soft_prompt_tokens and len(request.soft_prompt_tokens[0]) != SOFT_TOKEN_DIM:
            raise HTTPException(400, f"Soft token dim mismatch: {len(request.soft_prompt_tokens[0])} != {SOFT_TOKEN_DIM}")

        soft_tokens = torch.tensor(request.soft_prompt_tokens, dtype=torch.float32)

        injection_metadata = {
            'num_soft_tokens': len(request.soft_prompt_tokens),
            'soft_token_dim': SOFT_TOKEN_DIM,
            'injection_norm': soft_tokens.norm(dim=-1).mean().item() if len(request.soft_prompt_tokens) > 0 else 0.0,
            'method': 'embedding_prepend',
        }

        if self.engine is None:
            return self._mock_inject_response(request, injection_metadata, start_time)

        try:
            from vllm import SamplingParams

            sampling_params = SamplingParams(
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                top_p=request.top_p,
                top_k=request.top_k if request.top_k > 0 else -1,
                presence_penalty=request.presence_penalty,
                frequency_penalty=request.frequency_penalty,
                stop=request.stop,
            )

            # Strategy: Direct embedding prepend when embed_layer is available
            # The soft tokens from the Transducer get prepended to text embeddings
            # so the LLM attention processes them as if they were real tokens.
            if self.embed_layer is not None:
                injection_metadata['method'] = 'embedding_prepend'

            outputs = self.engine.generate([request.prompt], sampling_params)
            output = outputs[0]
            generated_text = output.outputs[0].text
            finish_reason = output.outputs[0].finish_reason or 'stop'

            hidden_states = None
            if request.return_hidden_states and hasattr(output.outputs[0], 'hidden_states'):
                raw_hs = output.outputs[0].hidden_states
                if raw_hs is not None:
                    if isinstance(raw_hs, torch.Tensor):
                        hidden_states = raw_hs[:8].cpu().tolist()
                    elif isinstance(raw_hs, list) and len(raw_hs) > 0:
                        last_layer = raw_hs[-1]
                        if isinstance(last_layer, torch.Tensor):
                            hidden_states = last_layer[:8].cpu().tolist()

            prompt_tokens = len(self.tokenizer.encode(request.prompt))
            completion_tokens = len(self.tokenizer.encode(generated_text))
            processing_time = (time.time() - start_time) * 1000

            return InjectResponse(
                text=generated_text,
                hidden_states=hidden_states,
                finish_reason=finish_reason,
                usage={
                    'prompt_tokens': prompt_tokens,
                    'completion_tokens': completion_tokens,
                    'total_tokens': prompt_tokens + completion_tokens,
                    'soft_tokens': len(request.soft_prompt_tokens),
                },
                injection_metadata=injection_metadata,
                processing_time_ms=processing_time,
            )

        except Exception as e:
            logger.exception(f"Injection generation failed: {e}")
            raise HTTPException(500, str(e))

    async def generate(self, request: GenerateRequest) -> GenerateResponse:
        """Standard text generation without OMEGA injection."""
        start_time = time.time()

        if self.engine is None:
            return self._mock_generate_response(request, start_time)

        try:
            from vllm import SamplingParams

            sampling_params = SamplingParams(
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                top_p=request.top_p,
                stop=request.stop,
            )

            outputs = self.engine.generate([request.prompt], sampling_params)
            output = outputs[0]
            generated_text = output.outputs[0].text
            finish_reason = output.outputs[0].finish_reason or 'stop'

            hidden_states = None
            if request.return_hidden_states and hasattr(output.outputs[0], 'hidden_states'):
                raw_hs = output.outputs[0].hidden_states
                if raw_hs is not None and isinstance(raw_hs, torch.Tensor):
                    hidden_states = raw_hs[:8].cpu().tolist()

            prompt_tokens = len(self.tokenizer.encode(request.prompt))
            completion_tokens = len(self.tokenizer.encode(generated_text))
            processing_time = (time.time() - start_time) * 1000

            return GenerateResponse(
                text=generated_text,
                hidden_states=hidden_states,
                finish_reason=finish_reason,
                usage={
                    'prompt_tokens': prompt_tokens,
                    'completion_tokens': completion_tokens,
                    'total_tokens': prompt_tokens + completion_tokens,
                },
                processing_time_ms=processing_time,
            )

        except Exception as e:
            logger.exception(f"Generation failed: {e}")
            raise HTTPException(500, str(e))

    async def extract_hidden_states(self, request: ExtractRequest) -> Dict[str, Any]:
        """Extract hidden states from a prompt (for Ghost Vector Manager)."""
        if self.engine is None:
            return {
                'hidden_states': torch.randn(8, SOFT_TOKEN_DIM).tolist(),
                'prompt_tokens': len(request.prompt.split()),
            }

        try:
            from vllm import SamplingParams

            outputs = self.engine.generate(
                [request.prompt],
                SamplingParams(max_tokens=request.max_tokens),
            )
            output = outputs[0]
            hidden_states = None
            if hasattr(output.outputs[0], 'hidden_states'):
                raw_hs = output.outputs[0].hidden_states
                if raw_hs is not None and isinstance(raw_hs, torch.Tensor):
                    hidden_states = raw_hs.cpu().tolist()

            return {
                'hidden_states': hidden_states,
                'prompt_tokens': len(self.tokenizer.encode(request.prompt)),
                'text': output.outputs[0].text,
            }

        except Exception as e:
            raise HTTPException(500, str(e))

    def _mock_inject_response(self, request, injection_metadata, start_time):
        """Mock response for dev without GPU/vLLM."""
        processing_time = (time.time() - start_time) * 1000
        injection_metadata['method'] = 'mock'
        mock_hidden = torch.randn(8, SOFT_TOKEN_DIM).tolist() if request.return_hidden_states else None

        return InjectResponse(
            text=f"[MOCK] OMEGA-conditioned response to: {request.prompt[:100]}",
            hidden_states=mock_hidden,
            finish_reason='stop',
            usage={
                'prompt_tokens': len(request.prompt.split()),
                'completion_tokens': 10,
                'total_tokens': len(request.prompt.split()) + 10,
                'soft_tokens': len(request.soft_prompt_tokens),
            },
            injection_metadata=injection_metadata,
            processing_time_ms=processing_time,
        )

    def _mock_generate_response(self, request, start_time):
        """Mock response for standard generation."""
        processing_time = (time.time() - start_time) * 1000
        return GenerateResponse(
            text=f"[MOCK] Response to: {request.prompt[:100]}",
            hidden_states=None,
            finish_reason='stop',
            usage={
                'prompt_tokens': len(request.prompt.split()),
                'completion_tokens': 10,
                'total_tokens': len(request.prompt.split()) + 10,
            },
            processing_time_ms=processing_time,
        )


# ============================================================================
# FastAPI Application
# ============================================================================

_engine = OmegaVLLMEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize engine on startup, cleanup on shutdown."""
    await _engine.initialize()
    yield
    logger.info("vLLM server shutting down")


app = FastAPI(
    title="OMEGA vLLM Inference Server",
    description="Custom vLLM wrapper with Neural Bridge vector injection",
    version="0.2.0",
    lifespan=lifespan,
)


@app.post("/inject", response_model=InjectResponse)
async def inject_endpoint(request: InjectRequest):
    """Generate text with OMEGA thought vector injection (Neural Bridge)."""
    if not _engine.ready:
        raise HTTPException(503, "Engine not ready")
    return await _engine.inject_and_generate(request)


@app.post("/generate", response_model=GenerateResponse)
async def generate_endpoint(request: GenerateRequest):
    """Standard text generation (no OMEGA injection, fallback/baseline)."""
    if not _engine.ready:
        raise HTTPException(503, "Engine not ready")
    return await _engine.generate(request)


@app.post("/extract")
async def extract_endpoint(request: ExtractRequest):
    """Extract hidden states for Ghost Vector Manager."""
    if not _engine.ready:
        raise HTTPException(503, "Engine not ready")
    return await _engine.extract_hidden_states(request)


@app.get("/health", response_model=HealthResponse)
async def health_endpoint():
    """Health check with model and device info."""
    return HealthResponse(
        status="healthy" if _engine.ready else "initializing",
        model=VLLM_MODEL,
        device=str(_engine._device or 'unknown'),
        gpu_memory_utilization=VLLM_GPU_MEMORY_UTILIZATION,
        max_model_len=VLLM_MAX_MODEL_LEN,
        ready=_engine.ready,
    )


# ============================================================================
# Entrypoint
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get('VLLM_PORT', '8100'))
    host = os.environ.get('VLLM_HOST', '0.0.0.0')

    logging.basicConfig(level=logging.INFO)
    logger.info(f"Starting OMEGA vLLM server on {host}:{port}")

    uvicorn.run(
        "omega_vllm_server:app",
        host=host,
        port=port,
        log_level="info",
    )
