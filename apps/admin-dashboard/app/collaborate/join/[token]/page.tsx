'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Users, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function GuestJoinPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ['invite', token],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/thinktank/collaboration/invites/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Invite not found');
      }
      const { data } = await res.json();
      return data;
    },
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/thinktank/collaboration/guests/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteToken: token,
          displayName,
          email: email || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to join');
      }
      const { data } = await res.json();
      return data;
    },
    onSuccess: (data) => {
      // Store guest token in localStorage for session persistence
      localStorage.setItem(`guest_token_${data.sessionId}`, data.guestToken);
      // Redirect to the collaborative session
      router.push(`/thinktank/collaborate/enhanced?session=${data.sessionId}&guest=${data.guestToken}`);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              {(error as Error)?.message || 'This invitation link is invalid or has expired.'}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => router.push('/')}>
              Go Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const isExpired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
  const isMaxUsed = invite.maxUses > 0 && invite.usedCount >= invite.maxUses;

  if (isExpired || isMaxUsed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              {isExpired ? 'This invitation has expired.' : 'This invitation has reached its maximum uses.'}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => router.push('/')}>
              Go Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
            <Users className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Join Collaborative Session</CardTitle>
          <CardDescription>
            You&apos;ve been invited to collaborate on a Think Tank session
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Session Info */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Session</span>
              <span className="font-medium">{invite.sessionName || 'Collaborative Session'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Your Role</span>
              <Badge variant="secondary">{invite.permission}</Badge>
            </div>
            {invite.inviterName && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Invited by</span>
                <span className="font-medium">{invite.inviterName}</span>
              </div>
            )}
          </div>

          {/* Join Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="displayName">Your Name *</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we call you?"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="For notifications about this session"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                We&apos;ll only use this to notify you about session activity
              </p>
            </div>
          </div>

          {joinMutation.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {(joinMutation.error as Error).message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter>
          <Button
            onClick={() => joinMutation.mutate()}
            disabled={!displayName.trim() || joinMutation.isPending}
            className="w-full"
            size="lg"
          >
            {joinMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Join Session
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
