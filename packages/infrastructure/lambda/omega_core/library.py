# Project OMEGA - Resonant Library
# O(1) Phase-Based Indexing (No Cosine Similarity)

"""
THE LIBRARY: Resonant Indexing

Problem: Vector DBs (Pinecone) are slow if you scan everything - O(N).
Solution: Frequency-Based Addressing - O(1).

The OMEGA Brain does not store files. It stores the "Frequency Key" of the file.

Mechanism:
- When the brain thinks about "Tax Law", it oscillates at a specific Phase Angle (θ=0.4π)
- We use a Phase-Quantized Hash Map
- We query the DB by Phase, not by Text

The Lookup:
- We query the Vector DB not by text similarity, but by Phase Resonance
- The DB returns only the documents that "vibrate" at that frequency
- This is an O(1) (instant) lookup

Vector Sum Method:
- We use vector summation to find the mean phase
- Averaging angles directly is mathematically incorrect due to periodicity
- Summing complex vectors computes the "Average Direction" correctly
"""

import torch
import math
import hashlib
import logging
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@dataclass
class IndexedDocument:
    """A document stored in the Resonant Index."""
    doc_id: str
    source_uri: str  # S3 URI or URL
    title: str
    phase_bucket: int
    phase_angle: float  # Actual angle in radians
    indexed_at: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ResonanceMatch:
    """A match from resonance lookup."""
    doc_id: str
    phase_distance: float  # How close the phase match is (0 = perfect)
    document: Optional[IndexedDocument] = None


