#!/usr/bin/env python3
"""
Full OMEGA retraining — optimized for M3 MPS GPU + balanced dataset.

Strategy:
- RECALIBRATE TextEncoder on balanced dataset (learns discriminative embeddings)
- Warm-start from existing encoder weights (preserves vocabulary)
- Retrain cortex ODE with cosine LR annealing + best-state restore
- 100 epochs with cosine LR anneal → full convergence
- batch_size=512 saturates M3 GPU compute units

Dataset: 51k examples, balanced across all 13 behaviors (augmented weak classes)
"""

import sys, time, torch, logging
from pathlib import Path

# ── Route ALL logging to stdout so training progress is visible ──
logging.basicConfig(
    level=logging.INFO,
    format='  [%(name)s] %(message)s',
    stream=sys.stdout,
    force=True,
)

# Add omega package to path
_OMEGA_PKG = str(Path(__file__).resolve().parents[3] / 'packages' / 'omega-core' / 'python')
if _OMEGA_PKG not in sys.path:
    sys.path.insert(0, _OMEGA_PKG)

from radiant_omega.physics import OmegaCortex, PhysicsConfig as CortexConfig
from radiant_omega.trainer import (
    BehavioralCodebook, OmegaTrainer, load_training_data, BEHAVIOR_TYPES,
)

# ── Config ──
STATE_DIR = Path(__file__).parent / 'state'
CKPT_PATH = STATE_DIR / 'checkpoints' / 'omega_mcdonalds.pt'
DATASET_DIR = Path(__file__).resolve().parents[1] / 'apps' / 'mcdonalds-drive-thru' / 'datasets'
TRAINING_PATH = DATASET_DIR / 'mcdonalds-behavioral-training.jsonl'

BEHAVIORAL_EPOCHS = 120   # Full training with encoder recal + cortex ODE + gentle boost
BEHAVIORAL_LR = 0.01
BEHAVIORAL_BS = 512       # Large batch — saturate M3 GPU
ODE_STEPS = 8             # 8 steps proven better than 12 for this architecture
TARGET_ACC = 0.995  # Force full training — model already starts at ~98% from checkpoint

# ── Device ──
device = 'mps' if torch.backends.mps.is_available() else 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"[retrain] Device: {device}")
if device == 'mps':
    print(f"[retrain] M3 GPU detected — using MPS with batch_size={BEHAVIORAL_BS}")

# 1. Create cortex
config = CortexConfig(hidden_dim=2048, input_dim=1024, device=device)
cortex = OmegaCortex(config)

# 2. Load checkpoint
print(f"[retrain] Loading checkpoint: {CKPT_PATH}")
checkpoint = torch.load(str(CKPT_PATH), weights_only=False, map_location=device)
cortex.load_state_dict(checkpoint['cortex_state'])
print(f"[retrain] Checkpoint epoch={checkpoint.get('epoch')}, acc={checkpoint.get('best_accuracy', 0):.1%}")

# 3. Create codebook + trainer
codebook = BehavioralCodebook(hidden_dim=config.hidden_dim, device=device)

trainer = OmegaTrainer(cortex=cortex, codebook=codebook, lr=BEHAVIORAL_LR)
trainer.batch_size = BEHAVIORAL_BS
trainer.training_steps = ODE_STEPS
trainer.alignment_temperature = 15.0  # Optimal — round 3 proved 15.0 best (10.0 too soft, 18.0 too sharp)
trainer.focal_gamma = 2.0  # Focal loss: down-weight easy examples, focus on hard confused ones

# 4. Restore TextEncoder weights as WARM START (allow recalibration)
if checkpoint.get('text_encoder_state'):
    trainer.text_encoder.load_state_dict(checkpoint['text_encoder_state'])
    trainer.text_encoder.to(device)
