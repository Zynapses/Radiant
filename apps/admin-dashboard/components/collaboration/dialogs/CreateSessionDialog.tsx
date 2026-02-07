'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Sparkles,
  GitBranch,
  Bot,
  Globe,
  Lock,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  Mic,
  Video,
  MessageSquare,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: string;
}

export function CreateSessionDialog({ open, onOpenChange, template }: CreateSessionDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [enableFacilitator, setEnableFacilitator] = useState(true);
  const [enableBranching, setEnableBranching] = useState(true);
  const [enableRoundtable, setEnableRoundtable] = useState(true);
  const [enableVoice, setEnableVoice] = useState(false);
  const [enableVideo, setEnableVideo] = useState(false);
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/thinktank/collaborate/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'New Collaboration',
          description,
          isPublic,
          settings: {
            enableFacilitator,
            enableBranching,
            enableRoundtable,
            enableVoice,
            enableVideo,
          },
          inviteEmails,
        }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['collaboration-sessions'] });
      onOpenChange(false);
      router.push(`/collaborate/${data.id}`);
    },
  });

  const addEmail = () => {
    if (newEmail && !inviteEmails.includes(newEmail)) {
      setInviteEmails([...inviteEmails, newEmail]);
      setNewEmail('');
    }
  };

  const removeEmail = (email: string) => {
    setInviteEmails(inviteEmails.filter((e) => e !== email));
  };

  const resetForm = () => {
    setStep(1);
    setName('');
    setDescription('');
    setIsPublic(false);
    setEnableFacilitator(true);
    setEnableBranching(true);
    setEnableRoundtable(true);
    setEnableVoice(false);
    setEnableVideo(false);
    setInviteEmails([]);
    setNewEmail('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Create Collaboration Session
          </DialogTitle>
          <DialogDescription>
            Set up a real-time collaboration space with AI superpowers
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : step > s
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && (
                <div className={cn('w-12 h-0.5', step > s ? 'bg-green-500' : 'bg-muted')} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="name">Session Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Q1 Strategy Planning"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will you collaborate on?"
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  {isPublic ? (
                    <Globe className="h-5 w-5 text-green-500" />
                  ) : (
                    <Lock className="h-5 w-5 text-amber-500" />
                  )}
                  <div>
                    <p className="font-medium">{isPublic ? 'Public Session' : 'Private Session'}</p>
                    <p className="text-sm text-muted-foreground">
                      {isPublic
                        ? 'Anyone with the link can join'
                        : 'Only invited participants can join'}
                    </p>
                  </div>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground mb-4">
                Choose which AI-powered features to enable for this session
              </p>

              <div className="grid gap-3">
                {[
                  {
                    id: 'facilitator',
                    icon: Sparkles,
                    label: 'AI Facilitator',
                    description: 'AI guides discussions, summarizes, and resolves conflicts',
                    enabled: enableFacilitator,
                    setEnabled: setEnableFacilitator,
                    color: 'text-violet-500',
                    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
                  },
                  {
                    id: 'branching',
                    icon: GitBranch,
                    label: 'Conversation Branching',
                    description: 'Fork conversations to explore different directions',
                    enabled: enableBranching,
                    setEnabled: setEnableBranching,
                    color: 'text-green-500',
                    bgColor: 'bg-green-100 dark:bg-green-900/30',
                  },
                  {
                    id: 'roundtable',
                    icon: Bot,
                    label: 'AI Roundtable',
                    description: 'Multiple AI models debate and synthesize insights',
                    enabled: enableRoundtable,
                    setEnabled: setEnableRoundtable,
                    color: 'text-blue-500',
                    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
                  },
                  {
                    id: 'voice',
                    icon: Mic,
                    label: 'Voice Chat',
                    description: 'Enable real-time voice communication',
                    enabled: enableVoice,
                    setEnabled: setEnableVoice,
                    color: 'text-amber-500',
                    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
                  },
                  {
                    id: 'video',
                    icon: Video,
                    label: 'Video Chat',
                    description: 'Enable video conferencing',
                    enabled: enableVideo,
                    setEnabled: setEnableVideo,
                    color: 'text-rose-500',
                    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
                  },
                ].map((feature) => (
                  <div
                    key={feature.id}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-lg border transition-all',
                      feature.enabled && 'border-primary/50 bg-primary/5'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', feature.bgColor)}>
                        <feature.icon className={cn('h-5 w-5', feature.color)} />
                      </div>
                      <div>
                        <p className="font-medium">{feature.label}</p>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                    <Switch checked={feature.enabled} onCheckedChange={feature.setEnabled} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground mb-4">
                Invite team members to join your session
              </p>

              <div className="flex gap-2">
                <Input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter email address"
                  onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                />
                <Button onClick={addEmail} disabled={!newEmail}>
                  Add
                </Button>
              </div>

              {inviteEmails.length > 0 ? (
                <div className="space-y-2">
                  {inviteEmails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {email.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{email}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEmail(email)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No invites yet</p>
                  <p className="text-sm">You can always invite people later</p>
                </div>
              )}

              {/* Summary */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <h4 className="font-medium">Session Summary</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Name:</strong> {name || 'Untitled Session'}</p>
                  <p><strong>Visibility:</strong> {isPublic ? 'Public' : 'Private'}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {enableFacilitator && <Badge variant="secondary">AI Facilitator</Badge>}
                    {enableBranching && <Badge variant="secondary">Branching</Badge>}
                    {enableRoundtable && <Badge variant="secondary">Roundtable</Badge>}
                    {enableVoice && <Badge variant="secondary">Voice</Badge>}
                    {enableVideo && <Badge variant="secondary">Video</Badge>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
              Create Session
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
