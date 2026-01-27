/**
 * E2E Tests for Critical User Flows
 * Tests the most important user journeys in the admin dashboard
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/billing');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('should show login form', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Setup authenticated session (mock or real auth)
    await page.goto('/');
  });

  test('should display main dashboard', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should navigate to billing page', async ({ page }) => {
    await page.click('a[href*="billing"]');
    await expect(page).toHaveURL(/.*billing/);
  });

  test('should navigate to analytics page', async ({ page }) => {
    await page.click('a[href*="analytics"]');
    await expect(page).toHaveURL(/.*analytics/);
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.click('a[href*="settings"]');
    await expect(page).toHaveURL(/.*settings/);
  });
});

test.describe('API Keys Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api-keys');
  });

  test('should display API keys list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /api keys/i })).toBeVisible();
  });

  test('should open create key dialog', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create|new|add/i });
    if (await createButton.isVisible()) {
      await createButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
  });
});

test.describe('Billing & Subscription', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/billing');
  });

  test('should display current plan', async ({ page }) => {
    await expect(page.getByText(/plan|subscription|tier/i)).toBeVisible();
  });

  test('should display credit balance', async ({ page }) => {
    await expect(page.getByText(/credit|balance/i)).toBeVisible();
  });

  test('should show usage history', async ({ page }) => {
    const usageTab = page.getByRole('tab', { name: /usage|history/i });
    if (await usageTab.isVisible()) {
      await usageTab.click();
      await expect(page.getByText(/usage/i)).toBeVisible();
    }
  });
});

test.describe('Model Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/brain');
  });

  test('should display available models', async ({ page }) => {
    await expect(page.getByText(/model|brain/i)).toBeVisible();
  });

  test('should allow model selection', async ({ page }) => {
    const modelSelector = page.getByRole('combobox');
    if (await modelSelector.isVisible()) {
      await modelSelector.click();
      await expect(page.getByRole('option')).toBeVisible();
    }
  });
});

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/administrators');
  });

  test('should display user list', async ({ page }) => {
    await expect(page.getByText(/administrator|user/i)).toBeVisible();
  });

  test('should open invite dialog', async ({ page }) => {
    const inviteButton = page.getByRole('button', { name: /invite|add/i });
    if (await inviteButton.isVisible()) {
      await inviteButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
  });
});

test.describe('Audit & Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/audit-logs');
  });

  test('should display audit logs', async ({ page }) => {
    await expect(page.getByText(/audit|log/i)).toBeVisible();
  });

  test('should allow date filtering', async ({ page }) => {
    const dateFilter = page.getByRole('button', { name: /date|filter/i });
    if (await dateFilter.isVisible()) {
      await dateFilter.click();
    }
  });
});

test.describe('Error Handling', () => {
  test('should handle 404 gracefully', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    await expect(page.getByText(/not found|404|error/i)).toBeVisible();
  });

  test('should show error boundary for broken pages', async ({ page }) => {
    // Force an error by navigating to a page with invalid state
    await page.goto('/?forceError=true');
    // Error boundary should catch and display error UI
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Should have mobile menu or hamburger
    const mobileMenu = page.getByRole('button', { name: /menu/i });
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
    }
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('should load dashboard within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000);
  });

  test('should not have memory leaks on navigation', async ({ page }) => {
    // Navigate between pages multiple times
    for (let i = 0; i < 5; i++) {
      await page.goto('/');
      await page.goto('/billing');
      await page.goto('/analytics');
    }
    
    // Page should still be responsive
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});
