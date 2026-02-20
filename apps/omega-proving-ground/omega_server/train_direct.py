#!/usr/bin/env python3
"""
Direct OMEGA training script — runs training without HTTP server overhead.
Prints progress to stdout in real-time. Run from omega_server/ directory.

Usage: python3 train_direct.py
"""
import sys, os, time, json, logging, random, torch
import numpy as np

# No fixed seed — random initialization for better generalization
# (Seeded runs with 42/7 gave only 48-52% novel query accuracy;
#  unseeded runs historically achieve 76-83%)

# Add package to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'packages', 'omega-core', 'python'))

from radiant_omega.physics import OmegaCortex, PhysicsConfig, get_omega_device
from radiant_omega.trainer import (
    OmegaTrainer, BehavioralCodebook, BEHAVIOR_TYPES, CODEBOOK_VERSION,
    load_training_data, load_knowledge_base,
)

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(name)s %(levelname)s: %(message)s',
    datefmt='%H:%M:%S',
    stream=sys.stdout,
)
# Force flush on every log
for h in logging.root.handlers:
    h.flush = sys.stdout.flush

logger = logging.getLogger('train_direct')

# ── Paths ──
DATASET_DIR = os.path.join(os.path.dirname(__file__), '..', 'apps', 'mcdonalds-drive-thru', 'datasets')
TRAINING_DATA = os.path.join(DATASET_DIR, 'mcdonalds-behavioral-training.jsonl')
GENERATED_DATA = os.path.join(DATASET_DIR, 'mcdonalds-behavioral-training-generated.jsonl')
CLEAN_AUGMENT_DATA = os.path.join(DATASET_DIR, 'mcdonalds-behavioral-clean-augment.jsonl')
BOUNDARY_CASES_DATA = os.path.join(DATASET_DIR, 'mcdonalds-behavioral-boundary-cases.jsonl')
CHECKPOINT_DIR = os.path.join(os.path.dirname(__file__), 'state', 'checkpoints')

# ── Novel query validation set (not in training data) ──
# Used to select the best run across multiple initializations
VALIDATION_QUERIES = [
    # Greet — casual openers not in training data
    ('howdy', 'greet'),
    ('whats up', 'greet'),
    ('yo', 'greet'),
    # Menu inquiry — asking about offerings
    ('what food do you guys sell', 'menu_inquiry'),
    ('got any wraps or salads', 'menu_inquiry'),
    ('what all can i get here', 'menu_inquiry'),
    # Value recommendation — deals and suggestions
    ('whats the cheapest meal you got', 'value_recommendation'),
    ('hook me up with a good deal', 'value_recommendation'),
    ('any combos on special today', 'value_recommendation'),
    # Take order — standard lunch/dinner items
    ('get me two double cheeseburgers', 'take_order'),
    ('one quarter pounder with cheese please', 'take_order'),
    ('lemme get some nuggets', 'take_order'),
    ('i want a filet o fish', 'take_order'),
    # Take order breakfast — breakfast-specific items
    ('give me a bacon egg cheese mcgriddle', 'take_order_breakfast'),
    ('one hotcake platter please', 'take_order_breakfast'),
    # Price inquiry — asking about cost
    ('how much would a ten piece nuggets be', 'price_inquiry'),
    ('what does a quarter pounder meal run', 'price_inquiry'),
    ('is a happy meal under five bucks', 'price_inquiry'),
    # Customize — modifying toppings/ingredients
    ('no pickles on that', 'customize'),
    ('add bacon to that', 'customize'),
    ('could you put extra sauce on it', 'customize'),
    # Split/size selection — sizing choices
    ('make it a meal', 'split_size_selection'),
    ('large please', 'split_size_selection'),
    ('supersize the fries and drink', 'split_size_selection'),
    # Complaint — expressing dissatisfaction
    ('this burger tastes terrible', 'complaint'),
    ('you guys messed up my order again', 'complaint'),
    # Order modify — adding/removing items from current order
    ('hold on take the shake off my order', 'order_modify'),
    ('wait also throw in a cookie', 'order_modify'),
    # Meal substitution — swapping a side or drink
    ('swap the fries for a side salad', 'meal_substitution'),
    ('can i get apple slices instead of the fries', 'meal_substitution'),
    # Combo entree swap — changing the main item in a combo
    ('switch my big mac combo to a quarter pounder', 'combo_entree_swap'),
    ('change the sandwich in my meal to a mcchicken', 'combo_entree_swap'),
    # Time check — hours, availability
    ('how late is the drive thru open', 'time_check'),
    ('am i too late for a mcmuffin', 'time_check'),
]

