'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import EnhancedCollaborativeSession from '@/components/collaboration/EnhancedCollaborativeSession';
import { Loader2 } from 'lucide-react';

function CollaborateContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const userId = 'current-user-id'; // In production, get from auth context

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-muted-foreground">
        <p className="text-lg">No session specified</p>
        <p className="text-sm mt-2">Please select a session to join</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <EnhancedCollaborativeSession
        sessionId={sessionId}
        currentUserId={userId}
      />
    </div>
  );
}

export default function EnhancedCollaboratePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <CollaborateContent />
    </Suspense>
  );
}
