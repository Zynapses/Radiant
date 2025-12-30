"""
Core IIT 4.0 computation functions.

Implements:
- Cause/effect repertoire computation
- Concept computation (maximally irreducible cause-effect repertoires)
- Concept structure unfolding
- Big Phi (system irreducibility) calculation
"""

from typing import Tuple, List, Optional, Dict, Any
from itertools import combinations
import numpy as np

from pyphi.network import Network
from pyphi.models import Concept, ConceptStructure, RepertoireResult, PartitionResult
from pyphi import utils
from pyphi.distance import repertoire_distance, extended_earth_movers_distance


def cause_repertoire(
    network: Network,
    state: Tuple[int, ...],
    mechanism: Tuple[int, ...],
    purview: Tuple[int, ...]
) -> np.ndarray:
    """
    Compute the cause repertoire of a mechanism over a purview.
    
    The cause repertoire is the probability distribution over past states
    of the purview, given the current state of the mechanism.
    
    Args:
        network: The network
        state: Current state
        mechanism: Mechanism nodes
        purview: Purview nodes (past)
        
    Returns:
        Probability distribution over purview states
    """
    if not purview:
        return np.array([1.0])
    
    if not mechanism:
        # No mechanism - uniform distribution
        return utils.uniform_distribution(len(purview))
    
    n_purview_states = 2 ** len(purview)
    repertoire = np.zeros(n_purview_states, dtype=np.float64)
    
    # For each possible past state of the purview
    for purview_state_idx in range(n_purview_states):
        purview_state = utils.index_to_state(purview_state_idx, len(purview))
        
        # Compute probability of this purview state causing current mechanism state
        prob = 1.0
        
        for mech_idx, mech_node in enumerate(mechanism):
            current_value = state[mech_node]
            
            # Get TPM entry for this mechanism node
            # Need to consider the purview state's effect on mechanism
            
            # Build full prior state with purview values
            prior_state = list(state)  # Start with current
            for p_idx, p_node in enumerate(purview):
                prior_state[p_node] = purview_state[p_idx]
            
            prior_state_idx = network.state_to_index(tuple(prior_state))
            
            # Probability that mechanism node has current value given prior state
            p_on = network.tpm[prior_state_idx, mech_node]
            
            if current_value == 1:
                prob *= p_on
            else:
                prob *= (1 - p_on)
        
        repertoire[purview_state_idx] = prob
    
    # Normalize
    return utils.normalize(repertoire)


def effect_repertoire(
    network: Network,
    state: Tuple[int, ...],
    mechanism: Tuple[int, ...],
    purview: Tuple[int, ...]
) -> np.ndarray:
    """
    Compute the effect repertoire of a mechanism over a purview.
    
    The effect repertoire is the probability distribution over future states
    of the purview, given the current state of the mechanism.
    
    Args:
        network: The network
        state: Current state
        mechanism: Mechanism nodes
        purview: Purview nodes (future)
        
    Returns:
        Probability distribution over purview states
    """
    if not purview:
        return np.array([1.0])
    
    if not mechanism:
        # No mechanism - use marginal distribution
        return utils.uniform_distribution(len(purview))
    
    n_purview_states = 2 ** len(purview)
    repertoire = np.zeros(n_purview_states, dtype=np.float64)
    
    # Get current state index
    current_state_idx = network.state_to_index(state)
    
    # For each possible future state of the purview
    for purview_state_idx in range(n_purview_states):
        purview_state = utils.index_to_state(purview_state_idx, len(purview))
        
        # Compute probability of purview transitioning to this state
        prob = 1.0
        
        for p_idx, p_node in enumerate(purview):
            future_value = purview_state[p_idx]
            
            # Probability that purview node transitions to future_value
            p_on = network.tpm[current_state_idx, p_node]
            
            if future_value == 1:
                prob *= p_on
            else:
                prob *= (1 - p_on)
        
        repertoire[purview_state_idx] = prob
    
    # Normalize
    return utils.normalize(repertoire)


def _compute_partitioned_repertoire(
    network: Network,
    state: Tuple[int, ...],
    partition: Tuple[Tuple[int, ...], Tuple[int, ...]],
    purview: Tuple[int, ...],
    direction: str
) -> np.ndarray:
    """
    Compute repertoire under a mechanism partition.
    
    Args:
        network: The network
        state: Current state
        partition: (mech_part1, mech_part2)
        purview: Purview nodes
        direction: "cause" or "effect"
        
    Returns:
        Partitioned repertoire
    """
    part1, part2 = partition
    
    repertoire_fn = cause_repertoire if direction == "cause" else effect_repertoire
    
    # Compute repertoires for each part
    if part1 and part2:
        # Both parts non-empty - product of marginals
        rep1 = repertoire_fn(network, state, part1, purview)
        rep2 = repertoire_fn(network, state, part2, purview)
        
        # Take element-wise product (independence assumption)
        partitioned = rep1 * rep2
        return utils.normalize(partitioned)
    elif part1:
        return repertoire_fn(network, state, part1, purview)
    elif part2:
        return repertoire_fn(network, state, part2, purview)
    else:
        return utils.uniform_distribution(len(purview))


