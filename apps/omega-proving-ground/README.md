# OMEGA Proving Ground

> **Disposable prototype** — Local learning, testing & firmware validation for OMEGA brains. No AWS required.

## Quick Start (Automated)

```bash
cd apps/omega-proving-ground
./demo/setup-and-run.sh
```

The script will:
1. Check/install Ollama
2. Pull `llama3.2:1b` (smallest model for fast demo, ~1.3GB)
3. Build the Swift app
4. Launch it

### Use a different model

```bash
OMEGA_MODEL=llama3.2 ./demo/setup-and-run.sh      # 3B (default quality)
OMEGA_MODEL=mistral ./demo/setup-and-run.sh        # 7B (better quality)
OMEGA_MODEL=llama3.1:70b ./demo/setup-and-run.sh   # 70B (if you have 48GB+ RAM)
```

## Manual Setup

```bash
# 1. Install Ollama
brew install ollama

# 2. Pull a model
ollama pull llama3.2:1b

# 3. Build
cd apps/omega-proving-ground
swift build

# 4. Run
swift run
```

## Demo Walkthrough

### 1. Playground — Chat with OMEGA
- Opens automatically connected to Ollama
- Select your model from the dropdown
- Chat to verify inference works
- See latency and token counts per message

### 2. Firmware — Load & Validate .bio
- Click **"Load Demo Firmware"** to load the bundled test firmware
- Review 25+ validation checks across 8 categories:
  - Schema, Safety Invariants, Behavioral, Routing, Compliance, Resources, Integrations, Security
- Click **"Apply to Brain"** to inject firmware settings into the inference engine
  - This sets the system prompt with all 9 safety invariants
  - Configures temperature, top-p, and token limits from firmware

### 3. Test Suites — Run Automated Tests
- 3 built-in suites ship with the app:
  - **OMEGA Safety Basics** (4 tests) — prompt injection, hallucination, harmful content
  - **OMEGA Functional Basics** (4 tests) — math, JSON, instruction following, code gen
  - **OMEGA Behavioral Consistency** (3 tests) — identity, language, conciseness
- Select a suite → **Run Suite** → tests execute against the selected model
- Create custom suites with your own prompts and pass/fail criteria

### 4. Results — Review Pass/Fail
- Historical test runs with drill-down
- See model response for each test case
- Failure reasons listed (missing keywords, forbidden content, latency exceeded)

### 5. Datasets — Training Data Management
- Create datasets with instruction/input/output samples
- Export as JSONL for fine-tuning

## Demo Datasets

| File | Samples | Content |
|------|---------|---------|
| `demo/datasets/omega-basics-small.jsonl` | 10 | Core OMEGA concepts |
| `demo/datasets/omega-comprehensive-large.jsonl` | 100 | Full OMEGA knowledge base |

## Demo Firmware

`demo/firmware/omega-test-v1.bio.json` — Complete test firmware with:
- 9 safety invariants (SI-01 through SI-09)
- 6 task routing rules (coding, creative, factual, medical, legal, analysis)
- GDPR + SOC2 compliance flags
- Resource limits ($100/day ceiling, 120 RPM)
- MCP server and A2A agent integration configs

## Architecture

```
Sources/OmegaProvingGround/
├── App/                    # App entry + state management
├── Models/                 # Data models (inference, test, training, firmware)
├── Services/               # Ollama client, test runner, firmware validator, storage
└── Views/                  # SwiftUI views (6 tabs)
```

**No AWS. No external dependencies. Pure Swift + Ollama.**

## Requirements

- macOS 13.0+
- Swift 5.9+ / Xcode 15+
- Ollama (free, https://ollama.com)
- Any Ollama-compatible model
