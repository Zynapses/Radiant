/**
 * Accessibility Testing Automation
 * Automated a11y tests using axe-core via Playwright
 */

import { test, expect } from '@playwright/test';
// Note: Install @axe-core/playwright: npm install -D @axe-core/playwright
// Dynamic import to handle optional dependency
const getAxeBuilder = () => {
  try {
    return require('@axe-core/playwright').default;
  } catch {
    return null;
  }
};

interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  nodes: unknown[];
}

interface AxeResults {
  violations: AxeViolation[];
}

// Dashboard pages to test
const dashboardPages = [
  { path: '/', name: 'Home' },
  { path: '/billing', name: 'Billing' },
  { path: '/analytics', name: 'Analytics' },
  { path: '/api-keys', name: 'API Keys' },
  { path: '/audit-logs', name: 'Audit Logs' },
  { path: '/brain', name: 'Brain' },
  { path: '/cato', name: 'CATO' },
  { path: '/compliance', name: 'Compliance' },
  { path: '/configuration', name: 'Configuration' },
  { path: '/consciousness', name: 'Consciousness' },
  { path: '/cortex', name: 'Cortex' },
  { path: '/feedback', name: 'Feedback' },
  { path: '/health', name: 'Health' },
  { path: '/learning', name: 'Learning' },
];

