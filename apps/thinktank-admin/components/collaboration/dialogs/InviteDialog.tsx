'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link2, Mail, Copy, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
}

export function InviteDialog({ open, onOpenChange, sessionId }: InviteDialogProps) {
  const [inviteType, setInviteType] = useState<'link' | 'email'>('link');
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('commenter');
  const [copied, setCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<{ data: { inviteToken: string } }>('/api/thinktank/collaboration/invites', {
        sessionId,
        inviteType,
        guestEmail: inviteType === 'email' ? email : undefined,
        permission,
        maxUses: inviteType === 'link' ? 0 : 1,
      });
      return response.data;
    },
    onSuccess: (data) => {
      const link = `${window.location.origin}/collaborate/join/${data.inviteToken}`;
      setGeneratedLink(link);
    },
  });

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Collaborators</DialogTitle>
          <DialogDescription>
            Invite anyone to join this session — even people outside your organization
          </DialogDescription>
        </DialogHeader>

        <Tabs value={inviteType} onValueChange={(v) => setInviteType(v as 'link' | 'email')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="gap-2">
              <Link2 className="h-4 w-4" />
              Share Link
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Email Invite
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 mt-4">
            <div>
              <Label>Permission Level</Label>
              <Select value={permission} onValueChange={setPermission}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer — Can read only</SelectItem>
                  <SelectItem value="commenter">Commenter — Can add comments</SelectItem>
                  <SelectItem value="editor">Editor — Full participation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {generatedLink ? (
              <div className="space-y-2">
                <Label>Share this link</Label>
                <div className="flex gap-2">
                  <Input value={generatedLink} readOnly className="flex-1" />
                  <Button onClick={copyLink} variant="outline">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Anyone with this link can join as a guest
                </p>
              </div>
            ) : (
              <Button
                onClick={() => createInviteMutation.mutate()}
                disabled={createInviteMutation.isPending}
                className="w-full"
              >
                {createInviteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Generate Link
              </Button>
            )}
          </TabsContent>

          <TabsContent value="email" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="collaborator@example.com"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Permission Level</Label>
              <Select value={permission} onValueChange={setPermission}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="commenter">Commenter</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => createInviteMutation.mutate()}
              disabled={!email || createInviteMutation.isPending}
              className="w-full"
            >
              {createInviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Invitation
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
