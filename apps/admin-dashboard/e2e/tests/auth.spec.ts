/**
 * RADIANT Admin Dashboard - Authentication E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should be redirected to login or show auth required
    await expect(page).toHaveURL(/\/(login|auth|signin)/);
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/login');
    
    // Check for login form elements
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('[role="alert"], .error, .text-red')).toBeVisible({ timeout: 5000 });
  });

  test('should have forgot password link', async ({ page }) => {
    await page.goto('/login');
    
    const forgotLink = page.locator('a[href*="forgot"], a[href*="reset"]');
    await expect(forgotLink).toBeVisible();
  });
});

test.describe('Protected Routes', () => {
  test('dashboard requires authentication', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL('/dashboard');
  });

  test('tenants page requires authentication', async ({ page }) => {
    await page.goto('/tenants');
    await expect(page).not.toHaveURL('/tenants');
  });

  test('models page requires authentication', async ({ page }) => {
    await page.goto('/models');
    await expect(page).not.toHaveURL('/models');
  });

  test('billing page requires authentication', async ({ page }) => {
    await page.goto('/billing');
    await expect(page).not.toHaveURL('/billing');
  });
});