def mic(
    network: Network,
    state: Tuple[int, ...],
    mechanism: Tuple[int, ...]
) -> RepertoireResult:
    """
    Compute the Maximally Irreducible Cause (MIC) for a mechanism.
    
    Searches over all purviews to find the one with maximum irreducibility.
    
    Args:
        network: The network
        state: Current state
        mechanism: Mechanism nodes
        
    Returns:
        RepertoireResult with best cause purview and repertoire
    """
    nodes = network.node_indices
    
    best_result = RepertoireResult(
        purview=(),
        repertoire=np.array([1.0]),
        phi=0.0
    )
    
    # Search over all non-empty purviews
    for r in range(1, len(nodes) + 1):
        for purview in combinations(nodes, r):
            # Compute cause repertoire
            rep = cause_repertoire(network, state, mechanism, purview)
            
            # Compute irreducibility
            if len(mechanism) < 2:
                phi = 0.0  # Single-node mechanisms have zero phi
            else:
                phi = _compute_cause_irreducibility(
                    network, state, mechanism, purview, rep
                )
            
            if phi > best_result.phi:
                best_result = RepertoireResult(
                    purview=purview,
                    repertoire=rep,
                    phi=phi
                )
    
    return best_result


def mie(
    network: Network,
    state: Tuple[int, ...],
    mechanism: Tuple[int, ...]
) -> RepertoireResult:
    """
    Compute the Maximally Irreducible Effect (MIE) for a mechanism.
    
    Searches over all purviews to find the one with maximum irreducibility.
    
    Args:
        network: The network
        state: Current state
        mechanism: Mechanism nodes
        
    Returns:
        RepertoireResult with best effect purview and repertoire
    """
    nodes = network.node_indices
    
    best_result = RepertoireResult(
        purview=(),
        repertoire=np.array([1.0]),
        phi=0.0
    )
    
    # Search over all non-empty purviews
    for r in range(1, len(nodes) + 1):
        for purview in combinations(nodes, r):
            # Compute effect repertoire
            rep = effect_repertoire(network, state, mechanism, purview)
            
            # Compute irreducibility
            if len(mechanism) < 2:
                phi = 0.0
            else:
                phi = _compute_effect_irreducibility(
                    network, state, mechanism, purview, rep
                )
            
            if phi > best_result.phi:
                best_result = RepertoireResult(
                    purview=purview,
                    repertoire=rep,
                    phi=phi
                )
    
    return best_result


def _compute_cause_irreducibility(
    network: Network,
    state: Tuple[int, ...],
    mechanism: Tuple[int, ...],
    purview: Tuple[int, ...],
    repertoire: np.ndarray
) -> float:
    """Compute irreducibility of a cause repertoire."""
    from pyphi.partition import all_bipartitions
    
    min_phi = float('inf')
    
    for partition in all_bipartitions(mechanism):
        part_rep = _compute_partitioned_repertoire(
            network, state, partition, purview, "cause"
        )
        phi = repertoire_distance(repertoire, part_rep)
        min_phi = min(min_phi, phi)
    
    return min_phi if min_phi != float('inf') else 0.0


def _compute_effect_irreducibility(
    network: Network,
    state: Tuple[int, ...],
    mechanism: Tuple[int, ...],
    purview: Tuple[int, ...],
    repertoire: np.ndarray
) -> float:
    """Compute irreducibility of an effect repertoire."""
    from pyphi.partition import all_bipartitions
    
    min_phi = float('inf')
    
    for partition in all_bipartitions(mechanism):
        part_rep = _compute_partitioned_repertoire(
            network, state, partition, purview, "effect"
        )
        phi = repertoire_distance(repertoire, part_rep)
        min_phi = min(min_phi, phi)
    
    return min_phi if min_phi != float('inf') else 0.0


