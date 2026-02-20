#!/bin/bash
# ============================================================================
# OMEGA McDonalds Training Runner — with full logging
# Usage: bash run-training.sh
# Logs:  ./training.log (append mode)
# ============================================================================

set -e

LOG="$(dirname "$0")/training.log"
DATASET_DIR="$(dirname "$0")/apps/mcdonalds-drive-thru/datasets"
SERVER_DIR="$(dirname "$0")/omega_server"
MERGED_DATA="/Users/robertlong/Downloads/OMEGA Training Data - McDonalds - merged.jsonl"
KNOWLEDGE_SRC="/Users/robertlong/CascadeProjects/Radiant/apps/omega-lab/data/mcdonalds-knowledge.json"
SERVER_URL="http://localhost:11435"
TARGET_ACCURACY=0.999

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

log "========================================"
log "OMEGA Training Runner — START"
log "========================================"

# --- Step 0: Diagnostics + cache clear ---
log "STEP 0: System diagnostics"
log "  Python: $(python3 --version 2>&1)"
log "  Node:   $(node --version 2>&1)"
log "  PWD:    $(pwd)"
log "  Merged data: $MERGED_DATA"
log "  Knowledge:   $KNOWLEDGE_SRC"
log "  Dataset dir: $DATASET_DIR"

# Clear __pycache__ to ensure updated BEHAVIOR_TYPES (v2: 13 classes) is loaded
OMEGA_PKG="/Users/robertlong/CascadeProjects/Radiant/packages/omega-core/python/radiant_omega/__pycache__"
if [ -d "$OMEGA_PKG" ]; then
    rm -rf "$OMEGA_PKG"
    log "  Cleared radiant_omega __pycache__ (BEHAVIOR_TYPES expanded to 13 classes)"
fi

# --- Step 1: Copy data ---
log "STEP 1: Copying merged training data + knowledge base"

if [ ! -f "$MERGED_DATA" ]; then
    log "ERROR: Merged training data not found at: $MERGED_DATA"
    exit 1
fi

if [ ! -f "$KNOWLEDGE_SRC" ]; then
    log "ERROR: Knowledge base not found at: $KNOWLEDGE_SRC"
    exit 1
fi

ORIG_LINES=$(wc -l < "$DATASET_DIR/mcdonalds-behavioral-training.jsonl" 2>/dev/null || echo "0")
log "  Original training data: $ORIG_LINES lines"

cp "$MERGED_DATA" "$DATASET_DIR/mcdonalds-behavioral-training.jsonl"
cp "$KNOWLEDGE_SRC" "$DATASET_DIR/mcdonalds-knowledge.json"

NEW_LINES=$(wc -l < "$DATASET_DIR/mcdonalds-behavioral-training.jsonl")
log "  New training data: $NEW_LINES lines"
log "  Knowledge base copied OK"

# --- Step 2: Check if server is running ---
log "STEP 2: Checking OMEGA server"

if curl -s "$SERVER_URL/health" > /dev/null 2>&1; then
    log "  Server already running at $SERVER_URL"
else
    log "  Server not running — starting in background..."
    cd "$SERVER_DIR"
    python3 server.py >> "$LOG" 2>&1 &
    SERVER_PID=$!
    log "  Server PID: $SERVER_PID"
    
    # Wait for server to come up (max 30s)
    for i in $(seq 1 30); do
        if curl -s "$SERVER_URL/health" > /dev/null 2>&1; then
            log "  Server ready after ${i}s"
            break
        fi
        sleep 1
        if [ "$i" -eq 30 ]; then
            log "ERROR: Server failed to start within 30s"
            log "  Check $LOG for server output"
            exit 1
        fi
    done
fi

HEALTH=$(curl -s "$SERVER_URL/health")
log "  Health: $HEALTH"

# --- Step 3: Boot brain ---
log "STEP 3: Booting OMEGA brain"
BOOT_RESULT=$(curl -s -X POST "$SERVER_URL/boot" -H 'Content-Type: application/json' -d '{}')
log "  Boot result: $(echo "$BOOT_RESULT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"booted={d.get(\"booted\",\"?\")} inferences={d.get(\"inference_count\",0)}")' 2>/dev/null || echo "$BOOT_RESULT")"

# --- Step 4: Load training data ---
log "STEP 4: Loading training data + knowledge base into trainer"
LOAD_RESULT=$(curl -s -X POST "$SERVER_URL/train/load" \
    -H 'Content-Type: application/json' \
    -d '{"model": "llama3.2:1b"}')
