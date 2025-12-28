---
description: Policy - No stubs allowed in production code
---

# No Stubs Policy

**CRITICAL RULE**: Stub implementations are NOT allowed in production code. All functionality must be fully implemented.

## What is prohibited

1. **Stub functions** - Functions that return placeholder values or throw "not implemented" errors
2. **TODO implementations** - Functions with `// TODO: implement` comments and no actual logic
3. **Placeholder returns** - Functions returning hardcoded values instead of real logic
4. **Empty handlers** - Event handlers or callbacks with no actual implementation

## What is a stub?

A stub is a placeholder implementation that:
- Returns a fixed value regardless of input
- Throws "NotImplementedError" or similar
- Contains only `// TODO` or `// FIXME` comments
- Has empty function bodies (`{}`)
- Returns `null`, `undefined`, or `[]` without any logic

## Example - WRONG ❌

```typescript
async function calculatePrice(items: Item[]): Promise<number> {
  // TODO: implement pricing logic
  return 0;
}

function processPayment(amount: number): PaymentResult {
  throw new Error('Not implemented');
}

const handleSubmit = () => {
  // stub
};
```

## Example - CORRECT ✅

```typescript
async function calculatePrice(items: Item[]): Promise<number> {
  let total = 0;
  for (const item of items) {
    const price = await getItemPrice(item.id);
    total += price * item.quantity;
  }
  return total;
}

function processPayment(amount: number): PaymentResult {
  const transaction = paymentGateway.charge(amount);
  return {
    success: transaction.status === 'completed',
    transactionId: transaction.id,
  };
}

const handleSubmit = async () => {
  setLoading(true);
  try {
    await submitForm(formData);
    showSuccess('Form submitted successfully');
  } catch (error) {
    showError('Submission failed');
  }
  setLoading(false);
};
```

## Enforcement

When reviewing or creating code:
1. Search for patterns: `// TODO`, `// FIXME`, `throw.*not implemented`, `() => {}`
2. Ensure all functions have complete implementations
3. If a feature isn't ready, don't create the stub - wait until it can be fully implemented
4. Use feature flags to disable incomplete features rather than shipping stubs

## Exceptions

The only acceptable "stub" is a feature flag that completely hides unimplemented functionality:

```typescript
if (FEATURE_FLAGS.newPaymentSystem) {
  // Full implementation here - not a stub
  return <NewPaymentForm />;
}
// Graceful fallback to existing system
return <ExistingPaymentForm />;
```
