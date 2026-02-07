'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  MessageSquare,
  Lightbulb,
  Swords,
  Scale,
  Brain,
  Zap,
  CheckCircle2,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Download,
  Settings,
  ChevronDown,
  ChevronUp,
  Users,
  Mic,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface AIModel {
  id: string;
  name: string;
  shortName: string;
  color: string;
  role: string;
  avatar?: string;
  strengths: string[];
}

interface RoundtableContribution {
  id: string;
  roundId: number;
  modelId: string;
  content: string;
  timestamp: Date;
  referencedContributions?: string[];
  agreement?: number; // -1 to 1 scale
  keyPoints?: string[];
}

interface Roundtable {
  id: string;
  topic: string;
  debateStyle: 'collaborative' | 'adversarial' | 'socratic' | 'brainstorm' | 'devils_advocate';
  status: 'setup' | 'active' | 'paused' | 'completed';
  currentRound: number;
  maxRounds: number;
  models: AIModel[];
  contributions: RoundtableContribution[];
  synthesis?: string;
  keyInsights?: string[];
  createdAt: Date;
}

interface AIRoundtableViewProps {
  roundtable: Roundtable;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onNextRound: () => void;
  onReset: () => void;
  onVote: (contributionId: string, vote: 'up' | 'down') => void;
}

