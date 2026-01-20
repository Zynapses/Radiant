'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import EnhancedCollaborativeSession from '@/components/collaboration/EnhancedCollaborativeSession';

function EnhancedCollaborateContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId') || 'demo-session';
  
  // In a real app, this would come from auth context
  const currentUserId = 'current-user-id';

  return (
    <EnhancedCollaborativeSession
      sessionId={sessionId}
      currentUserId={currentUserId}
    />
  );
}

export default function EnhancedCollaboratePage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <EnhancedCollaborateContent />
      </Suspense>
    </div>
  );
}