log "  Load result: $(echo "$LOAD_RESULT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"examples={d.get(\"training_examples\",0)} behaviors={d.get(\"behavior_types\",0)} llama={d.get(\"llama_available\",\"?\")}"); [print(f"  ERROR: {d[\"error\"]}") for _ in [1] if "error" in d]' 2>/dev/null || echo "$LOAD_RESULT")"

# Check for load error
if echo "$LOAD_RESULT" | python3 -c 'import sys,json; d=json.load(sys.stdin); exit(0 if "error" not in d else 1)' 2>/dev/null; then
    log "  Training data loaded successfully"
else
    log "ERROR: Failed to load training data"
    log "  Full response: $LOAD_RESULT"
    exit 1
fi

# --- Step 5: Training phases ---
run_phase() {
    local phase_num=$1
    local lr=$2
    local epochs=$3
    local desc=$4
    
    log ""
    log "STEP 5.$phase_num: Training Phase $phase_num — $desc (LR=$lr, epochs=$epochs)"
    log "  Started at: $(date '+%H:%M:%S')"
    
    TRAIN_RESULT=$(curl -s -X POST "$SERVER_URL/train/run" \
        -H 'Content-Type: application/json' \
        -d "{\"epochs\": $epochs, \"target_accuracy\": $TARGET_ACCURACY, \"learning_rate\": $lr}")
    
    ACCURACY=$(echo "$TRAIN_RESULT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("final_accuracy", 0))' 2>/dev/null || echo "?")
    BEST=$(echo "$TRAIN_RESULT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("best_accuracy", 0))' 2>/dev/null || echo "?")
    EPOCHS_RUN=$(echo "$TRAIN_RESULT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("epochs_run", 0))' 2>/dev/null || echo "?")
    LOSS=$(echo "$TRAIN_RESULT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("final_loss", 0))' 2>/dev/null || echo "?")
    
    log "  Completed at: $(date '+%H:%M:%S')"
    log "  Epochs run: $EPOCHS_RUN"
    log "  Final accuracy: $ACCURACY"
    log "  Best accuracy:  $BEST"
    log "  Final loss:     $LOSS"
    
    # Check if we hit target
    HIT_TARGET=$(echo "$ACCURACY" | python3 -c "import sys; a=float(sys.stdin.read().strip()); print('yes' if a >= $TARGET_ACCURACY else 'no')" 2>/dev/null || echo "no")
    if [ "$HIT_TARGET" = "yes" ]; then
        log "  ✅ TARGET ACCURACY REACHED: $ACCURACY >= $TARGET_ACCURACY"
        return 0
    else
        log "  ⏳ Below target, continuing..."
        return 1
    fi
}

# Run training phases (stop early if target hit)
run_phase 1 0.01  100 "Initial training (fast convergence)" && DONE=1 || DONE=0
if [ "$DONE" -eq 0 ]; then
    run_phase 2 0.003 100 "Fine-tune (break through plateau)" && DONE=1
fi
if [ "$DONE" -eq 0 ]; then
    run_phase 3 0.001 100 "Class-weight refinement" && DONE=1
fi
if [ "$DONE" -eq 0 ]; then
    run_phase 4 0.0003 100 "Final polish" && DONE=1
fi
if [ "$DONE" -eq 0 ]; then
    run_phase 5 0.0001 100 "Ultra-fine polish" && DONE=1
fi

# --- Step 6: Final evaluation ---
log ""
log "STEP 6: Final evaluation"
EVAL_RESULT=$(curl -s -X POST "$SERVER_URL/train/evaluate")
log "  Evaluation: $(echo "$EVAL_RESULT" | python3 -m json.tool 2>/dev/null || echo "$EVAL_RESULT")"

# --- Step 7: Save checkpoint ---
log ""
log "STEP 7: Saving checkpoint"
SAVE_RESULT=$(curl -s -X POST "$SERVER_URL/train/save")
log "  Save result: $(echo "$SAVE_RESULT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"saved={d.get(\"saved\",\"?\")} path={d.get(\"path\",\"?\")}")' 2>/dev/null || echo "$SAVE_RESULT")"

log ""
log "========================================"
log "OMEGA Training Runner — COMPLETE"
log "========================================"
log "Log file: $LOG"
