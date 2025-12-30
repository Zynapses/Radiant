"""
Utility functions for IIT computations.
"""

from typing import Tuple, List, Iterator, Set
from itertools import combinations
import numpy as np


def powerset(iterable: Tuple[int, ...], min_size: int = 0) -> Iterator[Tuple[int, ...]]:
    """
    Generate all subsets of a tuple with at least min_size elements.
    
    Args:
        iterable: Input tuple
        min_size: Minimum subset size (default 0)
        
    Yields:
        Subsets as tuples
    """
    items = list(iterable)
    for r in range(min_size, len(items) + 1):
        for combo in combinations(items, r):
            yield combo


def bipartitions(nodes: Tuple[int, ...]) -> Iterator[Tuple[Tuple[int, ...], Tuple[int, ...]]]:
    """
    Generate all bipartitions of a set of nodes.
    
    A bipartition divides the nodes into two non-empty, disjoint subsets.
    
    Args:
        nodes: Tuple of node indices
        
    Yields:
        Tuples of (part1, part2)
    """
    n = len(nodes)
    if n < 2:
        return
    
    # Generate partitions where part1 gets at least one node
    # and part2 gets the rest
    for k in range(1, n):
        for part1 in combinations(nodes, k):
            part2 = tuple(n for n in nodes if n not in part1)
            yield (part1, part2)


def state_to_index(state: Tuple[int, ...]) -> int:
    """Convert binary state tuple to index."""
    idx = 0
    for i, val in enumerate(state):
        if val:
            idx |= (1 << i)
    return idx


def index_to_state(idx: int, n: int) -> Tuple[int, ...]:
    """Convert index to binary state tuple."""
    return tuple((idx >> i) & 1 for i in range(n))


def all_states(n: int) -> Iterator[Tuple[int, ...]]:
    """Generate all possible states for n binary nodes."""
    for idx in range(2 ** n):
        yield index_to_state(idx, n)


def marginalize(distribution: np.ndarray, keep_indices: Tuple[int, ...], n_nodes: int) -> np.ndarray:
    """
    Marginalize a distribution over nodes, keeping only specified indices.
    
    Args:
        distribution: Full distribution over 2^n_nodes states
        keep_indices: Indices of nodes to keep
        n_nodes: Total number of nodes
        
    Returns:
        Marginalized distribution over 2^len(keep_indices) states
    """
    if len(keep_indices) == n_nodes:
        return distribution.copy()
    
    n_keep = len(keep_indices)
    marginalized = np.zeros(2 ** n_keep, dtype=np.float64)
    
    for full_idx in range(len(distribution)):
        full_state = index_to_state(full_idx, n_nodes)
        # Extract kept nodes
        kept_state = tuple(full_state[i] for i in keep_indices)
        kept_idx = state_to_index(kept_state)
        marginalized[kept_idx] += distribution[full_idx]
    
    return marginalized


def expand_distribution(
    distribution: np.ndarray,
    source_indices: Tuple[int, ...],
    target_n: int
) -> np.ndarray:
    """
    Expand a distribution to include additional nodes (uniformly distributed).
    
    Args:
        distribution: Distribution over source nodes
        source_indices: Indices of source nodes in target
        target_n: Total number of nodes in target
        
    Returns:
        Expanded distribution
    """
    if len(source_indices) == target_n:
        return distribution.copy()
    
    expanded = np.zeros(2 ** target_n, dtype=np.float64)
    n_source = len(source_indices)
    n_extra = target_n - n_source
    
    # Each source state maps to 2^n_extra target states uniformly
    weight = 1.0 / (2 ** n_extra)
    
    for source_idx in range(len(distribution)):
        source_state = index_to_state(source_idx, n_source)
        
        # For each combination of extra node values
        extra_indices = [i for i in range(target_n) if i not in source_indices]
        for extra_idx in range(2 ** n_extra):
            extra_state = index_to_state(extra_idx, n_extra)
            
            # Build full state
            full_state = [0] * target_n
            for i, src_idx in enumerate(source_indices):
                full_state[src_idx] = source_state[i]
            for i, ext_idx in enumerate(extra_indices):
                full_state[ext_idx] = extra_state[i]
            
            full_idx = state_to_index(tuple(full_state))
            expanded[full_idx] = distribution[source_idx] * weight
    
    return expanded


def normalize(distribution: np.ndarray) -> np.ndarray:
    """Normalize a distribution to sum to 1."""
    total = distribution.sum()
    if total > 0:
        return distribution / total
    return distribution


def uniform_distribution(n: int) -> np.ndarray:
    """Create a uniform distribution over 2^n states."""
    return np.ones(2 ** n, dtype=np.float64) / (2 ** n)


def is_valid_probability_distribution(dist: np.ndarray, tol: float = 1e-6) -> bool:
    """Check if array is a valid probability distribution."""
    return (
        np.all(dist >= -tol) and 
        np.all(dist <= 1 + tol) and 
        abs(dist.sum() - 1.0) < tol
    )


def hamming_distance(state1: Tuple[int, ...], state2: Tuple[int, ...]) -> int:
    """Compute Hamming distance between two states."""
    return sum(s1 != s2 for s1, s2 in zip(state1, state2))
