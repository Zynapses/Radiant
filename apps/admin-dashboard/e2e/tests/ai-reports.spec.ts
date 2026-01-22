/**
 * RADIANT Admin Dashboard - AI Reports E2E Tests
 * Tests for the AI-powered report generation feature
 */

import { test, expect } from '@playwright/test';

test.describe('AI Reports', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to AI Reports page
    await page.goto('/reports/ai');
  });

  test('displays AI reports page', async ({ page }) => {
    await expect(page).toHaveURL(/.*reports\/ai/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('shows report list or empty state', async ({ page }) => {
    // Should show either reports or empty state
    const hasReports = await page.locator('[data-testid="report-list"]').count() > 0;
    const hasEmptyState = await page.locator('[data-testid="empty-state"], text=/no reports/i').count() > 0;
    
    expect(hasReports || hasEmptyState).toBeTruthy();
  });

  test('has create report button', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create"), button:has-text("Generate"), button:has-text("New")');
    await expect(createButton.first()).toBeVisible();
  });

  test('opens report creation dialog', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create"), button:has-text("Generate"), button:has-text("New")');
    await createButton.first().click();
    
    // Dialog or form should appear
    const dialog = page.locator('[role="dialog"], form, [data-testid="create-report-form"]');
    await expect(dialog.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('AI Reports - Templates', () => {
  test('displays templates section', async ({ page }) => {
    await page.goto('/reports/ai');
    
    // Look for templates tab or section
    const templatesTab = page.locator('text=/template/i');
    if (await templatesTab.count() > 0) {
      await templatesTab.first().click();
      await expect(page.locator('[data-testid="template-list"], .template')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('AI Reports - Brand Kits', () => {
  test('displays brand kits section', async ({ page }) => {
    await page.goto('/reports/ai');
    
    // Look for brand kits tab or section
    const brandKitsTab = page.locator('text=/brand/i');
    if (await brandKitsTab.count() > 0) {
      await brandKitsTab.first().click();
      await expect(page.locator('[data-testid="brand-kit-list"], .brand-kit')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('AI Reports - Export', () => {
  test('export menu shows format options', async ({ page }) => {
    await page.goto('/reports/ai');
    
    // Find any report with export option
    const exportButton = page.locator('button:has-text("Export"), [data-testid="export-button"]');
    if (await exportButton.count() > 0) {
      await exportButton.first().click();
      
      // Should show format options
      const pdfOption = page.locator('text=/pdf/i');
      const excelOption = page.locator('text=/excel/i, text=/xlsx/i');
      
      expect(await pdfOption.count() > 0 || await excelOption.count() > 0).toBeTruthy();
    }
  });
});
