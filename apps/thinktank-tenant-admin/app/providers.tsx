'use client';

import { useState } from 'react';
import { RadiantDelightProvider, type AppDelightConfig } from '@radiant/delight-ui';

const TENANT_ADMIN_DELIGHT_CONFIG: AppDelightConfig = {
  appId: 'thinktank_tenant_admin',
  appName: 'Tenant Admin',
  defaultPersonalityMode: 'auto',
  defaultSoundEnabled: false,
  greetingMessages: [
    'Tenant dashboard ready.',
    'Welcome back.',
    'Your team\'s workspace is in good shape.',
  ],
  preExecutionMessages: [
    'Saving changes...',
    'Updating settings...',
    'Processing...',
  ],
  duringExecutionMessages: [
    'Applying across your organization...',
    'Almost done...',
  ],
  postExecutionMessages: [
    'Settings saved.',
    'Changes applied.',
    'Updated successfully.',
  ],
  errorRecoveryMessages: [
    'Something went wrong. Your previous settings are safe.',
    'That didn\'t go through. Let\'s try again.',
  ],
  milestoneMessages: [
    'Your team is growing!',
    'Organization running smoothly.',
  ],
  customInjectionPoints: {
    user_invited: [
      'Invitation sent!',
      'New team member on the way.',
    ],
    user_deactivated: [
      'User deactivated. Seat freed.',
      'Access revoked.',
    ],
    security_updated: [
      'Security settings updated.',
      'Your organization is more secure now.',
    ],
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <RadiantDelightProvider config={TENANT_ADMIN_DELIGHT_CONFIG}>
      {children}
    </RadiantDelightProvider>
  );
}
