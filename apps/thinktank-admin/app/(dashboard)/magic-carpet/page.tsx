'use client';

/**
 * Magic Carpet Demo Page
 * 
 * Showcases all the Magic Carpet UI components:
 * - Magic Carpet Navigator
 * - Reality Scrubber Timeline
 * - Quantum Split View
 * - Pre-Cognition Suggestions
 * - AI Presence Indicator
 * - Spatial Glass Effects
 * - Focus Mode
 */

import React, { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  Compass,
  Clock,
  GitBranch,
  Brain,
  Eye,
  Layers,
} from 'lucide-react';

import {
  MagicCarpetNavigator,
  RealityScrubberTimeline,
  QuantumSplitView,
  PreCognitionSuggestions,
  AIPresenceIndicator,
  SpatialGlassCard,
  GlassButton,
  GlassBadge,
  FocusModeControls,
} from '@/components/magic-carpet';

// Demo data
const DEMO_JOURNEY = [
  {
    id: '1',
    destination: { id: 'dashboard', type: 'dashboard', name: 'Command Center', icon: '🏠' },
    arrivedAt: new Date(Date.now() - 3600000),
  },
  {
    id: '2',
    destination: { id: 'workspace', type: 'workspace', name: 'Workshop', icon: '🔨' },
    arrivedAt: new Date(Date.now() - 1800000),
  },
  {
    id: '3',
    destination: { id: 'oracle', type: 'oracle', name: "Oracle's Chamber", icon: '🔮' },
    arrivedAt: new Date(),
  },
];

const DEMO_PREDICTIONS = [
  { id: '1', intent: 'action', prompt: 'Export to PDF', confidence: 0.92, isReady: true, estimatedLatencySavedMs: 340, category: 'action' as const },
  { id: '2', intent: 'navigation', prompt: 'View Analytics Dashboard', confidence: 0.85, isReady: true, estimatedLatencySavedMs: 220, category: 'navigation' as const },
  { id: '3', intent: 'creation', prompt: 'Create new chart', confidence: 0.78, isReady: false, category: 'creation' as const },
];

const DEMO_SNAPSHOTS = Array.from({ length: 20 }, (_, i) => ({
  id: `snap-${i}`,
  position: i,
  timestamp: new Date(Date.now() - (20 - i) * 180000),
  triggerEvent: ['user_action', 'ai_generation', 'db_mutation', 'morph_transition', 'auto_interval'][i % 5] as 'user_action' | 'ai_generation' | 'db_mutation' | 'morph_transition' | 'auto_interval',
  isBookmark: i === 5 || i === 12,
  label: i === 5 ? 'Before DB change' : i === 12 ? 'Stable state' : undefined,
  stats: {
    filesChanged: Math.floor(Math.random() * 5),
    dbMutations: Math.floor(Math.random() * 3),
    ghostBindings: Math.floor(Math.random() * 10),
  },
}));

const DEMO_BRANCHES = [
  {
    id: 'branch-a',
    name: 'Redux Implementation',
    description: 'Traditional state management',
    color: 'blue',
    status: 'active' as const,
    createdAt: new Date(Date.now() - 600000),
    metrics: {
      completionPercent: 45,
      estimatedCost: 0.12,
      interactions: 12,
      timeSpent: 320,
    },
    highlights: ['Type safety', 'Dev tools', 'Large ecosystem'],
    warnings: ['Boilerplate heavy'],
  },
  {
    id: 'branch-b',
    name: 'Zustand Implementation',
    description: 'Minimal state management',
    color: 'purple',
    status: 'active' as const,
    createdAt: new Date(Date.now() - 600000),
    metrics: {
      completionPercent: 60,
      estimatedCost: 0.08,
      interactions: 28,
      timeSpent: 450,
    },
    highlights: ['Simple setup', 'Less boilerplate', 'Smaller bundle'],
    warnings: [],
  },
];

