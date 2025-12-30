"""
Shadow Self Inference - Llama-3-8B with Hidden State Extraction

This module provides the core inference logic for the Shadow Self endpoint.
It extracts hidden states for activation probing and uncertainty detection.

See: /docs/bobble/adr/008-shadow-self-infrastructure.md
"""

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
import numpy as np
import logging
import time
import os

logger = logging.getLogger(__name__)


@dataclass
class HiddenStateResult:
    """Result with hidden states for activation probing."""
    generated_text: str
    hidden_states: Dict[str, Dict[str, List[float]]]
    logits_entropy: float
    generation_probs: List[float]
    latency_ms: float


class ShadowSelfModel:
    """
    Llama-3-8B with hidden state extraction for Shadow Self verification.
    
    Extracts:
    - Hidden states from configurable layers
    - Logit entropy for uncertainty estimation
    - Per-token generation probabilities
    """
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path or os.environ.get("MODEL_PATH", "/opt/ml/model")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.tokenizer = None
        self._loaded = False
        
        logger.info(f"ShadowSelfModel initialized, device={self.device}")
    
    def load(self):
        """Load model and tokenizer."""
        if self._loaded:
            return
        
        logger.info(f"Loading model from {self.model_path}")
        start_time = time.time()
        
        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # Load model with hidden state output
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_path,
            torch_dtype=torch.float16,
            device_map="auto",
            output_hidden_states=True,
            output_attentions=False,  # Skip attention for efficiency
            low_cpu_mem_usage=True
        )
        self.model.eval()
        
        load_time = time.time() - start_time
        logger.info(f"Model loaded in {load_time:.2f}s")
        
        self._loaded = True
    
    @torch.no_grad()
    def generate_with_hidden_states(
        self,
        text: str,
        target_layers: List[int] = None,
        max_new_tokens: int = 256,
        temperature: float = 0.7,
        return_probs: bool = True
    ) -> HiddenStateResult:
        """
        Generate text and extract hidden states.
        
        Args:
            text: Input prompt
            target_layers: Which layers to extract (negative = from end)
            max_new_tokens: Maximum generation length
            temperature: Sampling temperature
            return_probs: Whether to return token probabilities
        
        Returns:
            HiddenStateResult with text, hidden states, and metadata
        """
        if not self._loaded:
            self.load()
        
        if target_layers is None:
            target_layers = [-1, -4, -8]
        
        start_time = time.time()
        
        # Tokenize input
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=2048
        ).to(self.device)
        
        input_length = inputs.input_ids.shape[1]
        
        # Generate with hidden states
        outputs = self.model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=temperature if temperature > 0 else 1.0,
            do_sample=temperature > 0,
            output_hidden_states=True,
            output_scores=return_probs,
            return_dict_in_generate=True,
            pad_token_id=self.tokenizer.pad_token_id
        )
        
        # Decode generated text
        generated_ids = outputs.sequences[0][input_length:]
        generated_text = self.tokenizer.decode(
            generated_ids,
            skip_special_tokens=True
        )
        
        # Extract hidden states
        hidden_states = self._extract_hidden_states(outputs, target_layers)
        
        # Calculate logit entropy and generation probabilities
        logits_entropy, generation_probs = self._calculate_uncertainty(
            outputs, generated_ids, return_probs
        )
        
        latency_ms = (time.time() - start_time) * 1000
        
        return HiddenStateResult(
            generated_text=generated_text,
            hidden_states=hidden_states,
            logits_entropy=logits_entropy,
            generation_probs=generation_probs,
            latency_ms=latency_ms
        )
    
    def _extract_hidden_states(
        self,
        outputs,
        target_layers: List[int]
    ) -> Dict[str, Dict[str, List[float]]]:
        """Extract hidden states from specified layers."""
        hidden_states = {}
        
        if not hasattr(outputs, 'hidden_states') or not outputs.hidden_states:
            return hidden_states
        
        # outputs.hidden_states is a tuple of (num_tokens, num_layers, batch, seq, hidden)
        for layer_idx in target_layers:
            layer_key = f"layer_{layer_idx}"
            
            try:
                # Get hidden state for this layer at first generation step
                if len(outputs.hidden_states) > 0:
                    first_step_hidden = outputs.hidden_states[0]
                    num_layers = len(first_step_hidden)
                    
                    # Handle negative indexing
                    actual_idx = layer_idx if layer_idx >= 0 else num_layers + layer_idx
                    
                    if 0 <= actual_idx < num_layers:
                        layer_hidden = first_step_hidden[actual_idx]
                        
                        # Extract statistics
                        mean_hidden = layer_hidden.mean(dim=1).squeeze()
                        last_token_hidden = layer_hidden[:, -1, :].squeeze()
                        norm = layer_hidden.norm(dim=-1).mean().item()
                        
                        hidden_states[layer_key] = {
                            "mean": mean_hidden.cpu().tolist()[:100],  # Truncate for efficiency
                            "last_token": last_token_hidden.cpu().tolist()[:100],
                            "norm": norm
                        }
            except Exception as e:
                logger.warning(f"Failed to extract layer {layer_idx}: {e}")
        
        return hidden_states
    
    def _calculate_uncertainty(
        self,
        outputs,
        generated_ids: torch.Tensor,
        return_probs: bool
    ) -> tuple:
        """Calculate logit entropy and generation probabilities."""
        logits_entropy = 0.0
        generation_probs = []
        
        if not return_probs or not hasattr(outputs, 'scores') or not outputs.scores:
            return logits_entropy, generation_probs
        
        try:
            total_entropy = 0.0
            for i, step_logits in enumerate(outputs.scores):
                probs = torch.softmax(step_logits, dim=-1)
                
                # Calculate entropy
                entropy = -(probs * torch.log(probs + 1e-10)).sum(dim=-1).mean().item()
                total_entropy += entropy
                
                # Get probability of generated token
                if i < len(generated_ids):
                    token_idx = generated_ids[i].item()
                    token_prob = probs[0, token_idx].item()
                    generation_probs.append(token_prob)
            
            logits_entropy = total_entropy / max(len(outputs.scores), 1)
            
        except Exception as e:
            logger.warning(f"Failed to calculate uncertainty: {e}")
        
        return logits_entropy, generation_probs
    
    def ping(self) -> bool:
        """Health check."""
        return self._loaded or self.model is not None


