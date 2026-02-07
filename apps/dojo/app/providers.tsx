'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { RadiantDelightProvider, type AppDelightConfig } from '@radiant/delight-ui';

const DOJO_DELIGHT_CONFIG: AppDelightConfig = {
  appId: 'dojo',
  appName: 'Aurelius Dojo',
  defaultPersonalityMode: 'auto',
  defaultSoundEnabled: false,
  greetingMessages: [
    'The dojo awaits, student.',
    'Ready for training.',
    'Welcome back to the mat.',
  ],
  preExecutionMessages: [
    'Preparing your challenge...',
    'The sensei is thinking...',
    'Setting up the sparring round...',
  ],
  duringExecutionMessages: [
    'Training in progress...',
    'Stay focused...',
    'The lesson unfolds...',
  ],
  postExecutionMessages: [
    'Round complete.',
    'Well fought.',
    'Lesson absorbed. On to the next.',
  ],
  errorRecoveryMessages: [
    'Even masters stumble. Let\'s reset and try again.',
    'A setback, not a defeat. Shall we retry?',
  ],
  milestoneMessages: [
    'Belt earned! Your mastery grows.',
    'New rank achieved!',
    'The student becomes the teacher.',
  ],
  customInjectionPoints: {
    sparring_start: [
      'Bow to your opponent.',
      'The bout begins.',
      'Engage!',
    ],
    sparring_complete: [
      'Excellent form.',
      'A worthy exchange.',
      'Your technique improves.',
    ],
    mastery_achieved: [
      'Mastery unlocked. You own this domain.',
      'Perfection achieved.',
      'The art is now yours.',
    ],
  },
};

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RadiantDelightProvider config={DOJO_DELIGHT_CONFIG}>
        {children}
      </RadiantDelightProvider>
    </QueryClientProvider>
  );
}
