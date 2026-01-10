"""
NLI Model Inference - DeBERTa-large-MNLI

Provides entailment classification for Cato verification.
Properly detects negation unlike cosine similarity.

See: /docs/cato/adr/004-nli-entailment.md
"""

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from typing import Dict, Any, Optional
import logging
import time
import os

logger = logging.getLogger(__name__)


class NLIModel:
    """
    DeBERTa-large-MNLI for Natural Language Inference.
    
    Classifies relationship between premise and hypothesis:
    - ENTAILMENT: premise implies hypothesis
    - NEUTRAL: no clear relationship
    - CONTRADICTION: premise contradicts hypothesis
    """
    
    LABELS = ["entailment", "neutral", "contradiction"]
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path or os.environ.get("MODEL_PATH", "/opt/ml/model")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.tokenizer = None
        self._loaded = False
        
        logger.info(f"NLIModel initialized, device={self.device}")
    
    def load(self):
        """Load model and tokenizer."""
        if self._loaded:
            return
        
        logger.info(f"Loading NLI model from {self.model_path}")
        start_time = time.time()
        
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            self.model_path,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
        ).to(self.device)
        self.model.eval()
        
        load_time = time.time() - start_time
        logger.info(f"NLI model loaded in {load_time:.2f}s")
        
        self._loaded = True
    
    @torch.no_grad()
    def classify(
        self,
        premise: str,
        hypothesis: str
    ) -> Dict[str, Any]:
        """
        Classify relationship between premise and hypothesis.
        
        Args:
            premise: The reference text
            hypothesis: The text to compare
        
        Returns:
            Dict with label, scores, confidence, and surprise
        """
        if not self._loaded:
            self.load()
        
        start_time = time.time()
        
        # Tokenize
        inputs = self.tokenizer(
            premise,
            hypothesis,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding=True
        ).to(self.device)
        
        # Forward pass
        outputs = self.model(**inputs)
        logits = outputs.logits
        
        # Get probabilities
        probs = torch.softmax(logits, dim=-1)[0]
        
        # Get scores for each label
        scores = {
            label: probs[i].item()
            for i, label in enumerate(self.LABELS)
        }
        
        # Determine winning label
        label_idx = probs.argmax().item()
        label = self.LABELS[label_idx]
        confidence = probs[label_idx].item()
        
        # Calculate surprise score
        # ENTAILMENT = 0.0, NEUTRAL = 0.5, CONTRADICTION = 1.0
        base_surprise = {
            "entailment": 0.0,
            "neutral": 0.5,
            "contradiction": 1.0
        }[label]
        
        # Weight by confidence
        surprise = base_surprise * confidence + 0.5 * (1 - confidence)
        
        latency_ms = (time.time() - start_time) * 1000
        
        return {
            "label": label,
            "scores": scores,
            "confidence": confidence,
            "surprise": surprise,
            "latency_ms": latency_ms
        }
    
    def ping(self) -> bool:
        """Health check."""
        return self._loaded


# Singleton
_model_instance: Optional[NLIModel] = None


def get_model() -> NLIModel:
    """Get or create the singleton model."""
    global _model_instance
    if _model_instance is None:
        _model_instance = NLIModel()
    return _model_instance


# SageMaker handlers
def model_fn(model_dir: str):
    """Load model for SageMaker."""
    model = NLIModel(model_dir)
    model.load()
    return model


def input_fn(request_body: str, request_content_type: str):
    """Parse input."""
    import json
    if request_content_type == "application/json":
        return json.loads(request_body)
    raise ValueError(f"Unsupported content type: {request_content_type}")


def predict_fn(data: Dict[str, Any], model: NLIModel) -> Dict[str, Any]:
    """Run prediction."""
    inputs = data.get("inputs", {})
    premise = inputs.get("premise", "")
    hypothesis = inputs.get("hypothesis", "")
    
    return model.classify(premise, hypothesis)


def output_fn(prediction: Dict[str, Any], accept: str) -> str:
    """Format output."""
    import json
    return json.dumps(prediction)