const debateStyleConfig = {
  collaborative: {
    icon: Users,
    label: 'Collaborative',
    description: 'Models build on each other\'s ideas',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  adversarial: {
    icon: Swords,
    label: 'Adversarial',
    description: 'Models challenge and debate each other',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  socratic: {
    icon: Brain,
    label: 'Socratic',
    description: 'Question-based exploration',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  brainstorm: {
    icon: Lightbulb,
    label: 'Brainstorm',
    description: 'Free-form ideation',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  devils_advocate: {
    icon: Scale,
    label: 'Devil\'s Advocate',
    description: 'Counter-arguments for every point',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
};

export function AIRoundtableView({
  roundtable,
  onStart,
  onPause,
  onResume,
  onNextRound,
  onReset,
  onVote,
}: AIRoundtableViewProps) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [showSynthesis, setShowSynthesis] = useState(true);
  const [activeTab, setActiveTab] = useState<'debate' | 'synthesis' | 'insights'>('debate');
  const scrollRef = useRef<HTMLDivElement>(null);

  const styleConfig = debateStyleConfig[roundtable.debateStyle];
  const StyleIcon = styleConfig.icon;

  // Auto-scroll on new contributions
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [roundtable.contributions]);

  // Group contributions by round
  const contributionsByRound = roundtable.contributions.reduce((acc, contribution) => {
    if (!acc[contribution.roundId]) {
      acc[contribution.roundId] = [];
    }
    acc[contribution.roundId].push(contribution);
    return acc;
  }, {} as Record<number, RoundtableContribution[]>);

  const getModel = (modelId: string) => roundtable.models.find((m) => m.id === modelId);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background to-muted/20">
      {/* Header */}
      <div className="p-4 border-b bg-background/80 backdrop-blur">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Bot className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">{roundtable.topic}</h2>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={cn('gap-1', styleConfig.bgColor, styleConfig.color)}>
                <StyleIcon className="h-3 w-3" />
                {styleConfig.label}
              </Badge>
              <Badge variant="outline">
                Round {roundtable.currentRound} of {roundtable.maxRounds}
              </Badge>
              <StatusBadge status={roundtable.status} />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {roundtable.status === 'setup' && (
              <Button onClick={onStart} className="gap-2">
                <Play className="h-4 w-4" />
                Start Debate
              </Button>
            )}
            {roundtable.status === 'active' && (
              <>
                <Button variant="outline" size="icon" onClick={onPause}>
                  <Pause className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={onNextRound} className="gap-1">
                  <SkipForward className="h-4 w-4" />
                  Next Round
                </Button>
              </>
            )}
            {roundtable.status === 'paused' && (
              <Button onClick={onResume} className="gap-2">
                <Play className="h-4 w-4" />
                Resume
              </Button>
            )}
            {roundtable.status === 'completed' && (
              <Button variant="outline" onClick={onReset} className="gap-1">
                <RotateCcw className="h-4 w-4" />
                New Roundtable
              </Button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round((roundtable.currentRound / roundtable.maxRounds) * 100)}%</span>
          </div>
          <Progress value={(roundtable.currentRound / roundtable.maxRounds) * 100} className="h-2" />
        </div>

        {/* Model Avatars */}
        <div className="flex items-center gap-4 mt-4">
          <span className="text-sm text-muted-foreground">Participants:</span>
          <div className="flex -space-x-2">
            {roundtable.models.map((model) => (
              <TooltipProvider key={model.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className={cn(
                        'relative transition-all',
                        selectedModel === model.id && 'z-10 scale-110'
                      )}
                      onClick={() => setSelectedModel(selectedModel === model.id ? null : model.id)}
                    >
                      <Avatar className="h-10 w-10 border-2 border-background">
                        <AvatarFallback
                          style={{ backgroundColor: model.color }}
                          className="text-white text-xs font-medium"
                        >
                          {model.shortName}
                        </AvatarFallback>
                      </Avatar>
                      {roundtable.status === 'active' && (
                        <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{model.name}</p>
                    <p className="text-xs text-muted-foreground">{model.role}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
        <div className="border-b px-4">
          <TabsList className="h-10">
            <TabsTrigger value="debate" className="gap-1">
              <MessageSquare className="h-4 w-4" />
              Debate
            </TabsTrigger>
            <TabsTrigger value="synthesis" className="gap-1" disabled={!roundtable.synthesis}>
              <Sparkles className="h-4 w-4" />
              Synthesis
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1" disabled={!roundtable.keyInsights?.length}>
              <Lightbulb className="h-4 w-4" />
              Key Insights
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="debate" className="flex-1 m-0">
          <ScrollArea ref={scrollRef} className="h-full">
            <div className="p-4 space-y-6">
              {Object.entries(contributionsByRound).map(([round, contributions]) => (
                <RoundSection
                  key={round}
                  round={parseInt(round)}
                  contributions={contributions}
                  models={roundtable.models}
                  selectedModel={selectedModel}
                  onVote={onVote}
                  isCurrentRound={parseInt(round) === roundtable.currentRound}
                />
              ))}

              {roundtable.contributions.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center mx-auto mb-4">
                    <Bot className="h-10 w-10 text-violet-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Ready to Debate</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    {roundtable.models.length} AI models are ready to discuss &ldquo;{roundtable.topic}&rdquo;
                  </p>
                  {roundtable.status === 'setup' && (
                    <Button onClick={onStart} className="mt-4 gap-2">
                      <Play className="h-4 w-4" />
                      Start the Roundtable
                    </Button>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="synthesis" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-6 max-w-3xl mx-auto">
              {roundtable.synthesis ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-violet-500" />
                      AI Synthesis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p>{roundtable.synthesis}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                      <Button variant="outline" size="sm" className="gap-1">
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Download className="h-4 w-4" />
                        Export
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Synthesis will be generated when the debate completes</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="insights" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-6 max-w-3xl mx-auto">
              {roundtable.keyInsights && roundtable.keyInsights.length > 0 ? (
                <div className="space-y-4">
                  {roundtable.keyInsights.map((insight, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                              <Lightbulb className="h-4 w-4 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium mb-1">Insight #{index + 1}</p>
                              <p className="text-sm text-muted-foreground">{insight}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Key insights will be extracted as the debate progresses</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Round Section Component
function RoundSection({
  round,
  contributions,
  models,
  selectedModel,
  onVote,
  isCurrentRound,
}: {
  round: number;
  contributions: RoundtableContribution[];
  models: AIModel[];
  selectedModel: string | null;
  onVote: (id: string, vote: 'up' | 'down') => void;
  isCurrentRound: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const filteredContributions = selectedModel
    ? contributions.filter((c) => c.modelId === selectedModel)
    : contributions;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          <span className="font-medium">Round {round}</span>
          <Badge variant={isCurrentRound ? 'default' : 'secondary'} className="text-xs">
            {contributions.length} contributions
          </Badge>
          {isCurrentRound && (
            <Badge variant="outline" className="text-xs gap-1 ml-auto">
              <Zap className="h-3 w-3" />
              Current
            </Badge>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 mt-4 pl-6">
          {filteredContributions.map((contribution, index) => {
            const model = models.find((m) => m.id === contribution.modelId);
            if (!model) return null;

            return (
              <ContributionCard
                key={contribution.id}
                contribution={contribution}
                model={model}
                onVote={onVote}
                index={index}
              />
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Contribution Card Component
function ContributionCard({
  contribution,
  model,
  onVote,
  index,
}: {
  contribution: RoundtableContribution;
  model: AIModel;
  onVote: (id: string, vote: 'up' | 'down') => void;
  index: number;
}) {
  const [showKeyPoints, setShowKeyPoints] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="overflow-hidden">
        <div className="flex">
          {/* Model indicator */}
          <div
            className="w-1 flex-shrink-0"
            style={{ backgroundColor: model.color }}
          />
          
          <div className="flex-1 p-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback
                  style={{ backgroundColor: model.color }}
                  className="text-white text-xs font-medium"
                >
                  {model.shortName}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{model.name}</p>
                <p className="text-xs text-muted-foreground">{model.role}</p>
              </div>
              <span className="text-xs text-muted-foreground ml-auto">
                {formatTime(contribution.timestamp)}
              </span>
            </div>

            {/* Content */}
            <div className="prose prose-sm dark:prose-invert max-w-none mb-3">
              <p className="text-sm">{contribution.content}</p>
            </div>

            {/* Key Points */}
            {contribution.keyPoints && contribution.keyPoints.length > 0 && (
              <div className="mb-3">
                <button
                  className="text-xs text-primary flex items-center gap-1"
                  onClick={() => setShowKeyPoints(!showKeyPoints)}
                >
                  <Lightbulb className="h-3 w-3" />
                  {showKeyPoints ? 'Hide' : 'Show'} key points ({contribution.keyPoints.length})
                </button>
                <AnimatePresence>
                  {showKeyPoints && (
                    <motion.ul
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 space-y-1"
                    >
                      {contribution.keyPoints.map((point, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-primary">•</span>
                          {point}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1"
                      onClick={() => onVote(contribution.id, 'up')}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      Helpful
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark as helpful insight</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => onVote(contribution.id, 'down')}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Not helpful</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 ml-auto">
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: Roundtable['status'] }) {
  const config = {
    setup: { label: 'Setup', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
    active: { label: 'In Progress', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    paused: { label: 'Paused', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    completed: { label: 'Completed', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  };

  return (
    <Badge className={cn('gap-1', config[status].className)}>
      {status === 'active' && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
      {status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
      {status === 'paused' && <Pause className="h-3 w-3" />}
      {config[status].label}
    </Badge>
  );
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
