"""
Data models for IIT 4.0 concepts and structures.
"""

from dataclasses import dataclass, field
from typing import Tuple, List, Optional
import numpy as np


@dataclass(frozen=True)
class RepertoireResult:
    """Result of a repertoire computation (cause or effect)."""
    
    purview: Tuple[int, ...]
    repertoire: np.ndarray
    phi: float
    partition: Optional[Tuple[Tuple[int, ...], Tuple[int, ...]]] = None
    
    def __repr__(self) -> str:
        return f"RepertoireResult(purview={self.purview}, phi={self.phi:.4f})"


@dataclass(frozen=True)
class Concept:
    """
    A maximally irreducible cause-effect repertoire.
    
    In IIT, a concept represents a distinct "meaning" or "distinction"
    made by a mechanism within the system. It consists of:
    - A mechanism (subset of nodes)
    - A cause repertoire over a cause purview
    - An effect repertoire over an effect purview
    - Small phi (φ) measuring its irreducibility
    """
    
    mechanism: Tuple[int, ...]
    cause: RepertoireResult
    effect: RepertoireResult
    phi: float
    
    @property
    def cause_purview(self) -> Tuple[int, ...]:
        """The cause purview of this concept."""
        return self.cause.purview
    
    @property
    def effect_purview(self) -> Tuple[int, ...]:
        """The effect purview of this concept."""
        return self.effect.purview
    
    @property
    def cause_repertoire(self) -> np.ndarray:
        """The cause repertoire distribution."""
        return self.cause.repertoire
    
    @property
    def effect_repertoire(self) -> np.ndarray:
        """The effect repertoire distribution."""
        return self.effect.repertoire
    
    def __repr__(self) -> str:
        return (
            f"Concept(mechanism={self.mechanism}, "
            f"cause_purview={self.cause_purview}, "
            f"effect_purview={self.effect_purview}, "
            f"phi={self.phi:.4f})"
        )


@dataclass
class ConceptStructure:
    """
    The constellation of concepts (cause-effect structure).
    
    The concept structure represents the complete set of distinctions
    (concepts) made by a system in a particular state. Big Phi (Φ)
    measures the irreducibility of this structure.
    """
    
    concepts: List[Concept] = field(default_factory=list)
    phi: float = 0.0
    mip: Optional[Tuple[Tuple[int, ...], Tuple[int, ...]]] = None
    
    @property
    def num_concepts(self) -> int:
        """Number of concepts in the structure."""
        return len(self.concepts)
    
    @property
    def total_concept_phi(self) -> float:
        """Sum of small phi values across all concepts."""
        return sum(c.phi for c in self.concepts)
    
    def get_concept(self, mechanism: Tuple[int, ...]) -> Optional[Concept]:
        """Get the concept for a specific mechanism, if it exists."""
        for concept in self.concepts:
            if concept.mechanism == mechanism:
                return concept
        return None
    
    def __repr__(self) -> str:
        return (
            f"ConceptStructure(num_concepts={self.num_concepts}, "
            f"phi={self.phi:.4f}, "
            f"total_concept_phi={self.total_concept_phi:.4f})"
        )


@dataclass
class SystemState:
    """
    Represents the current state of a system for analysis.
    """
    
    state: Tuple[int, ...]
    node_indices: Tuple[int, ...]
    
    @property
    def n_nodes(self) -> int:
        """Number of nodes in the state."""
        return len(self.state)
    
    def __repr__(self) -> str:
        return f"SystemState(state={self.state})"


@dataclass
class PartitionResult:
    """Result of finding the minimum information partition."""
    
    partition: Tuple[Tuple[int, ...], Tuple[int, ...]]
    phi: float
    unpartitioned_ces: ConceptStructure
    partitioned_ces: ConceptStructure
    
    @property
    def part1(self) -> Tuple[int, ...]:
        """First part of the partition."""
        return self.partition[0]
    
    @property
    def part2(self) -> Tuple[int, ...]:
        """Second part of the partition."""
        return self.partition[1]
    
    def __repr__(self) -> str:
        return (
            f"PartitionResult(partition={self.partition}, "
            f"phi={self.phi:.4f})"
        )