def concept(
    network: Network,
    state: Tuple[int, ...],
    mechanism: Tuple[int, ...]
) -> Optional[Concept]:
    """
    Compute the concept specified by a mechanism.
    
    A concept exists only if the mechanism has positive phi (irreducibility).
    
    Args:
        network: The network
        state: Current state
        mechanism: Mechanism nodes
        
    Returns:
        Concept if phi > 0, else None
    """
    # Compute MIC and MIE
    cause = mic(network, state, mechanism)
    effect = mie(network, state, mechanism)
    
    # Concept's phi is minimum of cause and effect phi
    phi = min(cause.phi, effect.phi)
    
    if phi <= 0:
        return None
    
    return Concept(
        mechanism=mechanism,
        cause=cause,
        effect=effect,
        phi=phi
    )


def concept_structure(
    network: Network,
    state: Tuple[int, ...]
) -> ConceptStructure:
    """
    Unfold the full cause-effect structure (constellation of concepts).
    
    Computes concepts for all possible mechanisms in the network.
    
    Args:
        network: The network
        state: Current state
        
    Returns:
        ConceptStructure with all concepts
    """
    nodes = network.node_indices
    concepts = []
    
    # For each possible mechanism (non-empty subset of nodes)
    for r in range(1, len(nodes) + 1):
        for mechanism in combinations(nodes, r):
            c = concept(network, state, mechanism)
            if c is not None and c.phi > 0:
                concepts.append(c)
    
    # Compute Big Phi
    if not concepts:
        return ConceptStructure(concepts=[], phi=0.0)
    
    # Big Phi requires finding the MIP
    from pyphi.partition import find_system_mip
    
    ces = ConceptStructure(concepts=concepts, phi=0.0)
    mip_result = find_system_mip(network, state, ces)
    
    return ConceptStructure(
        concepts=concepts,
        phi=mip_result.phi,
        mip=mip_result.partition
    )


def _compute_partitioned_ces(
    network: Network,
    state: Tuple[int, ...],
    partition: Tuple[Tuple[int, ...], Tuple[int, ...]]
) -> ConceptStructure:
    """
    Compute concept structure under a system partition.
    
    Args:
        network: The network
        state: Current state
        partition: (part1, part2) system partition
        
    Returns:
        Partitioned concept structure
    """
    part1, part2 = partition
    
    concepts = []
    
    # Compute concepts for each part independently
    if part1:
        sub1 = network.subnetwork(part1)
        sub_state1 = tuple(state[i] for i in part1)
        
        for r in range(1, len(part1) + 1):
            for mechanism in combinations(range(len(part1)), r):
                # Map back to original indices
                orig_mechanism = tuple(part1[i] for i in mechanism)
                c = concept(sub1, sub_state1, mechanism)
                if c is not None and c.phi > 0:
                    # Remap mechanism to original indices
                    concepts.append(Concept(
                        mechanism=orig_mechanism,
                        cause=c.cause,
                        effect=c.effect,
                        phi=c.phi
                    ))
    
    if part2:
        sub2 = network.subnetwork(part2)
        sub_state2 = tuple(state[i] for i in part2)
        
        for r in range(1, len(part2) + 1):
            for mechanism in combinations(range(len(part2)), r):
                orig_mechanism = tuple(part2[i] for i in mechanism)
                c = concept(sub2, sub_state2, mechanism)
                if c is not None and c.phi > 0:
                    concepts.append(Concept(
                        mechanism=orig_mechanism,
                        cause=c.cause,
                        effect=c.effect,
                        phi=c.phi
                    ))
    
    return ConceptStructure(concepts=concepts, phi=0.0)


def phi(network: Network, state: Tuple[int, ...]) -> float:
    """
    Compute Big Phi (Φ) for a system in a state.
    
    Big Phi is the irreducibility of the system's cause-effect structure.
    
    Args:
        network: The network
        state: Current state
        
    Returns:
        Big Phi value (non-negative)
    """
    ces = concept_structure(network, state)
    return ces.phi


def mip(network: Network, state: Tuple[int, ...]) -> PartitionResult:
    """
    Find the Minimum Information Partition (MIP) of a system.
    
    Args:
        network: The network
        state: Current state
        
    Returns:
        PartitionResult with MIP and Big Phi
    """
    ces = concept_structure(network, state)
    
    # The MIP is already computed during concept_structure
    from pyphi.partition import find_system_mip
    return find_system_mip(network, state, ces)


# Async versions for integration with consciousness services

async def phi_async(network: Network, state: Tuple[int, ...]) -> float:
    """Async version of phi computation."""
    return phi(network, state)


async def concept_structure_async(
    network: Network,
    state: Tuple[int, ...]
) -> ConceptStructure:
    """Async version of concept structure computation."""
    return concept_structure(network, state)


async def mip_async(network: Network, state: Tuple[int, ...]) -> PartitionResult:
    """Async version of MIP computation."""
    return mip(network, state)