if checkpoint.get('text_encoder_vocab'):
    trainer.text_encoder.word_to_idx = checkpoint['text_encoder_vocab']
    trainer.text_encoder.idx_to_word = {v: k for k, v in checkpoint['text_encoder_vocab'].items()}
    trainer.text_encoder.vocab_built = True

# DO NOT set _encoder_calibrated — let trainer recalibrate on balanced dataset
# This learns discriminative embeddings that separate confusing behavior pairs
trainer._encoder_calibrated = False

# Round 11: Fix Round 10 regressions
# Round 10 fixed "make it a large" → split_size_selection ✓
# But: take_order dropped to 96.6%, order_modify borderline at 97.0%
# New failure: "actually change the Big Mac to a Quarter Pounder" → combo_entree_swap (should be order_modify)
# Added 287 examples (152 order_modify with "change X to Y" no-combo patterns, 135 take_order)
trainer.class_weight_boost = {
    'order_modify': 1.2,            # Restore "change X to Y" without combo context
    'take_order': 1.2,              # Restore above 97% after split_size_selection flood
}
print(f"[retrain] TextEncoder will RECALIBRATE on balanced data — {ODE_STEPS} ODE steps — cosine LR anneal")
print(f"[retrain] Class weight boost: {trainer.class_weight_boost}")

# 5. Load training data (balanced: ~50k examples, all 13 behaviors)
print(f"[retrain] Loading training data: {TRAINING_PATH}")
examples = load_training_data(str(TRAINING_PATH))
print(f"[retrain] {len(examples)} training examples")

# 6. Rebuild vocab to include new words from augmented data
print("[retrain] Rebuilding vocabulary...")
trainer.build_vocab(examples)

# ═══════════════════════════════════════════════════════════════════
# Behavioral ODE Training
# ═══════════════════════════════════════════════════════════════════
est_min = BEHAVIORAL_EPOCHS * 35 // 60  # ~35s/epoch with 12 ODE steps
print(f"\n[retrain] ═══ Behavioral ODE training ({BEHAVIORAL_EPOCHS} epochs, bs={BEHAVIORAL_BS}, steps={ODE_STEPS}) ═══")
print(f"[retrain] Cosine LR: {BEHAVIORAL_LR} → ~0 over {BEHAVIORAL_EPOCHS} epochs")
print(f"[retrain] Estimated: ~{est_min} min on MPS")
t0 = time.time()
metrics = trainer.train(examples, epochs=BEHAVIORAL_EPOCHS, target_accuracy=TARGET_ACC)
train_time = time.time() - t0
print(f"[retrain] Training took {train_time:.0f}s ({train_time/60:.1f} min)")

# ═══════════════════════════════════════════════════════════════════
# Results
# ═══════════════════════════════════════════════════════════════════
if metrics:
    final = metrics[-1]
    print(f"\n[retrain] ═══ Results ═══")
    print(f"  Overall accuracy: {final.behavior_accuracy:.1%}")
    print(f"  Best accuracy: {trainer.best_accuracy:.1%}")
    print(f"  Epochs run: {len(metrics)}")
    print(f"  Per-behavior:")
    weak_ok = True
    for b, acc in sorted(final.per_behavior_accuracy.items()):
        marker = ""
        if acc < 0.97:
            marker = " ⚠ BELOW 97%"
            weak_ok = False
        print(f"    {b:30s} {acc:.1%}{marker}")
    if weak_ok:
        print(f"\n  ✅ All behaviors above 97% target!")
    else:
        print(f"\n  ⚠ Some behaviors below 97% — may need more augmentation")

# Save checkpoint
print(f"\n[retrain] Saving checkpoint to {CKPT_PATH}")
save_data = {
    'cortex_state': cortex.state_dict(),
    'brain_state': cortex.state,
    'codebook_state': dict(codebook.codebook),
    'readout_state': None,
    'text_encoder_state': trainer.text_encoder.state_dict(),
    'text_encoder_vocab': trainer.text_encoder.word_to_idx,
    'epoch': trainer.epoch,
    'best_accuracy': trainer.best_accuracy,
}
CKPT_PATH.parent.mkdir(parents=True, exist_ok=True)
torch.save(save_data, str(CKPT_PATH))
print(f"[retrain] Checkpoint saved. Best accuracy: {trainer.best_accuracy:.1%}")

