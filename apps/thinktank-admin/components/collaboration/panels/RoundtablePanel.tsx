'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Plus, Play, Pause, Users, MessageSquare, Sparkles, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RoundtablePanelProps {
  session: any;
  currentUserId: string;
}

const AI_MODELS = [
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
  { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', provider: 'Meta' },
];

export function RoundtablePanel({ session, currentUserId }: RoundtablePanelProps) {
  const [showNewRoundtable, setShowNewRoundtable] = useState(false);
  const [topic, setTopic] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>(['claude-3-5-sonnet', 'gpt-4o']);
  const [rounds, setRounds] = useState('3');
  const queryClient = useQueryClient();

  const createRoundtableMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/thinktank/collaboration/roundtables`, {
        sessionId: session.id,
        topic,
        models: selectedModels,
        maxRounds: parseInt(rounds),
      });
      return response;
    },
    onSuccess: () => {
      setShowNewRoundtable(false);
      setTopic('');
      queryClient.invalidateQueries({ queryKey: ['enhanced-session', session.id] });
    },
  });

  const toggleModel = (modelId: string) => {
    setSelectedModels(prev => prev.includes(modelId) ? prev.filter(m => m !== modelId) : [...prev, modelId]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full flex flex-col"
    >
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Roundtables
          </h3>
          <p className="text-sm text-muted-foreground">Have multiple AI models debate and discuss</p>
        </div>
        <Dialog open={showNewRoundtable} onOpenChange={setShowNewRoundtable}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Start Roundtable
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Start AI Roundtable</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Discussion Topic</Label>
                <Textarea
                  placeholder="What should the AI models discuss?"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Participating Models</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {AI_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => toggleModel(model.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedModels.includes(model.id) ? 'border-primary bg-primary/10' : 'hover:border-primary/50'
                      }`}
                    >
                      <p className="font-medium text-sm">{model.name}</p>
                      <p className="text-xs text-muted-foreground">{model.provider}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Discussion Rounds</Label>
                <Select value={rounds} onValueChange={setRounds}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 rounds</SelectItem>
                    <SelectItem value="3">3 rounds</SelectItem>
                    <SelectItem value="5">5 rounds</SelectItem>
                    <SelectItem value="10">10 rounds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewRoundtable(false)}>Cancel</Button>
              <Button onClick={() => createRoundtableMutation.mutate()} disabled={!topic || selectedModels.length < 2 || createRoundtableMutation.isPending}>
                {createRoundtableMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Play className="h-4 w-4 mr-1" />
                Start Discussion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <AnimatePresence>
            {session.roundtables?.map((roundtable: any) => (
              <motion.div key={roundtable.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{roundtable.topic}</CardTitle>
                      <Badge variant={roundtable.status === 'active' ? 'default' : roundtable.status === 'completed' ? 'secondary' : 'outline'} className="gap-1">
                        {roundtable.status === 'active' && <><Play className="h-3 w-3" /> In Progress</>}
                        {roundtable.status === 'completed' && <><CheckCircle2 className="h-3 w-3" /> Completed</>}
                        {roundtable.status === 'paused' && <><Pause className="h-3 w-3" /> Paused</>}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" /> {roundtable.models?.length || 0} models
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" /> {roundtable.currentRound}/{roundtable.maxRounds} rounds
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" /> {new Date(roundtable.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {roundtable.status === 'active' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Progress</span>
                          <span>{Math.round((roundtable.currentRound / roundtable.maxRounds) * 100)}%</span>
                        </div>
                        <Progress value={(roundtable.currentRound / roundtable.maxRounds) * 100} />
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        {roundtable.models?.map((modelId: string) => {
                          const model = AI_MODELS.find(m => m.id === modelId);
                          return (
                            <Tooltip key={modelId}>
                              <TooltipTrigger asChild>
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                                  {(model?.name || modelId).slice(0, 2).toUpperCase()}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>{model?.name || modelId}</TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </TooltipProvider>
                    </div>
                    {roundtable.synthesis && (
                      <div className="p-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-violet-500" />
                          <span className="text-sm font-medium">Synthesis</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{roundtable.synthesis}</p>
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="w-full">
                      View Full Discussion
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {(!session.roundtables || session.roundtables.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No roundtables yet</p>
              <p className="text-sm mt-1">Start a roundtable to have multiple AI models discuss a topic</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  );
}
