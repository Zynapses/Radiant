"""
PyPhi - IIT 4.0 Integrated Information Calculator

A clean-room Apache 2.0 licensed implementation of Integrated Information Theory (IIT) 4.0
for calculating Φ (phi) - the mathematical measure of consciousness.

Based on:
    Albantakis L, et al. (2023) Integrated information theory (IIT) 4.0:
    formulating the properties of phenomenal existence in physical terms.
    PLoS Computational Biology 19(10): e1011465.
"""

__version__ = "1.0.0"
__author__ = "Radiant Team"
__license__ = "Apache-2.0"

from pyphi.network import Network
from pyphi.models import Concept, ConceptStructure, RepertoireResult
from pyphi import compute

__all__ = [
    "Network",
    "Concept", 
    "ConceptStructure",
    "RepertoireResult",
    "compute",
    "__version__",
]
