"""
Network representation for IIT computations.
"""

from typing import Optional, List, Tuple, Union
import numpy as np


class Network:
    """
    A network of nodes with a transition probability matrix (TPM).
    
    The TPM defines the causal structure of the network - how the state
    of each node at time t+1 depends on the state of all nodes at time t.
    
    Args:
        tpm: Transition probability matrix. Can be in state-by-state format
             (2^n x 2^n) or state-by-node format (2^n x n).
        connectivity: Optional connectivity matrix (n x n) indicating which
                     nodes can causally influence which other nodes.
        node_labels: Optional labels for nodes.
    """
    
    def __init__(
        self,
        tpm: Union[np.ndarray, List[List[float]]],
        connectivity: Optional[Union[np.ndarray, List[List[int]]]] = None,
        node_labels: Optional[List[str]] = None
    ):
        self.tpm = np.array(tpm, dtype=np.float64)
        self._validate_tpm()
        
        # Determine number of nodes from TPM shape
        if self.tpm.ndim == 2:
            n_states = self.tpm.shape[0]
            self._n_nodes = int(np.log2(n_states))
        else:
            raise ValueError("TPM must be 2-dimensional")
        
        # Set up connectivity
        if connectivity is not None:
            self.connectivity = np.array(connectivity, dtype=np.int32)
            self._validate_connectivity()
        else:
            # Full connectivity by default
            self.connectivity = np.ones((self._n_nodes, self._n_nodes), dtype=np.int32)
        
        # Node labels
        if node_labels is not None:
            if len(node_labels) != self._n_nodes:
                raise ValueError(f"Expected {self._n_nodes} labels, got {len(node_labels)}")
            self.node_labels = node_labels
        else:
            self.node_labels = [f"n{i}" for i in range(self._n_nodes)]
        
        # Cache for computed values
        self._cache = {}
    
    def _validate_tpm(self) -> None:
        """Validate TPM structure."""
        if self.tpm.ndim != 2:
            raise ValueError("TPM must be 2-dimensional")
        
        n_states = self.tpm.shape[0]
        if n_states == 0 or (n_states & (n_states - 1)) != 0:
            raise ValueError("Number of rows must be a power of 2")
        
        # Check if state-by-state or state-by-node
        if self.tpm.shape[1] == n_states:
            # State-by-state format - convert to state-by-node
            self._convert_to_state_by_node()
        elif self.tpm.shape[1] != int(np.log2(n_states)):
            raise ValueError(
                f"TPM shape {self.tpm.shape} invalid. Expected ({n_states}, {n_states}) "
                f"or ({n_states}, {int(np.log2(n_states))})"
            )
        
        # Validate probabilities
        if np.any(self.tpm < 0) or np.any(self.tpm > 1):
            raise ValueError("TPM values must be between 0 and 1")
    
    def _convert_to_state_by_node(self) -> None:
        """Convert state-by-state TPM to state-by-node format."""
        n_states = self.tpm.shape[0]
        n_nodes = int(np.log2(n_states))
        
        new_tpm = np.zeros((n_states, n_nodes), dtype=np.float64)
        
        for state_idx in range(n_states):
            row = self.tpm[state_idx]
            for node in range(n_nodes):
                # Probability that this node is ON in the next state
                prob_on = 0.0
                for next_state_idx in range(n_states):
                    if (next_state_idx >> node) & 1:
                        prob_on += row[next_state_idx]
                new_tpm[state_idx, node] = prob_on
        
        self.tpm = new_tpm
    
    def _validate_connectivity(self) -> None:
        """Validate connectivity matrix."""
        if self.connectivity.shape != (self._n_nodes, self._n_nodes):
            raise ValueError(
                f"Connectivity shape {self.connectivity.shape} doesn't match "
                f"expected ({self._n_nodes}, {self._n_nodes})"
            )
    
    @property
    def n_nodes(self) -> int:
        """Number of nodes in the network."""
        return self._n_nodes
    
    @property
    def n_states(self) -> int:
        """Number of possible states (2^n_nodes)."""
        return 2 ** self._n_nodes
    
    @property
    def node_indices(self) -> Tuple[int, ...]:
        """Tuple of all node indices."""
        return tuple(range(self._n_nodes))
    
    def get_tpm_for_state(self, state: Tuple[int, ...]) -> np.ndarray:
        """
        Get the TPM row for a specific state.
        
        Args:
            state: Current state as tuple of 0s and 1s
            
        Returns:
            Probabilities for each node being ON in next state
        """
        state_idx = self.state_to_index(state)
        return self.tpm[state_idx]
    
    def state_to_index(self, state: Tuple[int, ...]) -> int:
        """Convert state tuple to index."""
        idx = 0
        for i, val in enumerate(state):
            if val:
                idx |= (1 << i)
        return idx
    
    def index_to_state(self, idx: int) -> Tuple[int, ...]:
        """Convert index to state tuple."""
        return tuple((idx >> i) & 1 for i in range(self._n_nodes))
    
    def get_inputs(self, node: int) -> Tuple[int, ...]:
        """Get indices of nodes that can causally influence the given node."""
        return tuple(i for i in range(self._n_nodes) if self.connectivity[i, node])
    
    def get_outputs(self, node: int) -> Tuple[int, ...]:
        """Get indices of nodes that the given node can causally influence."""
        return tuple(i for i in range(self._n_nodes) if self.connectivity[node, i])
    
    def subnetwork(self, nodes: Tuple[int, ...]) -> 'Network':
        """
        Create a subnetwork with only the specified nodes.
        
        Args:
            nodes: Indices of nodes to include
            
        Returns:
            New Network with only the specified nodes
        """
        nodes = sorted(nodes)
        n_sub = len(nodes)
        
        # Build new TPM
        new_tpm = np.zeros((2 ** n_sub, n_sub), dtype=np.float64)
        
        for sub_state_idx in range(2 ** n_sub):
            # Convert to full state
            full_state = [0] * self._n_nodes
            for i, node in enumerate(nodes):
                if (sub_state_idx >> i) & 1:
                    full_state[node] = 1
            full_state_idx = self.state_to_index(tuple(full_state))
            
            # Extract probabilities for subnetwork nodes
            for i, node in enumerate(nodes):
                new_tpm[sub_state_idx, i] = self.tpm[full_state_idx, node]
        
        # Build new connectivity
        new_conn = np.zeros((n_sub, n_sub), dtype=np.int32)
        for i, node_i in enumerate(nodes):
            for j, node_j in enumerate(nodes):
                new_conn[i, j] = self.connectivity[node_i, node_j]
        
        # Build new labels
        new_labels = [self.node_labels[n] for n in nodes]
        
        return Network(new_tpm, new_conn, new_labels)
    
    def __repr__(self) -> str:
        return f"Network(n_nodes={self._n_nodes}, labels={self.node_labels})"
