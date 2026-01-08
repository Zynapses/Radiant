"""
Embedding Generation Utilities

RADIANT v5.0.2 - System Evolution

Generates vector embeddings for semantic search in The Grimoire.
Uses OpenAI's text-embedding-3-small (1536 dimensions) via LiteLLM.
"""

import os
import httpx
from typing import List, Optional


# Model configuration
DEFAULT_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536
MAX_CHARS = 30000  # ~8K tokens for text-embedding-3-small


def get_litellm_config() -> tuple:
    """Get LiteLLM configuration from environment"""
    url = os.environ.get('LITELLM_PROXY_URL', 'http://litellm.radiant.internal')
    api_key = os.environ.get('LITELLM_API_KEY', '')
    return url, api_key


def generate_embedding(
    text: str, 
    model: str = DEFAULT_MODEL,
    timeout: float = 30.0
) -> List[float]:
    """
    Generates a vector embedding for the given text.
    
    Args:
        text: The text to embed (max 8191 tokens for text-embedding-3-small)
        model: The embedding model to use (default: text-embedding-3-small)
        timeout: Request timeout in seconds
        
    Returns:
        List of floats representing the embedding vector (1536 dimensions)
        
    Raises:
        httpx.HTTPError: If the API call fails
        ValueError: If the response is malformed
    """
    url, api_key = get_litellm_config()
    
    # Truncate very long texts to avoid token limits
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS]
    
    with httpx.Client(timeout=timeout) as client:
        response = client.post(
            f"{url}/embeddings",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "input": text,
                "encoding_format": "float"
            }
        )
        response.raise_for_status()
        
        data = response.json()
        
        if "data" not in data or len(data["data"]) == 0:
            raise ValueError(f"Invalid embedding response: {data}")
            
        embedding = data["data"][0]["embedding"]
        
        # Validate dimension
        if len(embedding) != EMBEDDING_DIMENSIONS:
            raise ValueError(f"Unexpected embedding dimension: {len(embedding)}, expected {EMBEDDING_DIMENSIONS}")
            
        return embedding


def generate_embeddings_batch(
    texts: List[str], 
    model: str = DEFAULT_MODEL,
    timeout: float = 60.0
) -> List[List[float]]:
    """
    Generates embeddings for multiple texts in a single API call.
    More efficient than individual calls for bulk operations.
    
    Args:
        texts: List of texts to embed (max 2048 items per batch)
        model: The embedding model to use
        timeout: Request timeout in seconds
        
    Returns:
        List of embedding vectors in the same order as inputs
        
    Raises:
        httpx.HTTPError: If the API call fails
        ValueError: If the response is malformed
    """
    if not texts:
        return []
    
    url, api_key = get_litellm_config()
    
    # Truncate texts
    truncated_texts = [t[:MAX_CHARS] if len(t) > MAX_CHARS else t for t in texts]
    
    with httpx.Client(timeout=timeout) as client:
        response = client.post(
            f"{url}/embeddings",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "input": truncated_texts,
                "encoding_format": "float"
            }
        )
        response.raise_for_status()
        
        data = response.json()
        
        if "data" not in data:
            raise ValueError(f"Invalid batch embedding response: {data}")
        
        # Sort by index to ensure correct order
        embeddings_data = sorted(data["data"], key=lambda x: x["index"])
        embeddings = [item["embedding"] for item in embeddings_data]
        
        # Validate dimensions
        for i, emb in enumerate(embeddings):
            if len(emb) != EMBEDDING_DIMENSIONS:
                raise ValueError(f"Unexpected dimension for embedding {i}: {len(emb)}")
        
        return embeddings


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors.
    
    Args:
        vec1: First embedding vector
        vec2: Second embedding vector
        
    Returns:
        Cosine similarity score between 0 and 1
    """
    import math
    
    if len(vec1) != len(vec2):
        raise ValueError("Vectors must have the same dimension")
    
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(b * b for b in vec2))
    
    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0
    
    return dot_product / (magnitude1 * magnitude2)


def cosine_distance(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine distance between two vectors.
    
    Args:
        vec1: First embedding vector
        vec2: Second embedding vector
        
    Returns:
        Cosine distance (1 - similarity), where 0 = identical
    """
    return 1.0 - cosine_similarity(vec1, vec2)


class EmbeddingCache:
    """
    Simple in-memory cache for embeddings to avoid redundant API calls.
    Useful for batch operations with potential duplicates.
    """
    
    def __init__(self, max_size: int = 1000):
        self._cache: dict = {}
        self._max_size = max_size
    
    def get(self, text: str) -> Optional[List[float]]:
        """Get cached embedding if available"""
        return self._cache.get(text)
    
    def set(self, text: str, embedding: List[float]) -> None:
        """Cache an embedding"""
        if len(self._cache) >= self._max_size:
            # Simple LRU: remove oldest entry
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
        self._cache[text] = embedding
    
    def get_or_generate(self, text: str, model: str = DEFAULT_MODEL) -> List[float]:
        """Get from cache or generate new embedding"""
        cached = self.get(text)
        if cached is not None:
            return cached
        
        embedding = generate_embedding(text, model)
        self.set(text, embedding)
        return embedding
    
    def clear(self) -> None:
        """Clear the cache"""
        self._cache.clear()
