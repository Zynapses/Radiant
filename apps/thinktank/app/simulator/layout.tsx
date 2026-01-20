'use client';

/**
 * Simulator Layout - Bypasses auth for development
 */

import { ThemeProvider } from 'next-themes';

export default function SimulatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
