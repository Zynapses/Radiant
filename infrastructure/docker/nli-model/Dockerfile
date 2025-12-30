# Bobble NLI Model Container
# DeBERTa-large-MNLI for entailment classification
#
# See: /docs/bobble/adr/004-nli-entailment.md

FROM nvidia/cuda:12.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3.10-venv \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1 \
    && update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

WORKDIR /opt/ml/code

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy inference code
COPY inference.py .
COPY model_handler.py .

# Environment
ENV MODEL_PATH=/opt/ml/model
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/ping || exit 1

EXPOSE 8080

CMD ["python", "model_handler.py"]