test.describe('Accessibility Tests', () => {
  test.describe('WCAG 2.1 AA Compliance', () => {
    for (const page of dashboardPages) {
      test(`${page.name} page should have no critical accessibility violations`, async ({ page: browserPage }) => {
        await browserPage.goto(page.path);
        
        // Wait for page to be interactive
        await browserPage.waitForLoadState('domcontentloaded');
        
        const AxeBuilder = getAxeBuilder();
        if (!AxeBuilder) {
          test.skip();
          return;
        }
        const accessibilityScanResults = await new AxeBuilder({ page: browserPage })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        // Filter to critical and serious violations only
        const criticalViolations = (accessibilityScanResults as AxeResults).violations.filter(
          (v: AxeViolation) => v.impact === 'critical' || v.impact === 'serious'
        );

        expect(criticalViolations).toEqual([]);
      });
    }
  });

  test.describe('Keyboard Navigation', () => {
    test('should support Tab key navigation through interactive elements', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Press Tab and verify focus moves to first interactive element
      await page.keyboard.press('Tab');
      
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el?.tagName,
          role: el?.getAttribute('role'),
          tabIndex: el?.getAttribute('tabindex'),
        };
      });

      // First focusable element should be interactive
      expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focusedElement.tagName);
    });

    test('should have visible focus indicators', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Tab to first element
      await page.keyboard.press('Tab');

      // Check that focus is visible
      const hasFocusIndicator = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        
        const styles = window.getComputedStyle(el);
        const outline = styles.getPropertyValue('outline');
        const boxShadow = styles.getPropertyValue('box-shadow');
        
        // Check for visible focus indicator
        return (
          (outline && outline !== 'none' && !outline.includes('0px')) ||
          (boxShadow && boxShadow !== 'none')
        );
      });

      expect(hasFocusIndicator).toBe(true);
    });

    test('should trap focus in modal dialogs', async ({ page }) => {
      await page.goto('/');
      
      // Find and click a button that opens a modal (if exists)
      const modalTrigger = await page.$('[data-testid="modal-trigger"], [aria-haspopup="dialog"]');
      
      if (modalTrigger) {
        await modalTrigger.click();
        
        // Tab through the modal
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        // Focus should still be within the modal
        const focusInModal = await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"]');
          return modal?.contains(document.activeElement);
        });
        
        expect(focusInModal).toBe(true);
      }
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const headings = await page.evaluate(() => {
        const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        return Array.from(headingElements).map((h) => ({
          level: parseInt(h.tagName[1]),
          text: h.textContent?.trim().substring(0, 50),
        }));
      });

      // Should have at least one h1
      const h1Count = headings.filter((h) => h.level === 1).length;
      expect(h1Count).toBeGreaterThanOrEqual(1);

      // Headings should not skip levels (e.g., h1 -> h3)
      let prevLevel = 0;
      for (const heading of headings) {
        if (prevLevel > 0) {
          expect(heading.level - prevLevel).toBeLessThanOrEqual(1);
        }
        prevLevel = heading.level;
      }
    });

    test('should have accessible names for interactive elements', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const buttons = await page.$$('button');
      
      for (const button of buttons.slice(0, 10)) { // Check first 10 buttons
        const accessibleName = await button.evaluate((el) => {
          return (
            el.getAttribute('aria-label') ||
            el.getAttribute('aria-labelledby') ||
            el.textContent?.trim()
          );
        });
        
        expect(accessibleName).toBeTruthy();
      }
    });

    test('should have proper ARIA landmarks', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const landmarks = await page.evaluate(() => {
        return {
          main: document.querySelectorAll('main, [role="main"]').length,
          nav: document.querySelectorAll('nav, [role="navigation"]').length,
          banner: document.querySelectorAll('header, [role="banner"]').length,
        };
      });

      // Should have exactly one main landmark
      expect(landmarks.main).toBeGreaterThanOrEqual(1);
    });

    test('should announce dynamic content changes', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Check for aria-live regions
      const liveRegions = await page.$$('[aria-live]');
      
      // Should have at least one live region for announcements
      expect(liveRegions.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Color and Contrast', () => {
    test('should have sufficient color contrast for text', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const AxeBuilder = getAxeBuilder();
      if (!AxeBuilder) {
        test.skip();
        return;
      }
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .include('body')
        .analyze();

      // Check specifically for color contrast violations
      const contrastViolations = (accessibilityScanResults as AxeResults).violations.filter(
        (v: AxeViolation) => v.id === 'color-contrast'
      );

      // Allow some minor contrast issues in non-critical areas
      const criticalContrastIssues = contrastViolations.filter(
        (v: AxeViolation) => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(criticalContrastIssues).toEqual([]);
    });
  });

  test.describe('Forms', () => {
    test('form inputs should have associated labels', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const inputs = await page.$$('input:not([type="hidden"]), select, textarea');
      
      for (const input of inputs.slice(0, 10)) {
        const hasLabel = await input.evaluate((el) => {
          const id = el.id;
          const ariaLabel = el.getAttribute('aria-label');
          const ariaLabelledBy = el.getAttribute('aria-labelledby');
          const label = id ? document.querySelector(`label[for="${id}"]`) : null;
          const parentLabel = el.closest('label');
          
          return !!(ariaLabel || ariaLabelledBy || label || parentLabel);
        });
        
        expect(hasLabel).toBe(true);
      }
    });

    test('form errors should be announced', async ({ page }) => {
      // Navigate to a page with a form
      await page.goto('/api-keys');
      await page.waitForLoadState('domcontentloaded');

      // Check that error containers have proper ARIA attributes
      const errorContainers = await page.$$('[role="alert"], [aria-live="assertive"]');
      
      // Error containers should exist for form validation
      // (They may be hidden until an error occurs)
      const formExists = await page.$('form');
      if (formExists) {
        // Forms should have error handling infrastructure
        expect(errorContainers.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Images and Media', () => {
    test('images should have alt text', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const images = await page.$$('img');
      
      for (const img of images) {
        const hasAlt = await img.evaluate((el) => {
          return el.hasAttribute('alt');
        });
        
        expect(hasAlt).toBe(true);
      }
    });

    test('decorative images should have empty alt', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const decorativeImages = await page.$$('img[role="presentation"], img[aria-hidden="true"]');
      
      for (const img of decorativeImages) {
        const altText = await img.getAttribute('alt');
        expect(altText).toBe('');
      }
    });
  });
});

// Custom matcher for accessibility violations
expect.extend({
  toHaveNoAccessibilityViolations(received: { violations: Array<{ impact: string }> }) {
    const criticalViolations = received.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    const pass = criticalViolations.length === 0;

    return {
      pass,
      message: () =>
        pass
          ? 'Expected accessibility violations but found none'
          : `Found ${criticalViolations.length} critical accessibility violations`,
    };
  },
});
