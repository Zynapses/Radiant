"""
Partition finding algorithms for IIT computations.
"""

from typing import Tuple, List, Optional, Dict, Any
from itertools import combinations
import numpy as np

from pyphi.network import Network
from pyphi.models import ConceptStructure, PartitionResult
from pyphi import utils


def all_bipartitions(nodes: Tuple[int, ...]) -> List[Tuple[Tuple[int, ...], Tuple[int, ...]]]:
    """
    Generate all bipartitions of a set of nodes.
    
    A bipartition divides nodes into two non-empty disjoint subsets.
    
    Args:
        nodes: Tuple of node indices
        
    Returns:
        List of (part1, part2) tuples
    """
    partitions = []
    n = len(nodes)
    
    if n < 2:
        return partitions
    
    for k in range(1, n):
        for part1 in combinations(nodes, k):
            part2 = tuple(n for n in nodes if n not in part1)
            partitions.append((part1, part2))
    
    return partitions


def cut_mechanism(
    network: Network,
    mechanism: Tuple[int, ...],
    purview: Tuple[int, ...],
    partition: Tuple[Tuple[int, ...], Tuple[int, ...]]
) -> Tuple[Tuple[Tuple[int, ...], Tuple[int, ...]], Tuple[Tuple[int, ...], Tuple[int, ...]]]:
    """
    Apply a partition (cut) to a mechanism-purview pair.
    
    Returns the partitioned mechanism and purview parts.
    
    Args:
        network: The network
        mechanism: Mechanism nodes
        purview: Purview nodes
        partition: (mech_part1, mech_part2) partition of mechanism
        
    Returns:
        ((mech1, purview1), (mech2, purview2)) cut parts
    """
    mech_part1, mech_part2 = partition
    
    # Determine which purview nodes each mechanism part connects to
    purview1 = []
    purview2 = []
    
    for p in purview:
        # Check connectivity from each mechanism part
        conn_from_1 = any(network.connectivity[m, p] for m in mech_part1) if mech_part1 else False
        conn_from_2 = any(network.connectivity[m, p] for m in mech_part2) if mech_part2 else False
        
        if conn_from_1 and not conn_from_2:
            purview1.append(p)
        elif conn_from_2 and not conn_from_1:
            purview2.append(p)
        else:
            # Connected to both or neither - assign to smaller part
            if len(purview1) <= len(purview2):
                purview1.append(p)
            else:
                purview2.append(p)
    
    return (
        (mech_part1, tuple(purview1)),
        (mech_part2, tuple(purview2))
    )


def find_mip_for_mechanism(
    network: Network,
    state: Tuple[int, ...],
    mechanism: Tuple[int, ...],
    purview: Tuple[int, ...],
    repertoire: np.ndarray,
    direction: str = "cause"
) -> Tuple[Tuple[Tuple[int, ...], Tuple[int, ...]], float]:
    """
    Find the Minimum Information Partition for a specific mechanism-purview pair.
    
    Args:
        network: The network
        state: Current state
        mechanism: Mechanism nodes
        purview: Purview nodes
        repertoire: Unpartitioned repertoire
        direction: "cause" or "effect"
        
    Returns:
        (partition, phi) - the MIP and its phi value
    """
    if len(mechanism) < 2:
        # Can't partition a single node
        return ((mechanism, ()), tuple()), 0.0
    
    min_phi = float('inf')
    mip = ((mechanism, ()), tuple())
    
    # Check all bipartitions of the mechanism
    for partition in all_bipartitions(mechanism):
        # Compute partitioned repertoire
        from pyphi.compute import _compute_partitioned_repertoire
        
        part_rep = _compute_partitioned_repertoire(
            network, state, partition, purview, direction
        )
        
        # Compute distance
        from pyphi.distance import repertoire_distance
        phi = repertoire_distance(repertoire, part_rep)
        
        if phi < min_phi:
            min_phi = phi
            mip = partition
    
    return mip, min_phi


def find_system_mip(
    network: Network,
    state: Tuple[int, ...],
    unpartitioned_ces: ConceptStructure
) -> PartitionResult:
    """
    Find the Minimum Information Partition for the entire system.
    
    The MIP is the partition that makes the least difference to the
    system's cause-effect structure.
    
    Args:
        network: The network
        state: Current state
        unpartitioned_ces: The unpartitioned concept structure
        
    Returns:
        PartitionResult with MIP, Big Phi, and concept structures
    """
    nodes = network.node_indices
    
    if len(nodes) < 2:
        return PartitionResult(
            partition=(nodes, ()),
            phi=0.0,
            unpartitioned_ces=unpartitioned_ces,
            partitioned_ces=ConceptStructure(concepts=[], phi=0.0)
        )
    
    min_phi = float('inf')
    mip = (nodes, ())
    best_partitioned_ces = None
    
    # Check all bipartitions
    for partition in all_bipartitions(nodes):
        # Compute partitioned concept structure
        from pyphi.compute import _compute_partitioned_ces
        
        part_ces = _compute_partitioned_ces(network, state, partition)
        
        # Compute distance (Big Phi for this partition)
        from pyphi.distance import extended_earth_movers_distance
        phi = extended_earth_movers_distance(unpartitioned_ces, part_ces)
        
        if phi < min_phi:
            min_phi = phi
            mip = partition
            best_partitioned_ces = part_ces
    
    if best_partitioned_ces is None:
        best_partitioned_ces = ConceptStructure(concepts=[], phi=0.0)
    
    return PartitionResult(
        partition=mip,
        phi=min_phi,
        unpartitioned_ces=unpartitioned_ces,
        partitioned_ces=best_partitioned_ces
    )


def is_trivial_partition(partition: Tuple[Tuple[int, ...], Tuple[int, ...]]) -> bool:
    """Check if a partition is trivial (one part is empty)."""
    return len(partition[0]) == 0 or len(partition[1]) == 0