class ResonantIndex:
    """
    O(1) Lookup Index based on Phase Resonance.
    
    Instead of cosine similarity search (O(N)), we use phase quantization
    to create hash buckets. Documents are stored by their dominant phase angle.
    
    Resolution determines granularity:
    - resolution=1000 slices the unit circle (2π) into 1000 discrete slots
    - Higher resolution = more precise but more buckets
    - Lower resolution = faster but less precise
    """
    
    def __init__(self, resolution: int = 1000):
        # Buckets for phase angles (Hash Map)
        # Each bucket contains document IDs that resonate at that phase
        self.buckets: Dict[int, List[str]] = {i: [] for i in range(resolution)}
        self.resolution = resolution
        
        # Document storage for metadata
        self.documents: Dict[str, IndexedDocument] = {}
        
        # Statistics
        self.total_documents = 0
        self.bucket_distribution: Dict[int, int] = {}
    
    def _quantize_phase(self, complex_vector: torch.Tensor) -> tuple[int, float]:
        """
        Extract the dominant Phase Angle from a thought vector
        and convert it to an integer bucket ID.
        
        Uses Vector Summation to correctly average angular data.
        (Averaging angles directly is mathematically incorrect due to periodicity)
        
        Args:
            complex_vector: Complex tensor representing a thought
            
        Returns:
            Tuple of (bucket_id, raw_angle)
        """
        # Summing complex vectors computes the "Average Direction" (Mean Phase)
        # This handles the periodicity of angles correctly
        aggregate_vector = torch.sum(complex_vector)
        
        # Get phase angle (-π to +π)
        angle = torch.angle(aggregate_vector).item()
        
        # Normalize to 0 -> 1 range
        normalized = (angle + math.pi) / (2 * math.pi)
        
        # Map to Bucket ID (Hash Key)
        bucket_id = int(normalized * self.resolution) % self.resolution
        
        return bucket_id, angle
    
    def _get_adjacent_buckets(self, bucket_id: int, radius: int = 1) -> List[int]:
        """
        Get adjacent buckets for fuzzy matching.
        
        Args:
            bucket_id: Central bucket
            radius: How many buckets on each side to include
            
        Returns:
            List of bucket IDs including central and adjacent
        """
        buckets = [bucket_id]
        for i in range(1, radius + 1):
            # Handle wrap-around (phase is circular)
            buckets.append((bucket_id + i) % self.resolution)
            buckets.append((bucket_id - i) % self.resolution)
        return buckets
    
    def store(
        self,
        doc_id: str,
        vector_embedding: torch.Tensor,
        source_uri: str,
        title: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> IndexedDocument:
        """
        Store a document in the Resonant Index.
        
        Args:
            doc_id: Unique document identifier
            vector_embedding: Complex vector representation
            source_uri: Where the document lives (S3, URL, etc.)
            title: Human-readable title
            metadata: Additional metadata
            
        Returns:
            The indexed document record
        """
        bucket_id, angle = self._quantize_phase(vector_embedding)
        
        # Create document record
        doc = IndexedDocument(
            doc_id=doc_id,
            source_uri=source_uri,
            title=title,
            phase_bucket=bucket_id,
            phase_angle=angle,
            indexed_at=datetime.now(timezone.utc).isoformat(),
            metadata=metadata or {}
        )
        
        # Store in bucket
        if doc_id not in self.buckets[bucket_id]:
            self.buckets[bucket_id].append(doc_id)
        
        # Store document metadata
        self.documents[doc_id] = doc
        self.total_documents += 1
        
        # Update distribution stats
        self.bucket_distribution[bucket_id] = len(self.buckets[bucket_id])
        
        logger.debug(f"Indexed document {doc_id} in bucket {bucket_id} (angle: {angle:.4f})")
        
        return doc
    
    def retrieve(
        self,
        thought_vector: torch.Tensor,
        fuzzy_radius: int = 0,
        max_results: int = 100
    ) -> List[ResonanceMatch]:
        """
        INSTANT O(1) LOOKUP based on Brain State resonance.
        
        No cosine similarity calculation required.
        
        Args:
            thought_vector: The current brain state
            fuzzy_radius: Include adjacent buckets (0 = exact match only)
            max_results: Maximum documents to return
            
        Returns:
            List of matching documents with resonance scores
        """
        bucket_id, query_angle = self._quantize_phase(thought_vector)
        
        # Get bucket(s) to search
        if fuzzy_radius > 0:
            buckets_to_search = self._get_adjacent_buckets(bucket_id, fuzzy_radius)
        else:
            buckets_to_search = [bucket_id]
        
        matches = []
        for bid in buckets_to_search:
            for doc_id in self.buckets.get(bid, []):
                doc = self.documents.get(doc_id)
                if doc:
                    # Calculate phase distance (how close the match is)
                    angle_diff = abs(doc.phase_angle - query_angle)
                    # Handle wrap-around
                    if angle_diff > math.pi:
                        angle_diff = 2 * math.pi - angle_diff
                    
                    matches.append(ResonanceMatch(
                        doc_id=doc_id,
                        phase_distance=angle_diff,
                        document=doc
                    ))
        
        # Sort by phase distance (closest first)
        matches.sort(key=lambda x: x.phase_distance)
        
        return matches[:max_results]
    
    def delete(self, doc_id: str) -> bool:
        """
        Remove a document from the index.
        
        Args:
            doc_id: Document to remove
            
        Returns:
            True if document was found and removed
        """
        if doc_id not in self.documents:
            return False
        
        doc = self.documents[doc_id]
        bucket_id = doc.phase_bucket
        
        # Remove from bucket
        if doc_id in self.buckets[bucket_id]:
            self.buckets[bucket_id].remove(doc_id)
            self.bucket_distribution[bucket_id] = len(self.buckets[bucket_id])
        
        # Remove document record
        del self.documents[doc_id]
        self.total_documents -= 1
        
        return True
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get index statistics for monitoring.
        
        Returns:
            Dictionary of statistics
        """
        non_empty_buckets = sum(1 for v in self.buckets.values() if v)
        
        return {
            'total_documents': self.total_documents,
            'resolution': self.resolution,
            'non_empty_buckets': non_empty_buckets,
            'bucket_utilization': non_empty_buckets / self.resolution,
            'avg_docs_per_bucket': self.total_documents / max(non_empty_buckets, 1),
            'max_bucket_size': max(len(v) for v in self.buckets.values()) if self.buckets else 0
        }
    
    def get_phase_heatmap(self) -> List[int]:
        """
        Get bucket sizes for visualization (heatmap).
        
        Returns:
            List of document counts per bucket
        """
        return [len(self.buckets[i]) for i in range(self.resolution)]
    
    def export_state(self) -> Dict[str, Any]:
        """
        Export the entire index state for persistence.
        
        Returns:
            Serializable dictionary
        """
        return {
            'resolution': self.resolution,
            'documents': {
                doc_id: {
                    'doc_id': doc.doc_id,
                    'source_uri': doc.source_uri,
                    'title': doc.title,
                    'phase_bucket': doc.phase_bucket,
                    'phase_angle': doc.phase_angle,
                    'indexed_at': doc.indexed_at,
                    'metadata': doc.metadata
                }
                for doc_id, doc in self.documents.items()
            },
            'stats': self.get_stats()
        }
    
    def import_state(self, state: Dict[str, Any]) -> None:
        """
        Import a previously exported index state.
        
        Args:
            state: State dictionary from export_state
        """
        self.resolution = state['resolution']
        self.buckets = {i: [] for i in range(self.resolution)}
        self.documents = {}
        self.total_documents = 0
        
        for doc_id, doc_data in state.get('documents', {}).items():
            doc = IndexedDocument(**doc_data)
            self.documents[doc_id] = doc
            self.buckets[doc.phase_bucket].append(doc_id)
            self.total_documents += 1
        
        # Rebuild distribution
        self.bucket_distribution = {
            i: len(self.buckets[i]) 
            for i in range(self.resolution) 
            if self.buckets[i]
        }


class ResonantIndexManager:
    """
    Manager for multiple Resonant Indices (per-tenant, per-domain).
    
    Provides:
    - Multi-tenant isolation
    - Domain-specific indices (e.g., "legal", "medical", "finance")
    - Automatic index creation
    """
    
    def __init__(self, default_resolution: int = 1000):
        self.default_resolution = default_resolution
        self.indices: Dict[str, ResonantIndex] = {}
    
    def _get_index_key(self, tenant_id: str, domain: Optional[str] = None) -> str:
        """Generate a unique key for an index."""
        if domain:
            return f"{tenant_id}:{domain}"
        return tenant_id
    
    def get_or_create_index(
        self,
        tenant_id: str,
        domain: Optional[str] = None,
        resolution: Optional[int] = None
    ) -> ResonantIndex:
        """
        Get or create an index for a tenant/domain.
        
        Args:
            tenant_id: Tenant identifier
            domain: Optional domain (e.g., "legal", "medical")
            resolution: Optional custom resolution
            
        Returns:
            The resonant index
        """
        key = self._get_index_key(tenant_id, domain)
        
        if key not in self.indices:
            self.indices[key] = ResonantIndex(
                resolution=resolution or self.default_resolution
            )
        
        return self.indices[key]
    
    def list_indices(self) -> List[Dict[str, Any]]:
        """
        List all indices with their stats.
        
        Returns:
            List of index info dictionaries
        """
        result = []
        for key, index in self.indices.items():
            parts = key.split(':')
            tenant_id = parts[0]
            domain = parts[1] if len(parts) > 1 else None
            
            result.append({
                'key': key,
                'tenant_id': tenant_id,
                'domain': domain,
                **index.get_stats()
            })
        
        return result
