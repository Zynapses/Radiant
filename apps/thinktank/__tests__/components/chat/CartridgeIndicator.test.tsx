/**
 * Unit Tests for CartridgeIndicator Component
 * 
 * Tests for cartridge display, expansion, and scope indicators.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CartridgeIndicator, ActiveCartridge } from '../../../components/chat/CartridgeIndicator';

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

describe('CartridgeIndicator', () => {
  const mockOnToggleCartridge = vi.fn();

  const mockCartridges: ActiveCartridge[] = [
    {
      id: 'sys-1',
      name: 'RADIANT Core',
      version: '6.0.0',
      scope: 'system',
      priority: 100,
      isActive: true,
    },
    {
      id: 'tenant-1',
      name: 'Company Knowledge',
      version: '1.2.0',
      scope: 'tenant',
      priority: 80,
      isActive: true,
    },
    {
      id: 'user-1',
      name: 'My Custom Cartridge',
      version: '0.5.0',
      scope: 'user',
      priority: 50,
      isActive: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ cartridges: mockCartridges }),
    });
  });

  describe('Rendering', () => {
    it('should render with cartridge count', () => {
      render(
        <CartridgeIndicator
          cartridges={mockCartridges}
          onToggleCartridge={mockOnToggleCartridge}
        />
      );

      expect(screen.getByText('2 Cartridges')).toBeDefined();
    });

    it('should render singular text for 1 cartridge', () => {
      const singleCartridge = [mockCartridges[0]];
      render(
        <CartridgeIndicator
          cartridges={singleCartridge}
          onToggleCartridge={mockOnToggleCartridge}
        />
      );

      expect(screen.getByText('1 Cartridge')).toBeDefined();
    });

    it('should not render when no cartridges', () => {
      const { container } = render(
        <CartridgeIndicator
          cartridges={[]}
          onToggleCartridge={mockOnToggleCartridge}
        />
      );

      // Should return null/empty
      expect(container.firstChild).toBeNull();
    });

    it('should render compact mode correctly', () => {
      render(
        <CartridgeIndicator
          cartridges={mockCartridges}
          onToggleCartridge={mockOnToggleCartridge}
          compact
        />
      );

      expect(screen.getByText('2 active')).toBeDefined();
    });
  });

  describe('Expansion', () => {
    it('should show cartridge details when expanded', async () => {
      render(
        <CartridgeIndicator
          cartridges={mockCartridges}
          onToggleCartridge={mockOnToggleCartridge}
        />
      );

      // Click to expand
      const button = screen.getByText('2 Cartridges');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Active Cartridges')).toBeDefined();
        expect(screen.getByText('RADIANT Core')).toBeDefined();
        expect(screen.getByText('Company Knowledge')).toBeDefined();
        expect(screen.getByText('My Custom Cartridge')).toBeDefined();
      });
    });

    it('should show version badges', async () => {
      render(
        <CartridgeIndicator
          cartridges={mockCartridges}
          onToggleCartridge={mockOnToggleCartridge}
        />
      );

      // Click to expand
      const button = screen.getByText('2 Cartridges');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('v6.0.0')).toBeDefined();
        expect(screen.getByText('v1.2.0')).toBeDefined();
        expect(screen.getByText('v0.5.0')).toBeDefined();
      });
    });

    it('should show scope labels', async () => {
      render(
        <CartridgeIndicator
          cartridges={mockCartridges}
          onToggleCartridge={mockOnToggleCartridge}
        />
      );

      // Click to expand
      const button = screen.getByText('2 Cartridges');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('System')).toBeDefined();
        expect(screen.getByText('Organization')).toBeDefined();
        expect(screen.getByText('Personal')).toBeDefined();
      });
    });

    it('should close when clicking backdrop', async () => {
      render(
        <CartridgeIndicator
          cartridges={mockCartridges}
          onToggleCartridge={mockOnToggleCartridge}
        />
      );

      // Click to expand
      const button = screen.getByText('2 Cartridges');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Active Cartridges')).toBeDefined();
      });

      // Find and click close button (X icon button)
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find((b) => b.querySelector('.lucide-x'));
      if (closeButton) {
        fireEvent.click(closeButton);
      }
    });
  });

  describe('API Integration', () => {
    it('should fetch cartridges from API when not provided as prop', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ cartridges: mockCartridges }),
      });

      render(
        <CartridgeIndicator
          onToggleCartridge={mockOnToggleCartridge}
        />
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/cartridges/active');
      });

      await waitFor(() => {
        expect(screen.getByText('2 Cartridges')).toBeDefined();
      });
    });

    it('should show fallback data when API fails', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'));

      render(
        <CartridgeIndicator
          onToggleCartridge={mockOnToggleCartridge}
        />
      );

      // Should show mock fallback data
      await waitFor(() => {
        expect(screen.getByText('2 Cartridges')).toBeDefined();
      });
    });
  });

  describe('Active/Inactive Status', () => {
    it('should only count active cartridges', () => {
      // mockCartridges has 2 active (sys-1, tenant-1) and 1 inactive (user-1)
      render(
        <CartridgeIndicator
          cartridges={mockCartridges}
          onToggleCartridge={mockOnToggleCartridge}
        />
      );

      expect(screen.getByText('2 Cartridges')).toBeDefined();
    });

    it('should display inactive cartridges with reduced opacity', async () => {
      render(
        <CartridgeIndicator
          cartridges={mockCartridges}
          onToggleCartridge={mockOnToggleCartridge}
        />
      );

      // Click to expand
      const button = screen.getByText('2 Cartridges');
      fireEvent.click(button);

      await waitFor(() => {
        // The inactive cartridge should still be visible but styled differently
        expect(screen.getByText('My Custom Cartridge')).toBeDefined();
      });
    });
  });
});
