#!/bin/bash
set -e

# ============================================================
# OMEGA Proving Ground — Automated Demo Setup & Run
# ============================================================
# This script:
#   1. Checks/installs Ollama
#   2. Pulls a small model (llama3.2:1b for fast demo)
#   3. Builds the Swift app
#   4. Launches it
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MODEL="${OMEGA_MODEL:-llama3.2:1b}"

echo "╔══════════════════════════════════════════════════╗"
echo "║    OMEGA Proving Ground — Demo Setup             ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Check Ollama ─────────────────────────────────
echo "▸ Step 1: Checking Ollama installation..."
if command -v ollama &>/dev/null; then
    echo "  ✓ Ollama found: $(which ollama)"
else
    echo "  ✗ Ollama not found."
    echo ""
    echo "  Install Ollama:"
    echo "    brew install ollama"
    echo "    — or —"
    echo "    Download from https://ollama.com"
    echo ""
    read -p "  Install via Homebrew now? [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "  Installing Ollama via Homebrew..."
        brew install ollama
    else
        echo "  Aborted. Install Ollama and re-run this script."
        exit 1
    fi
fi

# ── Step 2: Ensure Ollama is running ─────────────────────
echo ""
echo "▸ Step 2: Ensuring Ollama is running..."
if curl -s http://localhost:11434/api/tags &>/dev/null; then
    echo "  ✓ Ollama server is running"
else
    echo "  Starting Ollama server in background..."
    ollama serve &>/dev/null &
    OLLAMA_PID=$!
    sleep 3
    if curl -s http://localhost:11434/api/tags &>/dev/null; then
        echo "  ✓ Ollama server started (PID: $OLLAMA_PID)"
    else
        echo "  ✗ Failed to start Ollama. Start it manually: ollama serve"
        exit 1
    fi
fi

# ── Step 3: Pull model ──────────────────────────────────
echo ""
echo "▸ Step 3: Checking model '$MODEL'..."
if ollama list 2>/dev/null | grep -q "$MODEL"; then
    echo "  ✓ Model '$MODEL' already available"
else
    echo "  Pulling model '$MODEL' (this may take a few minutes)..."
    ollama pull "$MODEL"
    echo "  ✓ Model pulled successfully"
fi

# Show available models
echo ""
echo "  Available models:"
ollama list 2>/dev/null | head -10 | while read -r line; do
    echo "    $line"
done

# ── Step 4: Build app ───────────────────────────────────
echo ""
echo "▸ Step 4: Building OMEGA Proving Ground..."
cd "$PROJECT_DIR"
swift build 2>&1 | tail -3
echo "  ✓ Build complete"

# ── Step 5: Validate demo firmware ──────────────────────
echo ""
echo "▸ Step 5: Demo firmware check..."
FIRMWARE="$SCRIPT_DIR/firmware/omega-test-v1.bio.json"
if [ -f "$FIRMWARE" ]; then
    echo "  ✓ Demo firmware: $FIRMWARE"
    echo "    $(python3 -c "import json; f=json.load(open('$FIRMWARE')); print(f'  Name: {f[\"metadata\"][\"name\"]}, Version: {f[\"firmware_version\"]}, Safety Rules: {len(f[\"safety_invariants\"][\"rules\"])}')" 2>/dev/null || echo "    (firmware present)")"
else
    echo "  ⚠ Demo firmware not found at $FIRMWARE"
fi

# ── Step 6: Check datasets ──────────────────────────────
echo ""
echo "▸ Step 6: Demo datasets check..."
SMALL="$SCRIPT_DIR/datasets/omega-basics-small.jsonl"
LARGE="$SCRIPT_DIR/datasets/omega-comprehensive-large.jsonl"
if [ -f "$SMALL" ]; then
    SMALL_COUNT=$(wc -l < "$SMALL" | tr -d ' ')
    echo "  ✓ Small dataset: $SMALL_COUNT samples"
fi
if [ -f "$LARGE" ]; then
    LARGE_COUNT=$(wc -l < "$LARGE" | tr -d ' ')
    echo "  ✓ Large dataset: $LARGE_COUNT samples"
fi

# ── Step 7: Launch ──────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║    Setup Complete — Launching App                ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "║  Model:    $MODEL"
echo "║  Firmware: omega-test-v1.bio.json                ║"
echo "║  Datasets: small ($SMALL_COUNT) + large ($LARGE_COUNT)     ║"
echo "║                                                  ║"
echo "║  DEMO STEPS:                                     ║"
echo "║  1. Playground → chat with model                 ║"
echo "║  2. Firmware → Load Demo → Apply to Brain        ║"
echo "║  3. Test Suites → select suite → Run Suite       ║"
echo "║  4. Results → review pass/fail details           ║"
echo "║                                                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

cd "$PROJECT_DIR"
swift run
