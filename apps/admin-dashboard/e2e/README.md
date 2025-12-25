# RADIANT Admin Dashboard E2E Tests

End-to-end tests for the Admin Dashboard using Playwright.

## Setup

```bash
# Install Playwright and dependencies
npm install -D @playwright/test
npx playwright install
```

## Running Tests

```bash
# Run all tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific test file
npx playwright test tests/auth.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed
```

## Test Structure

- `tests/smoke.spec.ts` - Basic smoke tests (page loads, no JS errors)
- `tests/auth.spec.ts` - Authentication flow tests

## CI/CD Integration

Tests are configured to run in CI with:
- Single worker (to avoid race conditions)
- 2 retries on failure
- HTML and JSON reporters

## Adding New Tests

1. Create a new `.spec.ts` file in `tests/`
2. Import from `@playwright/test`
3. Follow existing test patterns

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/path');
    await expect(page.locator('selector')).toBeVisible();
  });
});
```
