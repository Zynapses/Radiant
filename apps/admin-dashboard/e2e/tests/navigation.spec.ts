/**
 * RADIANT Admin Dashboard - Navigation E2E Tests
 * Tests for sidebar navigation and page routing
 */

import { test, expect } from '@playwright/test';

const CRITICAL_ROUTES = [
  { path: '/', name: 'Dashboard' },
  { path: '/tenants', name: 'Tenants' },
  { path: '/models', name: 'Models' },
  { path: '/providers', name: 'Providers' },
  { path: '/costs', name: 'Costs' },
  { path: '/reports', name: 'Reports' },
  { path: '/settings', name: 'Settings' },
];

test.describe('Navigation', () => {
  test('sidebar is visible', async ({ page }) => {
    await page.goto('/');
    
    const sidebar = page.locator('nav, aside, [data-testid="sidebar"]');
    await expect(sidebar.first()).toBeVisible();
  });

  test('sidebar has navigation links', async ({ page }) => {
    await page.goto('/');
    
    const navLinks = page.locator('nav a, aside a, [data-testid="sidebar"] a');
    const count = await navLinks.count();
    
    expect(count).toBeGreaterThan(0);
  });

  for (const route of CRITICAL_ROUTES) {
    test(`navigates to ${route.name} page`, async ({ page }) => {
      const response = await page.goto(route.path);
      
      // Should not return error
      expect(response?.status()).toBeLessThan(400);
      
      // URL should match
      await expect(page).toHaveURL(new RegExp(route.path.replace('/', '\\/')));
    });
  }

  test('clicking nav items updates URL', async ({ page }) => {
    await page.goto('/');
    
    // Find a nav link that's not the current page
    const navLinks = page.locator('nav a[href], aside a[href]');
    const firstLink = navLinks.first();
    
    const href = await firstLink.getAttribute('href');
    if (href && href !== '/') {
      await firstLink.click();
      await page.waitForURL(`**${href}*`);
      expect(page.url()).toContain(href);
    }
  });
});

test.describe('Breadcrumbs', () => {
  test('displays breadcrumb navigation on nested pages', async ({ page }) => {
    await page.goto('/tenants');
    
    const breadcrumb = page.locator('[aria-label="Breadcrumb"], nav.breadcrumb, .breadcrumb');
    // Breadcrumbs are optional, just check if present they work
    if (await breadcrumb.count() > 0) {
      await expect(breadcrumb.first()).toBeVisible();
    }
  });
});

test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('has mobile menu toggle', async ({ page }) => {
    await page.goto('/');
    
    const menuToggle = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], [data-testid="mobile-menu-toggle"]');
    // Mobile menu is optional based on design
    if (await menuToggle.count() > 0) {
      await expect(menuToggle.first()).toBeVisible();
    }
  });
});

test.describe('Page Titles', () => {
  for (const route of CRITICAL_ROUTES) {
    test(`${route.name} page has title`, async ({ page }) => {
      await page.goto(route.path);
      
      // Page should have a title
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });
  }
});
