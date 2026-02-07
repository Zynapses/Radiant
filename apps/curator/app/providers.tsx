'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { RadiantDelightProvider, type AppDelightConfig } from '@radiant/delight-ui';

const CURATOR_DELIGHT_CONFIG: AppDelightConfig = {
  appId: 'curator',
  appName: 'Curator',
  defaultPersonalityMode: 'auto',
  defaultSoundEnabled: false,
  greetingMessages: [
    'Knowledge awaits.',
    'Ready to curate.',
    'Your knowledge base is standing by.',
  ],
  preExecutionMessages: [
    'Ingesting knowledge...',
    'Processing documents...',
    'Building connections...',
  ],
  duringExecutionMessages: [
    'Extracting insights...',
    'Mapping relationships...',
    'Connecting the dots...',
  ],
  postExecutionMessages: [
    'Knowledge ingested successfully.',
    'Curation complete.',
    'Your knowledge base just got smarter.',
  ],
  errorRecoveryMessages: [
    'Ingestion hit a snag. Let\'s try again.',
    'Something went wrong during curation. Don\'t worry, your data is safe.',
  ],
  milestoneMessages: [
    'Another domain mastered!',
    'Knowledge base growing strong!',
    'You\'re building something impressive.',
  ],
  customInjectionPoints: {
    domain_verified: [
      'Domain verified successfully.',
      'Knowledge integrity confirmed.',
      'All facts check out.',
    ],
    graph_updated: [
      'Knowledge graph updated.',
      'New connections mapped.',
      'Graph enriched with new data.',
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
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <RadiantDelightProvider config={CURATOR_DELIGHT_CONFIG}>
          {children}
        </RadiantDelightProvider>
        <Toaster richColors position="bottom-right" />
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
