import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Admin Dashboard - Deployment Features
 * Per PROMPT-33 spec requirements
 */

test.describe('Deployment Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to deployment page
    await page.goto('/dashboard/deployments');
  });

  test('should display deployment list', async ({ page }) => {
    // Wait for deployment list to load
    await expect(page.getByRole('heading', { name: /deployments/i })).toBeVisible();
    
    // Check for deployment table or list
    const deploymentList = page.locator('[data-testid="deployment-list"]');
    await expect(deploymentList).toBeVisible();
  });

  test('should show deployment details on click', async ({ page }) => {
    // Click on a deployment row
    const firstDeployment = page.locator('[data-testid="deployment-row"]').first();
    await firstDeployment.click();
    
    // Verify detail panel opens
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/deployment details/i)).toBeVisible();
  });

  test('should filter deployments by status', async ({ page }) => {
    // Open status filter
    await page.getByRole('combobox', { name: /status/i }).click();
    
    // Select 'completed' filter
    await page.getByRole('option', { name: /completed/i }).click();
    
    // Verify filter is applied
    await expect(page.getByRole('combobox', { name: /status/i })).toHaveText(/completed/i);
  });
});

test.describe('Multi-Region Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/multi-region');
  });

  test('should display region overview', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /multi-region/i })).toBeVisible();
    
    // Check for region cards
    const regionCards = page.locator('[data-testid="region-card"]');
    await expect(regionCards.first()).toBeVisible();
  });

  test('should show consistency status', async ({ page }) => {
    // Look for consistency indicator
    const consistencyBadge = page.locator('[data-testid="consistency-status"]');
    await expect(consistencyBadge).toBeVisible();
  });

  test('should display deployment strategy options', async ({ page }) => {
    // Navigate to deploy tab
    await page.getByRole('tab', { name: /deploy/i }).click();
    
    // Check strategy dropdown exists
    await expect(page.getByRole('combobox', { name: /strategy/i })).toBeVisible();
    
    // Verify strategy options
    await page.getByRole('combobox', { name: /strategy/i }).click();
    await expect(page.getByRole('option', { name: /canary/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /sequential/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /parallel/i })).toBeVisible();
  });
});

test.describe('Cost Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/cost');
  });

  test('should display cost summary cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /cost/i })).toBeVisible();
    
    // Check for summary metrics
    await expect(page.getByText(/total spend/i)).toBeVisible();
    await expect(page.getByText(/estimated/i)).toBeVisible();
  });

  test('should show cost alerts', async ({ page }) => {
    // Check for alerts section
    const alertsSection = page.locator('[data-testid="cost-alerts"]');
    await expect(alertsSection).toBeVisible();
  });

  test('should filter by time period', async ({ page }) => {
    // Select time period
    await page.getByRole('combobox', { name: /period/i }).click();
    await page.getByRole('option', { name: /30 days/i }).click();
    
    // Verify selection
    await expect(page.getByRole('combobox', { name: /period/i })).toContainText(/30/);
  });
});

test.describe('Security Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/security');
  });

  test('should display security metrics', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /security/i })).toBeVisible();
    
    // Check for anomaly count
    await expect(page.getByText(/anomalies/i)).toBeVisible();
  });

  test('should show active anomalies tab', async ({ page }) => {
    await page.getByRole('tab', { name: /anomalies/i }).click();
    
    // Verify tab content
    const anomalyList = page.locator('[data-testid="anomaly-list"]');
    await expect(anomalyList).toBeVisible();
  });

  test('should filter by product', async ({ page }) => {
    await page.getByRole('combobox', { name: /product/i }).click();
    await page.getByRole('option', { name: /radiant/i }).click();
    
    // Verify filter applied
    await expect(page.getByRole('combobox', { name: /product/i })).toContainText(/radiant/i);
  });
});

test.describe('Compliance Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/compliance');
  });

  test('should display compliance frameworks', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /compliance/i })).toBeVisible();
    
    // Check for framework cards
    await expect(page.getByText(/SOC 2/i)).toBeVisible();
    await expect(page.getByText(/HIPAA/i)).toBeVisible();
    await expect(page.getByText(/GDPR/i)).toBeVisible();
  });

  test('should show compliance score', async ({ page }) => {
    // Click on SOC2 tab
    await page.getByRole('tab', { name: /soc2/i }).click();
    
    // Check for score display
    await expect(page.locator('[data-testid="compliance-score"]')).toBeVisible();
  });

  test('should allow report generation', async ({ page }) => {
    const generateButton = page.getByRole('button', { name: /generate report/i });
    await expect(generateButton).toBeVisible();
  });
});

test.describe('A/B Testing (Experiments)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/experiments');
  });

  test('should display experiment list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /a\/b testing/i })).toBeVisible();
  });

  test('should show running experiments count', async ({ page }) => {
    await expect(page.getByText(/running experiments/i)).toBeVisible();
  });

  test('should allow creating new experiment', async ({ page }) => {
    const newButton = page.getByRole('button', { name: /new experiment/i });
    await expect(newButton).toBeVisible();
  });
});

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings');
  });

  test('should display deployment settings', async ({ page }) => {
    await expect(page.getByText(/deployment settings/i)).toBeVisible();
  });

  test('should show timeout configuration', async ({ page }) => {
    // Navigate to timeouts section
    await page.getByRole('tab', { name: /timeouts/i }).click();
    
    await expect(page.getByText(/operation timeouts/i)).toBeVisible();
  });

  test('should allow SSM sync', async ({ page }) => {
    const syncButton = page.getByRole('button', { name: /sync.*ssm/i });
    await expect(syncButton).toBeVisible();
  });
});

test.describe('Health Checks', () => {
  test('should display service health status', async ({ page }) => {
    await page.goto('/dashboard/health');
    
    // Check for health indicators
    await expect(page.getByText(/api/i)).toBeVisible();
    await expect(page.getByText(/database/i)).toBeVisible();
  });

  test('should allow manual health check', async ({ page }) => {
    await page.goto('/dashboard/health');
    
    const refreshButton = page.getByRole('button', { name: /refresh|check/i });
    await expect(refreshButton).toBeVisible();
  });
});
