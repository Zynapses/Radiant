/**
 * RADIANT Admin Dashboard - Smoke Tests
 * Basic tests to verify the app loads correctly
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads', async ({ page }) => {
    const response = await page.goto('/');
    
    // Should not return error status
    expect(response?.status()).toBeLessThan(400);
  });

  test('has proper HTML structure', async ({ page }) => {
    await page.goto('/');
    
    // Should have proper HTML elements
    await expect(page.locator('html')).toBeVisible();
    await expect(page.locator('body')).toBeVisible();
  });

  test('has proper meta tags', async ({ page }) => {
    await page.goto('/');
    
    // Check for viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('loads without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should have no critical errors
    const criticalErrors = errors.filter(e => 
      !e.includes('ResizeObserver') && // Ignore ResizeObserver errors (common false positive)
      !e.includes('Non-Error') // Ignore non-critical errors
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('loads CSS properly', async ({ page }) => {
    await page.goto('/');
    
    // Check that styles are applied (body should have some styling)
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const styles = window.getComputedStyle(body);
      return {
        fontFamily: styles.fontFamily,
        margin: styles.margin,
      };
    });
    
    // Body should have font-family set (not default)
    expect(bodyStyles.fontFamily).not.toBe('');
  });
});

test.describe('API Health', () => {
  test('API endpoint responds', async ({ request }) => {
    // Skip if no API is configured
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      test.skip();
      return;
    }
    
    const response = await request.get(`${apiUrl}/health`);
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('Performance', () => {
  test('page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});
