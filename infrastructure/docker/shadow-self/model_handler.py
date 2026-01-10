"""
Shadow Self Model Handler - HTTP Server for SageMaker

This module provides the HTTP server for the Shadow Self container.
It handles incoming inference requests and health checks.

See: /docs/cato/adr/008-shadow-self-infrastructure.md
"""

import os
import json
import logging
from flask import Flask, request, jsonify
from inference import get_model, ShadowSelfModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)

# Model instance
model: ShadowSelfModel = None


def load_model():
    """Load the model on startup."""
    global model
    model_path = os.environ.get("MODEL_PATH", "/opt/ml/model")
    logger.info(f"Loading model from {model_path}")
    
    model = get_model()
    model.model_path = model_path
    model.load()
    
    logger.info("Model loaded successfully")


@app.route("/ping", methods=["GET"])
def ping():
    """Health check endpoint for SageMaker."""
    if model is not None and model.ping():
        return jsonify({"status": "healthy"}), 200
    return jsonify({"status": "unhealthy"}), 503


@app.route("/invocations", methods=["POST"])
def invocations():
    """
    Inference endpoint for SageMaker.
    
    Request format:
    {
        "inputs": "Your prompt here",
        "parameters": {
            "target_layers": [-1, -4, -8],
            "max_new_tokens": 256,
            "temperature": 0.7,
            "return_probs": true
        }
    }
    
    Response format:
    {
        "generated_text": "Generated response",
        "hidden_states": {
            "layer_-1": {"mean": [...], "last_token": [...], "norm": 0.5}
        },
        "logits_entropy": 1.5,
        "generation_probs": [0.9, 0.8, ...],
        "latency_ms": 234.5
    }
    """
    if model is None:
        return jsonify({"error": "Model not loaded"}), 503
    
    try:
        # Parse request
        content_type = request.content_type or "application/json"
        
        if "application/json" in content_type:
            data = request.get_json()
        else:
            return jsonify({"error": f"Unsupported content type: {content_type}"}), 400
        
        if not data:
            return jsonify({"error": "Empty request body"}), 400
        
        # Extract parameters
        text = data.get("inputs", "")
        params = data.get("parameters", {})
        
        if not text:
            return jsonify({"error": "Missing 'inputs' field"}), 400
        
        # Run inference
        result = model.generate_with_hidden_states(
            text=text,
            target_layers=params.get("target_layers", [-1, -4, -8]),
            max_new_tokens=params.get("max_new_tokens", 256),
            temperature=params.get("temperature", 0.7),
            return_probs=params.get("return_probs", True)
        )
        
        # Format response
        response = {
            "generated_text": result.generated_text,
            "hidden_states": result.hidden_states,
            "logits_entropy": result.logits_entropy,
            "generation_probs": result.generation_probs,
            "latency_ms": result.latency_ms
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Inference error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/execution-parameters", methods=["GET"])
def execution_parameters():
    """Return execution parameters for SageMaker."""
    return jsonify({
        "MaxConcurrentTransforms": 4,
        "BatchStrategy": "SINGLE_RECORD",
        "MaxPayloadInMB": 6
    })


def main():
    """Main entry point."""
    # Load model
    load_model()
    
    # Get port from environment
    port = int(os.environ.get("SAGEMAKER_BIND_TO_PORT", 8080))
    
    # Run server
    logger.info(f"Starting server on port {port}")
    app.run(host="0.0.0.0", port=port, threaded=True)


if __name__ == "__main__":
    main()
