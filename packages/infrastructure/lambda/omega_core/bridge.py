# ============================================================================
# SHIM — Re-exports from packages/omega-core/python/radiant_omega/bridge.py
# DO NOT add logic here. All OMEGA core code lives in the radiant_omega package.
# See: .windsurf/workflows/omega-package-policy.md
# ============================================================================

import sys
from pathlib import Path

_OMEGA_PKG = str(Path(__file__).resolve().parents[3] / 'omega-core' / 'python')
if _OMEGA_PKG not in sys.path:
    sys.path.insert(0, _OMEGA_PKG)

from radiant_omega.bridge import *  # noqa: F401,F403
