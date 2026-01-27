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

**THIS IS MANDATORY. NO EXCEPTIONS.**

When reviewing or creating code:
1. Search for patterns: `// TODO`, `// FIXME`, `throw.*not implemented`, `() => {}`, `mock`, `stub`, `placeholder`
2. Ensure all functions have complete implementations
3. If a feature isn't ready, don't create the stub - wait until it can be fully implemented
4. Use feature flags to disable incomplete features rather than shipping stubs

### Pre-Commit Checklist

Before marking ANY feature complete:
```
□ No `// TODO` or `// FIXME` comments remain
□ No functions returning hardcoded mock data
□ No `throw new Error('not implemented')`
□ No empty function bodies
□ No "In production, this would..." comments
□ No "For now, return placeholder" patterns
□ All navigation links point to real, implemented pages
□ All UI "Coming Soon" items are either implemented or removed
□ All service methods call real APIs/databases, not simulations
```

### Prohibited Patterns (Auto-Reject)

```typescript
// ❌ NEVER DO THIS:
return mockResponse;
return { simulated: true };
// In production, this would...
// For now, return placeholder
throw new Error('Not implemented');
const stub = () => {};
// TODO: implement
// FIXME: complete this
```

### "Coming Soon" Rule

**DO NOT create UI that links to unimplemented pages.**

If a feature is not implemented:
1. Do NOT add it to navigation
2. Do NOT create a "Coming Soon" placeholder page
3. Do NOT mention it in the UI

Only add features to the UI when they are **fully functional**.

## Exceptions

The ONLY acceptable pattern is a feature flag that completely hides unimplemented functionality:

```typescript
if (FEATURE_FLAGS.newPaymentSystem) {
  // Full implementation here - not a stub
  return <NewPaymentForm />;
}
// Graceful fallback to existing system
return <ExistingPaymentForm />;
```

## Consequences

If stubs are discovered in "completed" code:
1. The feature is NOT complete
2. Must be fixed immediately before any other work
3. Documentation must be updated to reflect actual status

**A feature with stubs is a LIE to the user. Do not lie.**

## AI Agent Mandatory Behavior

**THIS POLICY APPLIES TO ALL AI CODING AGENTS (Windsurf, Cursor, Claude, etc.)**

### Before Writing ANY Code

1. **STOP** if you are about to write a stub, placeholder, or "coming soon" implementation
2. **ASK** the user if now is the appropriate time to implement the full feature
3. **WAIT** until the feature can be fully implemented rather than creating technical debt

### Legitimate Reasons to Defer (NOT Stub)

These are the ONLY valid reasons to not implement something NOW:

1. **Missing external dependency** - e.g., waiting for a third-party API that doesn't exist yet
2. **User explicitly requests deferral** - User says "skip this for now"
3. **Requires hardware/infrastructure not available** - e.g., GPU cluster for training
4. **Blocked by incomplete prerequisite** - e.g., database table doesn't exist yet

### NOT Valid Reasons

These are NOT acceptable excuses for stubs:

- ❌ "It's complex" - Complex is fine, implement it
- ❌ "It would take too long" - Take the time needed
- ❌ "I'm not sure of the exact implementation" - Research and implement
- ❌ "The user didn't specify details" - Ask for clarification
- ❌ "It's not the main focus" - If you're touching it, finish it

### If You Must Defer

If there is a LEGITIMATE reason to defer:

1. **Do NOT create the stub** - Leave the code path absent entirely
2. **Document in a tracking file** - Add to `PENDING-IMPLEMENTATIONS.md`
3. **Tell the user explicitly** - "I am not implementing X because [legitimate reason]"
4. **Never pretend it's done** - No "coming soon" UI, no empty functions

## Detection Commands

Run these to find violations:

```bash
# Find TODO/FIXME comments
grep -r "// TODO\|// FIXME\|// HACK" packages/ apps/ --include="*.ts" --include="*.tsx"

# Find placeholder returns
grep -r "return \[\];\|return {};\|return null;\|return 0;" packages/ apps/ --include="*.ts" | grep -v test

# Find "coming soon" UI
grep -r "coming soon\|Coming Soon\|COMING_SOON" apps/ --include="*.tsx"

# Find stub patterns
grep -r "throw.*[Nn]ot.*[Ii]mplemented\|// [Ss]tub\|// [Pp]laceholder" packages/ apps/ --include="*.ts"
```

## This Policy is MANDATORY

This is not a suggestion. This is a hard requirement.

**Every AI agent reading this file MUST comply. No exceptions. No excuses.**