# ═══════════════════════════════════════════════════════════════════
# Comprehensive classification test — all 13 behaviors
# ═══════════════════════════════════════════════════════════════════
print("\n[retrain] ═══ Classification test (all behaviors) ═══")
test_phrases = [
    # take_order (core ordering)
    ("I would like a Big Mac combo please", "take_order"),
    ("give me a McChicken", "take_order"),
    ("can I get a large fries", "take_order"),
    ("let me get a 10 piece nuggets", "take_order"),
    ("I'll have a Quarter Pounder with Cheese", "take_order"),
    # take_order_breakfast
    ("I'll have an Egg McMuffin", "take_order_breakfast"),
    ("give me the hotcakes and sausage", "take_order_breakfast"),
    ("can I get a sausage biscuit", "take_order_breakfast"),
    # price_inquiry (asking about cost)
    ("how much is the Big Mac", "price_inquiry"),
    ("what's the price on a Quarter Pounder", "price_inquiry"),
    ("how much for a 10 piece nuggets", "price_inquiry"),
    # menu_inquiry (what's available)
    ("what's on the dollar menu", "menu_inquiry"),
    ("what kind of chicken sandwiches do you have", "menu_inquiry"),
    ("do you have salads", "menu_inquiry"),
    # value_recommendation (what should I get / deals)
    ("what do you recommend", "value_recommendation"),
    ("what's the best deal right now", "value_recommendation"),
    ("I'm on a budget what should I get", "value_recommendation"),
    # greet
    ("hi there", "greet"),
    ("hello", "greet"),
    # complaint
    ("this food is cold", "complaint"),
    ("my order is wrong", "complaint"),
    # time_check
    ("is breakfast still available", "time_check"),
    ("what time do you close", "time_check"),
    # order_modify
    ("actually change the Big Mac to a Quarter Pounder", "order_modify"),
    ("remove the fries from my order", "order_modify"),
    # customize
    ("no pickles on that", "customize"),
    ("can I get extra cheese", "customize"),
    # combo_entree_swap
    ("swap the Big Mac for a McChicken in my combo", "combo_entree_swap"),
    # meal_substitution
    ("replace the fries with apple slices", "meal_substitution"),
    # split_size_selection
    ("make it a large", "split_size_selection"),
]
trainer.text_encoder.eval()
correct = 0
per_beh_correct = {}
per_beh_total = {}
for text, expected in test_phrases:
    with torch.no_grad():
        input_vec = trainer.text_encoder(text)
        cortex.state = torch.zeros(config.hidden_dim, dtype=torch.complex64, device=device)
        cortex.pfc.dt = trainer.training_dt
        output = cortex.think(input_vec)
        behavior, confidence = codebook.decode(output)
    ok = behavior == expected
    correct += ok
    per_beh_total[expected] = per_beh_total.get(expected, 0) + 1
    per_beh_correct[expected] = per_beh_correct.get(expected, 0) + (1 if ok else 0)
    status = "✓" if ok else "✗"
    print(f"  {status} \"{text}\" → {behavior} ({confidence:.1%}) [expected: {expected}]")

print(f"\n[retrain] Test: {correct}/{len(test_phrases)} correct ({correct/len(test_phrases):.0%})")
print(f"[retrain] Per-behavior test accuracy:")
for b in sorted(per_beh_total.keys()):
    c, t = per_beh_correct.get(b, 0), per_beh_total[b]
    print(f"  {b:30s} {c}/{t}")
print(f"[retrain] Total time: {train_time/60:.1f} min")
print("[retrain] Done!")