# Singleton model instance
_model_instance: Optional[ShadowSelfModel] = None


def get_model() -> ShadowSelfModel:
    """Get or create the singleton model instance."""
    global _model_instance
    if _model_instance is None:
        _model_instance = ShadowSelfModel()
    return _model_instance


# SageMaker inference handlers
def model_fn(model_dir: str):
    """Load model for SageMaker."""
    model = ShadowSelfModel(model_dir)
    model.load()
    return model


def input_fn(request_body: str, request_content_type: str):
    """Parse input for SageMaker."""
    import json
    
    if request_content_type == "application/json":
        return json.loads(request_body)
    raise ValueError(f"Unsupported content type: {request_content_type}")


def predict_fn(data: Dict[str, Any], model: ShadowSelfModel) -> Dict[str, Any]:
    """Run prediction for SageMaker."""
    text = data.get("inputs", "")
    params = data.get("parameters", {})
    
    result = model.generate_with_hidden_states(
        text=text,
        target_layers=params.get("target_layers", [-1, -4, -8]),
        max_new_tokens=params.get("max_new_tokens", 256),
        temperature=params.get("temperature", 0.7),
        return_probs=params.get("return_probs", True)
    )
    
    return {
        "generated_text": result.generated_text,
        "hidden_states": result.hidden_states,
        "logits_entropy": result.logits_entropy,
        "generation_probs": result.generation_probs,
        "latency_ms": result.latency_ms
    }


def output_fn(prediction: Dict[str, Any], accept: str) -> str:
    """Format output for SageMaker."""
    import json
    return json.dumps(prediction)