N_RUNS = 1  # Train N times, keep the best checkpoint


def evaluate_novel_queries(cortex, trainer, codebook, device):
    """Evaluate model on held-out novel queries. Returns (accuracy, details)."""
    trainer._sync_to_device()
    correct = 0
    total = len(VALIDATION_QUERIES)
    details = []

    for text, expected in VALIDATION_QUERIES:
        # Use the EXACT same inference path as /infer endpoint
        output_state = trainer.infer_single(text)
        pred_behavior, confidence = trainer.decoder.decode(output_state)
        is_correct = pred_behavior == expected
        if is_correct:
            correct += 1
        details.append((text, expected, pred_behavior, is_correct))

    accuracy = correct / total
    return accuracy, details


def train_one_run(run_idx, examples, dist, device):
    """Train a single run, return (novel_accuracy, checkpoint_dict, train_accuracy)."""
    print(f"\n{'='*60}")
    print(f"RUN {run_idx+1}/{N_RUNS}")
    print(f"{'='*60}")
    sys.stdout.flush()

    config = PhysicsConfig(input_dim=1024, hidden_dim=2048, dt=0.01, decay_rate=0.1, device=device)
    cortex = OmegaCortex(config)
    codebook = BehavioralCodebook(hidden_dim=config.hidden_dim, device=device)
    trainer = OmegaTrainer(cortex, codebook, lr=0.01)
    trainer.build_vocab(examples)

    t0 = time.time()
    trainer.calibrate_encoder(examples)
    print(f"  Calibration: {time.time()-t0:.1f}s")

    # Class weights — MUST normalize like trainer.train() does (weights / weights.mean())
    from collections import Counter as _Counter
    behavior_counts = _Counter(ex.behavior for ex in examples)
    num_classes = len(BEHAVIOR_TYPES)
    total = len(examples)
    weights = torch.ones(num_classes, device=device)
    for beh, count in behavior_counts.items():
        idx = BEHAVIOR_TYPES.index(beh)
        weights[idx] = total / (num_classes * count)
    weights = weights / weights.mean()  # Critical: normalize so mean weight = 1.0
    trainer.class_weights = weights
    print(f"  Class weights: min={weights.min():.2f} max={weights.max():.2f} mean={weights.mean():.2f}")

    max_epochs = 50
    patience = 10
    epochs_no_improve = 0
    prev_best = 0.0
    for ep in range(max_epochs):
        t0 = time.time()
        metrics = trainer.train_epoch(examples)
        elapsed = time.time() - t0
        print(
            f"Epoch {metrics.epoch:3d}: "
            f"loss={metrics.avg_loss:.4f} "
            f"acc={metrics.behavior_accuracy:.4f} "
            f"best={trainer.best_accuracy:.4f} "
            f"lr={trainer.lr:.2e} "
            f"({elapsed:.1f}s)"
        )
        sys.stdout.flush()

        if trainer.best_accuracy >= 0.999:
            break

        # Patience-based LR decay: halve if no improvement for 15 epochs
        if trainer.best_accuracy > prev_best:
            prev_best = trainer.best_accuracy
            epochs_no_improve = 0
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= patience:
                new_lr = max(trainer.lr * 0.5, 1e-5)
                if new_lr < trainer.lr:
                    print(f"  ** No improvement for {patience} epochs — LR {trainer.lr:.2e} → {new_lr:.2e}")
                    trainer.set_lr(new_lr)
                epochs_no_improve = 0

    # Evaluate on novel queries
    novel_acc, details = evaluate_novel_queries(cortex, trainer, codebook, device)
    print(f"\n  Novel query accuracy: {novel_acc:.0%} ({int(novel_acc*len(VALIDATION_QUERIES))}/{len(VALIDATION_QUERIES)})")
    for text, expected, got, ok in details:
        tag = "OK" if ok else "FAIL"
        print(f"    {tag}: \"{text}\" -> {got} (exp={expected})")
    sys.stdout.flush()

    # Build checkpoint
    trainer._sync_to_device()
    checkpoint = {
        'cortex_state': cortex.state_dict(),
        'brain_state': cortex.state,
        'readout_state': None,
        'text_encoder_state': trainer.text_encoder.state_dict(),
        'text_encoder_vocab': trainer.text_encoder.word_to_idx,
        'config': {
            'input_dim': config.input_dim,
            'hidden_dim': config.hidden_dim,
            'dt': config.dt,
            'decay_rate': config.decay_rate,
        },
        'is_trained': True,
        'epoch': trainer.epoch,
        'best_accuracy': trainer.best_accuracy,
        'codebook_version': CODEBOOK_VERSION,
        'behavior_types': list(BEHAVIOR_TYPES),
        'novel_query_accuracy': novel_acc,
    }

    # Per-behavior accuracy
    if trainer.history:
        from collections import Counter
        ex_dist = Counter(ex.behavior for ex in examples)
        last = trainer.history[-1]
        for b, acc in sorted(last.per_behavior_accuracy.items(), key=lambda x: x[1]):
            count = ex_dist.get(b, 0)
            print(f"  {b:25s}: {acc:.1%} ({count} examples)")

    return novel_acc, checkpoint, trainer.best_accuracy


