/**
 * Unit Tests for DomainSelector Component
 * 
 * Tests for domain selection, search functionality,
 * and integration with Domain Taxonomy API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DomainSelector, Domain } from '../../../components/chat/DomainSelector';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren<object>) => <>{children}</>,
}));

// Mock fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DomainSelector', () => {
  const mockOnSelectDomain = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
  });

  describe('Rendering', () => {
    it('should render with Auto Domain text when no domain selected', () => {
      render(
        <DomainSelector
          selectedDomain={null}
          onSelectDomain={mockOnSelectDomain}
        />
      );

      expect(screen.getByText('Auto Domain')).toBeDefined();
    });

    it('should render selected domain name when domain is selected', () => {
      const selectedDomain: Domain = {
        id: 'healthcare',
        name: 'Healthcare',
        description: 'Medical topics',
      };

      render(
        <DomainSelector
          selectedDomain={selectedDomain}
          onSelectDomain={mockOnSelectDomain}
        />
      );

      expect(screen.getByText('Healthcare')).toBeDefined();
    });

    it('should render compact mode correctly', () => {
      render(
        <DomainSelector
          selectedDomain={null}
          onSelectDomain={mockOnSelectDomain}
          compact
        />
      );

      expect(screen.getByText('Auto')).toBeDefined();
    });
  });

  describe('Modal Interaction', () => {
    it('should open modal when button is clicked', async () => {
      render(
        <DomainSelector
          selectedDomain={null}
          onSelectDomain={mockOnSelectDomain}
        />
      );

      const button = screen.getByText('Auto Domain');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Select Domain')).toBeDefined();
      });
    });

    it('should show Auto Detect option in modal', async () => {
      render(
        <DomainSelector
          selectedDomain={null}
          onSelectDomain={mockOnSelectDomain}
        />
      );

      const button = screen.getByText('Auto Domain');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Auto Detect')).toBeDefined();
      });
    });

    it('should show modal content when opened', async () => {
      render(
        <DomainSelector
          selectedDomain={null}
          onSelectDomain={mockOnSelectDomain}
        />
      );

      const button = screen.getByText('Auto Domain');
      fireEvent.click(button);

      await waitFor(() => {
        // Check for modal header
        expect(screen.getByText('Select Domain')).toBeDefined();
        // Check for Auto Detect option
        expect(screen.getByText('Auto Detect')).toBeDefined();
        // Check for search input
        expect(screen.getByPlaceholderText('Search domains...')).toBeDefined();
      });
    });
  });

  describe('Domain Selection', () => {
    it('should call onSelectDomain with null when Auto Detect is clicked', async () => {
      const selectedDomain: Domain = {
        id: 'healthcare',
        name: 'Healthcare',
      };

      render(
        <DomainSelector
          selectedDomain={selectedDomain}
          onSelectDomain={mockOnSelectDomain}
        />
      );

      // Open modal
      const button = screen.getByText('Healthcare');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Auto Detect')).toBeDefined();
      });

      // Click Auto Detect
      const autoDetectButton = screen.getByText('Auto Detect').closest('button');
      if (autoDetectButton) {
        fireEvent.click(autoDetectButton);
      }

      expect(mockOnSelectDomain).toHaveBeenCalledWith(null);
    });

    it('should call onSelectDomain with domain when domain is clicked', async () => {
      render(
        <DomainSelector
          selectedDomain={null}
          onSelectDomain={mockOnSelectDomain}
        />
      );

      // Open modal
      const button = screen.getByText('Auto Domain');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Healthcare')).toBeDefined();
      });

      // Click Healthcare domain
      const healthcareButton = screen.getByText('Healthcare').closest('button');
      if (healthcareButton) {
        fireEvent.click(healthcareButton);
      }

      expect(mockOnSelectDomain).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'healthcare',
          name: 'Healthcare',
        })
      );
    });

    it('should save user selection to API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      render(
        <DomainSelector
          selectedDomain={null}
          onSelectDomain={mockOnSelectDomain}
        />
      );

      // Open modal
      const button = screen.getByText('Auto Domain');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Healthcare')).toBeDefined();
      });

      // Click Healthcare domain
      const healthcareButton = screen.getByText('Healthcare').closest('button');
      if (healthcareButton) {
        fireEvent.click(healthcareButton);
      }

      // Verify API call was made
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v2/domain-taxonomy/user-selection',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });
  });

  describe('Search Functionality', () => {
    it('should search domains when query is entered', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { id: 'cardiology', name: 'Cardiology', description: 'Heart medicine' },
          ],
        }),
      });

      render(
        <DomainSelector
          selectedDomain={null}
          onSelectDomain={mockOnSelectDomain}
        />
      );

      // Open modal
      const button = screen.getByText('Auto Domain');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search domains...')).toBeDefined();
      });

      // Type in search
      const searchInput = screen.getByPlaceholderText('Search domains...');
      fireEvent.change(searchInput, { target: { value: 'cardio' } });

      // Verify API was called with search query
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v2/domain-taxonomy/search?q=cardio')
        );
      });
    });
  });
});
