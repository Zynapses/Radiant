# OMEGA vLLM Server - Neural Bridge Inference
# Custom FastAPI wrapper with vector injection support
#
# Build: docker build -t radiant-vllm .
# Run:   docker run --gpus all -p 8100:8100 radiant-vllm
#
# For local dev without GPU, set VLLM_DEVICE=cpu (very slow, for testing only)

FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

# Install Python and system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.11 as default
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy the vLLM server code
COPY --from=server ../../packages/infrastructure/lambda/handlers/omega_vllm_server.py /app/omega_vllm_server.py

# Alternative: copy directly if building from docker context
COPY omega_vllm_server.py /app/omega_vllm_server.py

# Model cache directory
RUN mkdir -p /root/.cache/huggingface
RUN mkdir -p /mnt/omega_state

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=120s \
    CMD curl -f http://localhost:8100/health || exit 1

EXPOSE 8100

ENV VLLM_PORT=8100
ENV VLLM_HOST=0.0.0.0
ENV VLLM_MODEL=meta-llama/Meta-Llama-3-8B-Instruct
ENV VLLM_DTYPE=auto
ENV VLLM_GPU_UTIL=0.85
ENV VLLM_MAX_MODEL_LEN=4096

CMD ["python", "-m", "uvicorn", "omega_vllm_server:app", "--host", "0.0.0.0", "--port", "8100"]
