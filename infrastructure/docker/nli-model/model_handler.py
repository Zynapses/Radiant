"""
NLI Model Handler - HTTP Server for SageMaker MME

Handles incoming NLI classification requests.

See: /docs/cato/adr/004-nli-entailment.md
"""

import os
import logging
from flask import Flask, request, jsonify
from inference import get_model, NLIModel

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
model: NLIModel = None


def load_model():
    """Load the model on startup."""
    global model
    model_path = os.environ.get("MODEL_PATH", "/opt/ml/model")
    logger.info(f"Loading NLI model from {model_path}")
    
    model = get_model()
    model.model_path = model_path
    model.load()
    
    logger.info("NLI model loaded successfully")


@app.route("/ping", methods=["GET"])
def ping():
    """Health check."""
    if model is not None and model.ping():
        return jsonify({"status": "healthy"}), 200
    return jsonify({"status": "unhealthy"}), 503


@app.route("/invocations", methods=["POST"])
def invocations():
    """
    NLI classification endpoint.
    
    Request:
    {
        "inputs": {
            "premise": "The sky is blue",
            "hypothesis": "The sky has a color"
        }
    }
    
    Response:
    {
        "label": "entailment",
        "scores": {"entailment": 0.95, "neutral": 0.04, "contradiction": 0.01},
        "confidence": 0.95,
        "surprise": 0.0,
        "latency_ms": 45.2
    }
    """
    if model is None:
        return jsonify({"error": "Model not loaded"}), 503
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Empty request"}), 400
        
        inputs = data.get("inputs", {})
        premise = inputs.get("premise", "")
        hypothesis = inputs.get("hypothesis", "")
        
        if not premise or not hypothesis:
            return jsonify({"error": "Missing premise or hypothesis"}), 400
        
        result = model.classify(premise, hypothesis)
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


def main():
    """Main entry point."""
    load_model()
    port = int(os.environ.get("SAGEMAKER_BIND_TO_PORT", 8080))
    logger.info(f"Starting NLI server on port {port}")
    app.run(host="0.0.0.0", port=port, threaded=True)


if __name__ == "__main__":
    main()
