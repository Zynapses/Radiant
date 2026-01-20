'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface FacilitatorSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: any;
}

export function FacilitatorSettingsDialog({ open, onOpenChange, session }: FacilitatorSettingsDialogProps) {
  const queryClient = useQueryClient();
  const [objective, setObjective] = useState(session.facilitator?.sessionObjective || '');
  const [persona, setPersona] = useState(session.facilitator?.facilitatorPersona || 'professional');
  const [settings, setSettings] = useState({
    autoSummarize: session.facilitator?.autoSummarize ?? true,
    autoActionItems: session.facilitator?.autoActionItems ?? true,
    ensureParticipation: session.facilitator?.ensureParticipation ?? true,
    keepOnTopic: session.facilitator?.keepOnTopic ?? true,
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/thinktank/collaboration/facilitator/enable', {
        sessionId: session.id,
        objective,
        persona,
        settings,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-session', session.id] });
      onOpenChange(false);
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/thinktank/collaboration/sessions/${session.id}/facilitator`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-session', session.id] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            AI Facilitator Settings
          </DialogTitle>
          <DialogDescription>
            Configure how the AI moderates and guides your session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="objective">Session Objective</Label>
            <Textarea
              id="objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="What should this session accomplish?"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Facilitator Persona</Label>
            <Select value={persona} onValueChange={setPersona}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional — Business-like moderation</SelectItem>
                <SelectItem value="casual">Casual — Friendly and relaxed</SelectItem>
                <SelectItem value="academic">Academic — Scholarly discussion</SelectItem>
                <SelectItem value="creative">Creative — Imaginative exploration</SelectItem>
                <SelectItem value="socratic">Socratic — Question-based learning</SelectItem>
                <SelectItem value="coach">Coach — Encouraging growth</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Behaviors</Label>

            <div className="flex items-center justify-between">
              <Label htmlFor="autoSummarize" className="font-normal">
                Auto-summarize periodically
              </Label>
              <Switch
                id="autoSummarize"
                checked={settings.autoSummarize}
                onCheckedChange={(v) => setSettings({ ...settings, autoSummarize: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="autoActionItems" className="font-normal">
                Extract action items
              </Label>
              <Switch
                id="autoActionItems"
                checked={settings.autoActionItems}
                onCheckedChange={(v) => setSettings({ ...settings, autoActionItems: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="ensureParticipation" className="font-normal">
                Encourage quiet participants
              </Label>
              <Switch
                id="ensureParticipation"
                checked={settings.ensureParticipation}
                onCheckedChange={(v) => setSettings({ ...settings, ensureParticipation: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="keepOnTopic" className="font-normal">
                Redirect off-topic discussions
              </Label>
              <Switch
                id="keepOnTopic"
                checked={settings.keepOnTopic}
                onCheckedChange={(v) => setSettings({ ...settings, keepOnTopic: v })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            {session.facilitator?.isEnabled ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => disableMutation.mutate()}
                  disabled={disableMutation.isPending}
                  className="flex-1"
                >
                  {disableMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Disable Facilitator
                </Button>
                <Button
                  onClick={() => enableMutation.mutate()}
                  disabled={enableMutation.isPending}
                  className="flex-1"
                >
                  {enableMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Update Settings
                </Button>
              </>
            ) : (
              <Button
                onClick={() => enableMutation.mutate()}
                disabled={enableMutation.isPending}
                className="w-full"
              >
                {enableMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Enable AI Facilitator
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
