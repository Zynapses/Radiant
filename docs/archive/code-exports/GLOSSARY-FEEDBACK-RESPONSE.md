# Response to Glossary Feedback

**Re: Section 1 - AI & Machine Learning Terms**

---

Thank you for taking the time to review our glossary! Your observations are spot-on, and I'd like to address each point.

---

## On Definition Consistency

You're right - the definitions aren't consistent in style. Looking at your examples:

- **RLHF**: "Reinforcement Learning from Human Feedback - aligning AI with human preferences"
- **Few-Shot Learning**: "Teaching models with minimal examples"
- **Temperature**: "Controls randomness in LLM output"

These follow three different patterns. We'll standardize them to always answer: *What is it?* followed by *What does it do?*

---

## On the Token Definition

**Token is an industry-standard term.** The definition we use (roughly 4 characters or 0.75 words) is the commonly accepted approximation across the industry.

However, the *exact* tokenization varies by provider - OpenAI, Anthropic, and Google each use slightly different algorithms. We should add a note clarifying this is an industry standard with implementation variations.

---

## On Adding Neural Network

Agreed - we should add it. Here's the key distinction:

- **Neural Network**: The foundational architecture - layers of connected nodes that learn patterns from data. Can be used for images, audio, games, language, and more.

- **LLM**: A specific *type* of neural network designed for language.

**Simple rule**: All LLMs are neural networks, but not all neural networks are LLMs.

---

## On Adding AI

Absolutely. Here's the hierarchy:

```
AI (the broad field)
  > Machine Learning
    > Deep Learning
      > Neural Networks
        > LLMs
```

When people say "AI wrote this," they usually mean an LLM. But AI as a field includes everything from chess programs to self-driving cars to spam filters.

---

## On "Model" Usage

In our glossary, **"model" is used broadly** - it means any trained AI system. This includes:

- Language models (LLMs) - text
- Vision models - images
- Audio models - speech
- Multimodal models - multiple types

We should add "Model" as a term and be more precise: when we mean language specifically, we'll say "LLM" or "language model."

---

## Actions We'll Take

1. Standardize all definitions to follow the same format
2. Add: AI, Neural Network, Model
3. Add note to Token about industry-standard variations
4. Add a terminology hierarchy diagram at the top of Section 1

---

*Thank you for helping us improve the documentation!*
