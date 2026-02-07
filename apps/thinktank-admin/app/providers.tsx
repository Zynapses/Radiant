'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { AuthProvider } from '@/lib/auth/context';
import { RadiantDelightProvider, type AppDelightConfig } from '@radiant/delight-ui';

const THINKTANK_ADMIN_DELIGHT_CONFIG: AppDelightConfig = {
  appId: 'thinktank_admin',
  appName: 'Think Tank Admin',
  defaultPersonalityMode: 'auto',
  defaultSoundEnabled: false,
  greetingMessages: [
    'Admin dashboard ready.',
    'Welcome back, admin.',
    'Your platform is humming along.',
  ],
  preExecutionMessages: [
    'Applying changes...',
    'Updating configuration...',
    'Processing request...',
  ],
  duringExecutionMessages: [
    'Propagating changes...',
    'Almost there...',
  ],
  postExecutionMessages: [
    'Configuration saved.',
    'Changes applied successfully.',
    'All systems updated.',
  ],
  errorRecoveryMessages: [
    'That didn\'t work as expected. Let\'s troubleshoot.',
    'Configuration error detected. Changes rolled back safely.',
  ],
  milestoneMessages: [
    'Platform running smoothly!',
    'Another successful deployment.',
  ],
  customInjectionPoints: {
    config_saved: [
      'Configuration locked in.',
      'Settings updated across the platform.',
    ],
    user_managed: [
      'User updated successfully.',
      'User management action complete.',
    ],
    delight_published: [
      'Delight messages published to all users.',
      'Personality update live!',
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
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RadiantDelightProvider config={THINKTANK_ADMIN_DELIGHT_CONFIG}>
            {children}
          </RadiantDelightProvider>
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