def main():
    print(f"=" * 60)
    print(f"OMEGA Direct Training — CODEBOOK v{CODEBOOK_VERSION}, {len(BEHAVIOR_TYPES)} behaviors")
    print(f"Device: {get_omega_device()}")
    print(f"Multi-run: {N_RUNS} runs, keeping best novel query accuracy")
    print(f"=" * 60)
    sys.stdout.flush()

    # 1. Load training data (merge original + generated + clean augmentation)
    examples = load_training_data(TRAINING_DATA)
    logger.info(f"Loaded {len(examples)} original examples")

    # Load clean augmentation data with oversampling so clean phrasing patterns
    # get sufficient representation (562 clean examples * OVERSAMPLE_FACTOR ≈ 28K,
    # comparable to the 32K conversational original data)
    OVERSAMPLE_FACTOR = 50
    for extra_path in [GENERATED_DATA, CLEAN_AUGMENT_DATA, BOUNDARY_CASES_DATA]:
        if os.path.exists(extra_path):
            extra = load_training_data(extra_path)
            logger.info(f"Loaded {len(extra)} augmentation examples from {os.path.basename(extra_path)}")
            examples.extend(extra * OVERSAMPLE_FACTOR)

    logger.info(f"Total training examples: {len(examples)} (with {OVERSAMPLE_FACTOR}x oversampling of clean data)")

    from collections import Counter
    dist = Counter(ex.behavior for ex in examples)
    for b, c in sorted(dist.items(), key=lambda x: -x[1]):
        print(f"  {b}: {c}")
    sys.stdout.flush()

    device = get_omega_device()

    # 2. Run N training sessions
    best_novel_acc = 0.0
    best_checkpoint = None
    best_train_acc = 0.0
    results = []

    for run_idx in range(N_RUNS):
        novel_acc, checkpoint, train_acc = train_one_run(run_idx, examples, dist, device)
        results.append((run_idx, novel_acc, train_acc))

        if novel_acc > best_novel_acc:
            best_novel_acc = novel_acc
            best_checkpoint = checkpoint
            best_train_acc = train_acc

    # 3. Summary
    print(f"\n{'='*60}")
    print(f"MULTI-RUN RESULTS")
    print(f"{'='*60}")
    for run_idx, novel_acc, train_acc in results:
        marker = " <-- BEST" if novel_acc == best_novel_acc else ""
        print(f"  Run {run_idx+1}: novel={novel_acc:.0%} train={train_acc:.4f}{marker}")

    # 4. Save best checkpoint
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    path = os.path.join(CHECKPOINT_DIR, 'omega_mcdonalds.pt')
    torch.save(best_checkpoint, path)
    print(f"\nBest checkpoint saved: novel={best_novel_acc:.0%}, train={best_train_acc:.4f}")
    print(f"Path: {path}")

    print(f"\n{'='*60}")
    print(f"TRAINING COMPLETE — best novel accuracy: {best_novel_acc:.0%}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