export default function MagicCarpetDemoPage() {
  const { toast } = useToast();
  const [currentPosition, setCurrentPosition] = useState(15);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiState, setAiState] = useState<'idle' | 'thinking' | 'speaking' | 'listening' | 'error'>('idle');
  const [activeBranchId, setActiveBranchId] = useState('branch-b');
  const [bookmarks, setBookmarks] = useState<Array<{ position: number; label: string }>>([]);
  const [focusActive, setFocusActive] = useState(false);
  const [focusIntensity, setFocusIntensity] = useState(70);

  return (
    <div className="space-y-8 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <span className="text-4xl">🧞</span>
            Magic Carpet UI
          </h1>
          <p className="text-muted-foreground mt-1">
            2026 UI/UX components for Think Tank
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            v5.16.0
          </Badge>
          <FocusModeControls
            isActive={focusActive}
            onToggle={() => setFocusActive(!focusActive)}
            focusIntensity={focusIntensity}
            onIntensityChange={setFocusIntensity}
            showTimer
          />
        </div>
      </div>

      <Tabs defaultValue="navigator" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="navigator" className="gap-2">
            <Compass className="h-4 w-4" />
            Navigator
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <Clock className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="quantum" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Quantum
          </TabsTrigger>
          <TabsTrigger value="precognition" className="gap-2">
            <Brain className="h-4 w-4" />
            Pre-Cognition
          </TabsTrigger>
          <TabsTrigger value="presence" className="gap-2">
            <Eye className="h-4 w-4" />
            AI Presence
          </TabsTrigger>
          <TabsTrigger value="glass" className="gap-2">
            <Layers className="h-4 w-4" />
            Glass Effects
          </TabsTrigger>
        </TabsList>

        {/* Magic Carpet Navigator */}
        <TabsContent value="navigator" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Compass className="h-5 w-5" />
                Magic Carpet Navigator
              </CardTitle>
              <CardDescription>
                Bottom navigation bar with journey breadcrumbs and destination selector
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The Magic Carpet Navigator provides intent-based navigation. Say where you want to go,
                and the interface morphs to take you there. Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘K</kbd> to open the destination selector.
              </p>
              
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  The navigator is displayed at the bottom of the screen. Scroll down to see it.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reality Scrubber Timeline */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Reality Scrubber Timeline
              </CardTitle>
              <CardDescription>
                Video-editor style timeline for navigating through state snapshots
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RealityScrubberTimeline
                snapshots={DEMO_SNAPSHOTS}
                currentPosition={currentPosition}
                isPlaying={isPlaying}
                onScrubTo={setCurrentPosition}
                onCreateBookmark={(label) => {
                  setBookmarks(prev => [...prev, { position: currentPosition, label }]);
                  toast({ title: 'Bookmark Created', description: `"${label}" at position ${currentPosition}` });
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quantum Split View */}
        <TabsContent value="quantum" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Quantum Split View
              </CardTitle>
              <CardDescription>
                Side-by-side comparison of parallel realities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuantumSplitView
                branches={DEMO_BRANCHES}
                activeBranchId={activeBranchId}
                onSelectBranch={(id) => {
                  setActiveBranchId(id);
                  toast({ title: 'Branch Selected', description: `Switched to ${DEMO_BRANCHES.find(b => b.id === id)?.name}` });
                }}
                onCollapse={(winnerId) => {
                  const winner = DEMO_BRANCHES.find(b => b.id === winnerId);
                  toast({ title: 'Branch Collapsed', description: `Collapsed to "${winner?.name}"` });
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pre-Cognition Suggestions */}
        <TabsContent value="precognition" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Pre-Cognition Suggestions
              </CardTitle>
              <CardDescription>
                Predicted actions that are already pre-computed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PreCognitionSuggestions
                predictions={DEMO_PREDICTIONS}
                telepathyScore={0.82}
                isActive
                onSelectPrediction={(p) => {
                  toast({ title: 'Prediction Selected', description: `Executing: ${p.prompt}` });
                }}
                onDismiss={(id) => {
                  toast({ title: 'Prediction Dismissed', description: `Removed suggestion ${id}` });
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Presence Indicator */}
        <TabsContent value="presence" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                AI Presence Indicator
              </CardTitle>
              <CardDescription>
                Shows the AI&apos;s current cognitive and emotional state
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-4">
                <Button variant="outline" size="sm" onClick={() => setAiState('idle')}>
                  Idle
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAiState('thinking')}>
                  Thinking
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAiState('generating')}>
                  Generating
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAiState('confident')}>
                  Confident
                </Button>
              </div>

              <Separator />

              <div className="flex justify-center">
                <AIPresenceIndicator
                  state={aiState}
                  affect={{
                    valence: 0.6,
                    arousal: 0.4,
                    curiosity: 0.8,
                    confidence: 0.85,
                    frustration: 0.1,
                  }}
                  currentTask="Analyzing user intent..."
                  modelName="claude-3.5-sonnet"
                  thinkingDuration={aiState === 'thinking' ? 2500 : 0}
                  isStreaming={aiState === 'generating'}
                  tokensGenerated={aiState === 'generating' ? 142 : 0}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spatial Glass Effects */}
        <TabsContent value="glass" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Spatial Glass Effects
              </CardTitle>
              <CardDescription>
                Glassmorphism components with depth perception
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Glass Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SpatialGlassCard variant="subtle" layer="base" className="p-4">
                  <p className="text-sm font-medium">Subtle / Base</p>
                  <p className="text-xs text-muted-foreground">Minimal effect</p>
                </SpatialGlassCard>
                
                <SpatialGlassCard variant="medium" layer="raised" className="p-4">
                  <p className="text-sm font-medium">Medium / Raised</p>
                  <p className="text-xs text-muted-foreground">Default style</p>
                </SpatialGlassCard>
                
                <SpatialGlassCard variant="strong" layer="floating" glow glowColor="purple" className="p-4">
                  <p className="text-sm font-medium">Strong / Floating</p>
                  <p className="text-xs text-muted-foreground">With glow</p>
                </SpatialGlassCard>
                
                <SpatialGlassCard variant="solid" layer="overlay" glow glowColor="cyan" className="p-4">
                  <p className="text-sm font-medium">Solid / Overlay</p>
                  <p className="text-xs text-muted-foreground">Maximum depth</p>
                </SpatialGlassCard>
              </div>

              <Separator />

              {/* Glass Buttons */}
              <div className="flex flex-wrap gap-3">
                <GlassButton>Default</GlassButton>
                <GlassButton variant="primary">Primary</GlassButton>
                <GlassButton variant="danger">Danger</GlassButton>
                <GlassButton glow>With Glow</GlassButton>
              </div>

              <Separator />

              {/* Glass Badges */}
              <div className="flex flex-wrap gap-2">
                <GlassBadge>Default</GlassBadge>
                <GlassBadge color="success" pulse>Success</GlassBadge>
                <GlassBadge color="warning">Warning</GlassBadge>
                <GlassBadge color="error">Error</GlassBadge>
                <GlassBadge color="info">Info</GlassBadge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Magic Carpet Navigator (Fixed at bottom) */}
      <MagicCarpetNavigator
        currentDestination={DEMO_JOURNEY[DEMO_JOURNEY.length - 1].destination}
        journey={DEMO_JOURNEY}
        telepathyScore={0.82}
        mode="hovering"
        altitude="medium"
        onFly={(dest) => {
          toast({ title: 'Flying to Destination', description: `Navigating to ${dest.name}` });
        }}
        onLand={() => {
          toast({ title: 'Landed', description: 'Magic Carpet has landed' });
        }}
      />
    </div>
  );
}
