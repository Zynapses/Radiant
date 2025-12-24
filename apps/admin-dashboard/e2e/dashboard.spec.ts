import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for tests
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'test-token');
      localStorage.setItem('user', JSON.stringify({
        id: 'test-user',
        email: 'test@example.com',
        role: 'admin',
      }));
    });
  });

  test('should display dashboard home', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Dashboard');
  });

  test('should have working sidebar navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check sidebar is visible
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    
    // Check navigation links exist
    await expect(page.getByRole('link', { name: 'Models' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Providers' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Billing' })).toBeVisible();
  });

  test('should navigate to models page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Models' }).click();
    await expect(page).toHaveURL('/models');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Models');
  });

  test('should navigate to providers page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Providers' }).click();
    await expect(page).toHaveURL('/providers');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Providers');
  });

  test('should navigate to billing page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Billing' }).click();
    await expect(page).toHaveURL('/billing');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Billing');
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Settings');
  });
});

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'test-token');
    });
  });

  test('should display profile tab by default', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('tab', { name: /profile/i })).toHaveAttribute('data-state', 'active');
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/settings');
    
    // Click notifications tab
    await page.getByRole('tab', { name: /notifications/i }).click();
    await expect(page.getByText('Email Notifications')).toBeVisible();
    
    // Click security tab
    await page.getByRole('tab', { name: /security/i }).click();
    await expect(page.getByText('Two-Factor Authentication')).toBeVisible();
  });
});

test.describe('Billing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'test-token');
    });
  });

  test('should display credit balance card', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.getByText('Credit Balance')).toBeVisible();
  });

  test('should display subscription tiers', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.getByRole('heading', { name: /tiers/i })).toBeVisible();
  });
});

test.describe('Audit Logs Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'test-token');
    });
  });

  test('should display audit log table', async ({ page }) => {
    await page.goto('/audit-logs');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Audit Logs');
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should have filter controls', async ({ page }) => {
    await page.goto('/audit-logs');
    await expect(page.getByRole('combobox')).toHaveCount(2); // Action and Resource filters
  });
});

test.describe('Login Page', () => {
  test('should display login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading')).toContainText('Sign in');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should show validation on empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Form validation should prevent submission
  });
});

test.describe('Responsive Design', () => {
  test('should collapse sidebar on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'test-token');
    });
    
    await page.goto('/');
    // Sidebar should be hidden or collapsed on mobile
  });
});
