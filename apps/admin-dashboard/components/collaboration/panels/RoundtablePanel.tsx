'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bot, Sparkles, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface RoundtablePanelProps {
  session: any;
  currentUserId: string;
}

export function RoundtablePanel({ session, currentUserId: _currentUserId }: RoundtablePanelProps) {
  void _currentUserId; // Reserved for user-specific roundtable operations
  const [showCreateRoundtable, setShowCreateRoundtable] = useState(false);
  const queryClient = useQueryClient();

  const createRoundtableMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${API_BASE}/api/thinktank/collaboration/roundtables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, ...data }),
      });
      if (!res.ok) throw new Error('Failed to create roundtable');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-session', session.id] });
      setShowCreateRoundtable(false);
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full flex flex-col p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Roundtable
          </h3>
          <p className="text-sm text-muted-foreground">
            Watch multiple AI models debate and synthesize insights
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateRoundtable(true)} className="gap-1">
          <Sparkles className="h-4 w-4" />
          Start Roundtable
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {session.roundtables?.length > 0 ? (
          <div className="space-y-4">
            {session.roundtables.map((roundtable: any) => (
              <RoundtableCard key={roundtable.id} roundtable={roundtable} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <div className="flex justify-center gap-2 mb-4">
              {['🤖', '🧠', '💡'].map((emoji, i) => (
                <span key={i} className="text-4xl opacity-50">{emoji}</span>
              ))}
            </div>
            <p>No roundtables yet</p>
            <p className="text-sm mt-1">Start an AI debate to explore multiple perspectives</p>
          </div>
        )}
      </ScrollArea>

      <Dialog open={showCreateRoundtable} onOpenChange={setShowCreateRoundtable}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start AI Roundtable</DialogTitle>
            <DialogDescription>Configure which AI models will participate in the discussion</DialogDescription>
          </DialogHeader>
          <CreateRoundtableForm
            onSubmit={(data) => createRoundtableMutation.mutate(data)}
            isPending={createRoundtableMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function RoundtableCard({ roundtable }: { roundtable: any }) {
  const statusColors: Record<string, string> = {
    setup: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    paused: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-medium">{roundtable.topic}</h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={statusColors[roundtable.status] || statusColors.setup}>
                {roundtable.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Round {roundtable.currentRound} of {roundtable.maxRounds}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {roundtable.models?.slice(0, 4).map((model: any, i: number) => (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                    style={{ backgroundColor: model.color || '#6366f1' }}
                  >
                    {model.modelId.slice(0, 2).toUpperCase()}
                  </div>
                </TooltipTrigger>
                <TooltipContent>{model.modelId} • {model.role || 'Participant'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          {roundtable.models?.length > 4 && (
            <span className="text-xs text-muted-foreground">+{roundtable.models.length - 4} more</span>
          )}
        </div>

        <Progress value={(roundtable.currentRound / roundtable.maxRounds) * 100} className="h-1" />

        {roundtable.status === 'completed' && roundtable.synthesis && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-1">Synthesis</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{roundtable.synthesis}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateRoundtableForm({ onSubmit, isPending }: { onSubmit: (data: any) => void; isPending: boolean }) {
  const [topic, setTopic] = useState('');
  const [debateStyle, setDebateStyle] = useState('collaborative');
  const [selectedModels, setSelectedModels] = useState<string[]>(['claude-3-5-sonnet', 'gpt-4o']);

  const availableModels = [
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', role: 'Balanced Analyst' },
    { id: 'gpt-4o', name: 'GPT-4o', role: 'Creative Thinker' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', role: 'Research Expert' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', role: 'Deep Reasoner' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', role: 'Quick Responder' },
  ];

  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) => prev.includes(modelId) ? prev.filter((m) => m !== modelId) : [...prev, modelId]);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="topic">Discussion Topic</Label>
        <Textarea id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What should the AI models discuss?" className="mt-1" />
      </div>

      <div>
        <Label>Debate Style</Label>
        <Select value={debateStyle} onValueChange={setDebateStyle}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="collaborative">Collaborative - Build on each other</SelectItem>
            <SelectItem value="adversarial">Adversarial - Challenge each other</SelectItem>
            <SelectItem value="socratic">Socratic - Question-based exploration</SelectItem>
            <SelectItem value="brainstorm">Brainstorm - Free-form ideation</SelectItem>
            <SelectItem value="devils_advocate">Devil&apos;s Advocate - Counter arguments</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Participating Models</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {availableModels.map((model) => (
            <button
              key={model.id}
              onClick={() => toggleModel(model.id)}
              className={`p-3 rounded-lg border text-left transition-all ${selectedModels.includes(model.id) ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'}`}
            >
              <div className="font-medium text-sm">{model.name}</div>
              <div className="text-xs text-muted-foreground">{model.role}</div>
            </button>
          ))}
        </div>
      </div>

      <Button
        onClick={() => onSubmit({
          topic,
          debateStyle,
          models: selectedModels.map((id) => {
            const model = availableModels.find((m) => m.id === id);
            return { modelId: id, persona: model?.role || 'Participant', role: model?.role };
          }),
        })}
        disabled={!topic.trim() || selectedModels.length < 2 || isPending}
        className="w-full"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
        Start Roundtable
      </Button>
    </div>
  );
}
