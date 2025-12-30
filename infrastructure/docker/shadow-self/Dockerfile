# Bobble Shadow Self Container
# Llama-3-8B with hidden state extraction for SageMaker
#
# See: /docs/bobble/adr/008-shadow-self-infrastructure.md

FROM nvidia/cuda:12.1-runtime-ubuntu22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3.10-venv \
    python3-pip \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.10 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1 \
    && update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

# Create working directory
WORKDIR /opt/ml/code

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy inference code
COPY inference.py .
COPY model_handler.py .

# Set environment variables
ENV MODEL_PATH=/opt/ml/model
ENV CUDA_VISIBLE_DEVICES=0
ENV TRANSFORMERS_CACHE=/tmp/transformers
ENV HF_HOME=/tmp/huggingface
ENV PYTHONUNBUFFERED=1

# Create cache directories
RUN mkdir -p /tmp/transformers /tmp/huggingface

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/ping || exit 1

# Expose port for SageMaker
EXPOSE 8080

# Start the model server
CMD ["python", "model_handler.py"]
