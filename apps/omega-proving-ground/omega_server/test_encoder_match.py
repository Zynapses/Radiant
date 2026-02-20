#!/usr/bin/env python3
"""Diagnostic: compare forward() vs forward_batch() outputs."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'packages', 'omega-core', 'python'))
import torch
from radiant_omega.trainer import TextEncoder

# Build a simple encoder with some vocab
enc = TextEncoder(input_dim=1024, embed_dim=256, max_vocab=5000, dropout=0.0)
texts = [
    "hi", "hello", "good morning", "hey there",
    "i want a big mac", "can i get a mcchicken",
    "what burgers do you have", "show me the menu",
    "no pickles on that", "extra cheese",
    "how much is a big mac", "my fries are cold",
]
enc.build_vocab(texts)
enc.eval()

print("Comparing forward() vs forward_batch() for novel queries:\n")
max_diff = 0.0
for text in texts:
    # forward() path (what infer_single uses)
    with torch.no_grad():
        single = enc.forward(text)  # [input_dim] complex

    # forward_batch() path (what training cache uses)
    with torch.no_grad():
        token_ids = enc.pre_tokenize_batch([text], max_len=32)  # [1, 32]
        batch = enc.forward_batch(token_ids)  # [1, input_dim] complex
        batch_single = batch[0]  # [input_dim]

    diff = torch.abs(single - batch_single).max().item()
    rel_diff = diff / (torch.abs(single).max().item() + 1e-8)
    max_diff = max(max_diff, diff)
    match = "MATCH" if diff < 1e-5 else "MISMATCH"
    print(f"  {match}: \"{text}\" — max_abs_diff={diff:.2e} rel_diff={rel_diff:.2e}")

print(f"\nMax absolute difference across all texts: {max_diff:.2e}")
if max_diff > 1e-4:
    print("WARNING: Significant mismatch between forward() and forward_batch()!")
    print("This means training and inference use DIFFERENT encodings.")
else:
    print("OK: forward() and forward_batch() produce consistent outputs.")
