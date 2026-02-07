'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { AuthProvider } from '@/lib/auth/context';
import { LocalizationProvider } from '@/lib/i18n';
import { RadiantDelightProvider, type AppDelightConfig } from '@radiant/delight-ui';

const THINKTANK_DELIGHT_CONFIG: AppDelightConfig = {
  appId: 'thinktank',
  appName: 'Think Tank',
  defaultPersonalityMode: 'auto',
  defaultSoundEnabled: false,
  greetingMessages: [
    'Welcome back to Think Tank.',
    'Ready to think together.',
    'Your AI companion is standing by.',
    'What shall we explore today?',
  ],
  preExecutionMessages: [
    'Selecting the best model for this...',
    'Routing your query...',
    'Assembling the perfect response...',
    'Thinking deeply about this...',
  ],
  duringExecutionMessages: [
    'Still working on this...',
    'Synthesizing across models...',
    'Almost there...',
    'Refining the response...',
  ],
  postExecutionMessages: [
    'Response complete.',
    'Here you go.',
    'All done.',
    'Analysis ready.',
  ],
  errorRecoveryMessages: [
    'Something went wrong. Let me try again.',
    'Hit a snag — retrying with a different approach.',
    'An error occurred, but we can work through this.',
  ],
  milestoneMessages: [
    'Nice milestone!',
    'You\'re making great progress!',
    'Another achievement unlocked!',
  ],
  customInjectionPoints: {
    morph_to_view: [
      'Transforming your workspace...',
      'Morphing the interface...',
    ],
    mode_switch: [
      'Mode switched.',
      'Execution mode updated.',
    ],
    escalate: [
      'Escalating to deeper analysis.',
      'Bringing in the full team.',
    ],
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LocalizationProvider>
            <RadiantDelightProvider config={THINKTANK_DELIGHT_CONFIG}>
              {children}
            </RadiantDelightProvider>
          </LocalizationProvider>
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
