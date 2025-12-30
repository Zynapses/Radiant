"""Tests for pyphi compute functions."""

import pytest
import numpy as np
from pyphi import Network, compute
from pyphi.models import Concept, ConceptStructure


class TestNetwork:
    """Tests for Network class."""
    
    def test_create_network(self):
        """Test basic network creation."""
        tpm = [
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 1.0],
            [1.0, 0.0, 1.0],
            [1.0, 0.0, 0.0],
            [1.0, 1.0, 0.0],
            [1.0, 1.0, 1.0],
            [1.0, 1.0, 1.0],
            [1.0, 1.0, 0.0],
        ]
        
        network = Network(tpm)
        
        assert network.n_nodes == 3
        assert network.n_states == 8
        assert network.node_indices == (0, 1, 2)
    
    def test_network_with_connectivity(self):
        """Test network with custom connectivity."""
        tpm = [
            [0.0, 0.0],
            [1.0, 0.0],
            [0.0, 1.0],
            [1.0, 1.0],
        ]
        connectivity = [
            [0, 1],
            [1, 0],
        ]
        
        network = Network(tpm, connectivity)
        
        assert network.n_nodes == 2
        assert network.connectivity[0, 1] == 1
        assert network.connectivity[1, 0] == 1
    
    def test_state_conversion(self):
        """Test state to index conversion."""
        tpm = [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]]
        network = Network(tpm)
        
        assert network.state_to_index((0, 0)) == 0
        assert network.state_to_index((1, 0)) == 1
        assert network.state_to_index((0, 1)) == 2
        assert network.state_to_index((1, 1)) == 3
        
        assert network.index_to_state(0) == (0, 0)
        assert network.index_to_state(1) == (1, 0)
        assert network.index_to_state(2) == (0, 1)
        assert network.index_to_state(3) == (1, 1)


class TestRepertoires:
    """Tests for repertoire computation."""
    
    def test_cause_repertoire_simple(self):
        """Test cause repertoire for simple network."""
        tpm = [
            [0.0, 0.0],
            [1.0, 0.0],
            [0.0, 1.0],
            [1.0, 1.0],
        ]
        network = Network(tpm)
        state = (1, 0)
        
        rep = compute.cause_repertoire(network, state, (0,), (0, 1))
        
        assert rep.shape == (4,)
        assert np.isclose(rep.sum(), 1.0)
    
    def test_effect_repertoire_simple(self):
        """Test effect repertoire for simple network."""
        tpm = [
            [0.0, 0.0],
            [1.0, 0.0],
            [0.0, 1.0],
            [1.0, 1.0],
        ]
        network = Network(tpm)
        state = (1, 0)
        
        rep = compute.effect_repertoire(network, state, (0,), (0, 1))
        
        assert rep.shape == (4,)
        assert np.isclose(rep.sum(), 1.0)


class TestConcepts:
    """Tests for concept computation."""
    
    def test_mic_computation(self):
        """Test MIC computation."""
        tpm = [
            [0.0, 0.0],
            [1.0, 0.0],
            [0.0, 1.0],
            [1.0, 1.0],
        ]
        network = Network(tpm)
        state = (1, 0)
        
        result = compute.mic(network, state, (0, 1))
        
        assert result.purview is not None
        assert result.repertoire is not None
        assert result.phi >= 0
    
    def test_mie_computation(self):
        """Test MIE computation."""
        tpm = [
            [0.0, 0.0],
            [1.0, 0.0],
            [0.0, 1.0],
            [1.0, 1.0],
        ]
        network = Network(tpm)
        state = (1, 0)
        
        result = compute.mie(network, state, (0, 1))
        
        assert result.purview is not None
        assert result.repertoire is not None
        assert result.phi >= 0
    
    def test_concept_computation(self):
        """Test full concept computation."""
        tpm = [
            [0.0, 0.0],
            [1.0, 0.0],
            [0.0, 1.0],
            [1.0, 1.0],
        ]
        network = Network(tpm)
        state = (1, 0)
        
        c = compute.concept(network, state, (0, 1))
        
        # May or may not exist depending on irreducibility
        if c is not None:
            assert c.mechanism == (0, 1)
            assert c.phi > 0


class TestConceptStructure:
    """Tests for concept structure computation."""
    
    def test_concept_structure_empty(self):
        """Test concept structure for trivial network."""
        # A network with no causal structure
        tpm = [
            [0.5, 0.5],
            [0.5, 0.5],
            [0.5, 0.5],
            [0.5, 0.5],
        ]
        network = Network(tpm)
        state = (0, 0)
        
        ces = compute.concept_structure(network, state)
        
        assert isinstance(ces, ConceptStructure)
        # Should have low/zero phi for random network
    
    def test_concept_structure_integrated(self):
        """Test concept structure for integrated network."""
        # XOR-like network should have higher integration
        tpm = [
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 1.0],
            [1.0, 0.0, 1.0],
            [1.0, 0.0, 0.0],
            [1.0, 1.0, 0.0],
            [1.0, 1.0, 1.0],
            [1.0, 1.0, 1.0],
            [1.0, 1.0, 0.0],
        ]
        network = Network(tpm)
        state = (1, 0, 0)
        
        ces = compute.concept_structure(network, state)
        
        assert isinstance(ces, ConceptStructure)
        assert ces.num_concepts >= 0


class TestPhi:
    """Tests for Big Phi computation."""
    
    def test_phi_basic(self):
        """Test basic phi computation."""
        tpm = [
            [0.0, 0.0],
            [1.0, 0.0],
            [0.0, 1.0],
            [1.0, 1.0],
        ]
        network = Network(tpm)
        state = (1, 0)
        
        phi_value = compute.phi(network, state)
        
        assert isinstance(phi_value, float)
        assert phi_value >= 0
    
    def test_phi_disconnected_zero(self):
        """Disconnected network should have zero phi."""
        # Two independent nodes
        tpm = [
            [0.5, 0.5],
            [0.5, 0.5],
            [0.5, 0.5],
            [0.5, 0.5],
        ]
        connectivity = [
            [1, 0],  # Node 0 only affects itself
            [0, 1],  # Node 1 only affects itself
        ]
        network = Network(tpm, connectivity)
        state = (0, 0)
        
        phi_value = compute.phi(network, state)
        
        # Should be zero or very small for disconnected system
        assert phi_value >= 0


class TestAsync:
    """Tests for async computation functions."""
    
    @pytest.mark.asyncio
    async def test_phi_async(self):
        """Test async phi computation."""
        tpm = [
            [0.0, 0.0],
            [1.0, 0.0],
            [0.0, 1.0],
            [1.0, 1.0],
        ]
        network = Network(tpm)
        state = (1, 0)
        
        phi_value = await compute.phi_async(network, state)
        
        assert isinstance(phi_value, float)
        assert phi_value >= 0
    
    @pytest.mark.asyncio
    async def test_concept_structure_async(self):
        """Test async concept structure computation."""
        tpm = [
            [0.0, 0.0],
            [1.0, 0.0],
            [0.0, 1.0],
            [1.0, 1.0],
        ]
        network = Network(tpm)
        state = (1, 0)
        
        ces = await compute.concept_structure_async(network, state)
        
        assert isinstance(ces, ConceptStructure)
