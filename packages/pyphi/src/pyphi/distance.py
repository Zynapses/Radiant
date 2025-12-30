"""
Distance measures for comparing probability distributions and concept structures.
"""

from typing import List, Tuple
import numpy as np
from scipy.special import rel_entr
from scipy.optimize import linear_sum_assignment

from pyphi.models import Concept, ConceptStructure


def kl_divergence(p: np.ndarray, q: np.ndarray) -> float:
    """
    Compute KL divergence D_KL(P || Q).
    
    Args:
        p: True distribution
        q: Approximate distribution
        
    Returns:
        KL divergence (non-negative)
    """
    # Clip to avoid log(0)
    p = np.clip(p, 1e-10, 1.0)
    q = np.clip(q, 1e-10, 1.0)
    
    # Normalize
    p = p / p.sum()
    q = q / q.sum()
    
    return float(np.sum(rel_entr(p, q)))


def symmetric_kl(p: np.ndarray, q: np.ndarray) -> float:
    """
    Symmetric KL divergence (Jensen-Shannon style but using sum).
    
    Args:
        p: First distribution
        q: Second distribution
        
    Returns:
        Symmetric KL divergence
    """
    return (kl_divergence(p, q) + kl_divergence(q, p)) / 2


def earth_movers_distance(p: np.ndarray, q: np.ndarray) -> float:
    """
    Earth Mover's Distance (1D Wasserstein) between distributions.
    
    For discrete distributions, this is computed as the sum of absolute
    differences of cumulative distributions.
    
    Args:
        p: First distribution
        q: Second distribution
        
    Returns:
        EMD (non-negative)
    """
    # Ensure same length
    if len(p) != len(q):
        raise ValueError(f"Distribution lengths don't match: {len(p)} vs {len(q)}")
    
    # Normalize
    p = np.asarray(p, dtype=np.float64)
    q = np.asarray(q, dtype=np.float64)
    
    p_sum = p.sum()
    q_sum = q.sum()
    
    if p_sum > 0:
        p = p / p_sum
    if q_sum > 0:
        q = q / q_sum
    
    # Cumulative distributions
    p_cumsum = np.cumsum(p)
    q_cumsum = np.cumsum(q)
    
    # EMD is integral of |F_p - F_q|
    return float(np.sum(np.abs(p_cumsum - q_cumsum)))


def repertoire_distance(r1: np.ndarray, r2: np.ndarray, method: str = "emd") -> float:
    """
    Compute distance between two repertoires (probability distributions).
    
    Args:
        r1: First repertoire
        r2: Second repertoire
        method: Distance method - "emd" (Earth Mover's), "kl" (symmetric KL)
        
    Returns:
        Distance (non-negative)
    """
    if method == "emd":
        return earth_movers_distance(r1, r2)
    elif method == "kl":
        return symmetric_kl(r1, r2)
    else:
        raise ValueError(f"Unknown distance method: {method}")


def concept_distance(c1: Concept, c2: Concept) -> float:
    """
    Compute distance between two concepts.
    
    The distance considers both cause and effect repertoires,
    weighted by their respective phi values.
    
    Args:
        c1: First concept
        c2: Second concept
        
    Returns:
        Concept distance
    """
    # Check mechanism match
    if c1.mechanism != c2.mechanism:
        # Different mechanisms - use maximum distance based on phi
        return c1.phi + c2.phi
    
    # Same mechanism - compare repertoires
    cause_dist = repertoire_distance(c1.cause_repertoire, c2.cause_repertoire)
    effect_dist = repertoire_distance(c1.effect_repertoire, c2.effect_repertoire)
    
    # Weight by phi values
    phi_weight = min(c1.phi, c2.phi)
    
    return phi_weight * (cause_dist + effect_dist) / 2


def extended_earth_movers_distance(ces1: ConceptStructure, ces2: ConceptStructure) -> float:
    """
    Extended Earth Mover's Distance between concept structures.
    
    This is the IIT measure of distance between constellations of concepts.
    It treats concepts as points in "qualia space" with phi as mass.
    
    Args:
        ces1: First concept structure
        ces2: Second concept structure
        
    Returns:
        Extended EMD
    """
    if not ces1.concepts and not ces2.concepts:
        return 0.0
    
    if not ces1.concepts:
        return sum(c.phi for c in ces2.concepts)
    
    if not ces2.concepts:
        return sum(c.phi for c in ces1.concepts)
    
    # Build cost matrix
    n1 = len(ces1.concepts)
    n2 = len(ces2.concepts)
    
    # Add dummy concepts for unmatched
    max_n = max(n1, n2)
    cost_matrix = np.zeros((max_n, max_n), dtype=np.float64)
    
    for i in range(max_n):
        for j in range(max_n):
            if i < n1 and j < n2:
                cost_matrix[i, j] = concept_distance(ces1.concepts[i], ces2.concepts[j])
            elif i < n1:
                # Unmatched concept from ces1
                cost_matrix[i, j] = ces1.concepts[i].phi
            elif j < n2:
                # Unmatched concept from ces2
                cost_matrix[i, j] = ces2.concepts[j].phi
    
    # Solve assignment problem
    row_ind, col_ind = linear_sum_assignment(cost_matrix)
    
    total_cost = cost_matrix[row_ind, col_ind].sum()
    
    return float(total_cost)


def intrinsic_difference(ces1: ConceptStructure, ces2: ConceptStructure) -> float:
    """
    Compute intrinsic difference between concept structures.
    
    This is the irreducibility measure - how much the integrated
    structure differs from a partitioned structure.
    
    Args:
        ces1: Unpartitioned concept structure
        ces2: Partitioned concept structure
        
    Returns:
        Intrinsic difference (Big Phi)
    """
    return extended_earth_movers_distance(ces1, ces2)
