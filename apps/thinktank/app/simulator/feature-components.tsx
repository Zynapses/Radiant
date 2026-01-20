'use client';

/**
 * Think Tank Consumer App Simulator - Feature Components
 * v3.0 - Complex feature-specific components
 * v3.1 - Added Polymorphic UI/Agentic Morphing + Cost Estimation
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Loader2,
  AlertCircle,
  Check,
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Bookmark,
  BookmarkCheck,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  GitBranch,
  Zap,
  Brain,
  Sparkles,
  Settings2,
  Trash2,
  Move,
  DollarSign,
  Users,
  ArrowUp,
  Terminal,
  Map,
  FileCode,
  LayoutDashboard,
  MessageSquare,
  HelpCircle,
  Table,
  BarChart3,
  Kanban,
  Calculator,
  Code,
  FileText,
  Rocket,
  X,
  Clock,
  Activity,
} from 'lucide-react';

import type {
  VoiceState,
  BrainPlan,
  TimelineSnapshot,
  WorkflowStep,
  ModelOption,
  CatoMood,
} from './types';
import { GlassCard, Badge, IconBtn, Button, Modal, cn, ProgressBar } from './ui-components';
import { CATO_MOODS, ORCHESTRATION_MODES } from './mock-data';

// ============================================================================
// Advanced Mode Toggle
// ============================================================================
interface AdvancedModeToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export const AdvancedModeToggle: React.FC<AdvancedModeToggleProps> = ({
  enabled,
  onChange,
}) => (
  <button
    onClick={() => onChange(!enabled)}
    className={cn(
      'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm font-medium',
      enabled
        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
        : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
    )}
  >
    <Zap className="w-4 h-4" />
    Advanced
    {enabled && <Check className="w-3 h-3" />}
  </button>
);

// ============================================================================
// Model Selector
// ============================================================================
interface ModelSelectorProps {
  models: ModelOption[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModel,
  onSelect,
  isOpen,
  onToggle,
}) => {
  const selected = models.find((m) => m.id === selectedModel) || models[0];

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-sm"
      >
        <Brain className="w-4 h-4 text-blue-400" />
        <span className="text-white/70">{selected.name}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-white/50 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 z-50 w-80"
          >
            <GlassCard className="p-2">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onSelect(model.id);
                    onToggle();
                  }}
                  className={cn(
                    'w-full flex flex-col gap-1 p-3 rounded-lg text-left transition-all',
                    'hover:bg-white/10',
                    selectedModel === model.id && 'bg-white/10'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">
                      {model.name}
                    </span>
                    <Badge variant="default" size="sm">
                      {model.provider}
                    </Badge>
                  </div>
                  <p className="text-xs text-white/50">{model.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {model.capabilities.slice(0, 3).map((cap) => (
                      <Badge key={cap} variant="info" size="sm">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </button>
              ))}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// Cato Mood Selector
// ============================================================================
interface MoodSelectorProps {
  currentMood: CatoMood;
  onSelect: (mood: CatoMood) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const MoodSelector: React.FC<MoodSelectorProps> = ({
  currentMood,
  onSelect,
  isOpen,
  onToggle,
}) => {
  const moodInfo = CATO_MOODS[currentMood];
  
  const moodColors: Record<CatoMood, string> = {
    balanced: 'text-blue-400',
    scout: 'text-green-400',
    sage: 'text-purple-400',
    spark: 'text-orange-400',
    guide: 'text-cyan-400',
  };

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-sm"
      >
        <Sparkles className={cn('w-4 h-4', moodColors[currentMood])} />
        <span className="text-white/70">{moodInfo.label}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-white/50 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full right-0 mt-2 z-50 w-64"
          >
            <GlassCard className="p-2">
              {(Object.keys(CATO_MOODS) as CatoMood[]).map((mood) => (
                <button
                  key={mood}
                  onClick={() => {
                    onSelect(mood);
                    onToggle();
                  }}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all',
                    'hover:bg-white/10',
                    currentMood === mood && 'bg-white/10'
                  )}
                >
                  <Sparkles className={cn('w-5 h-5 mt-0.5', moodColors[mood])} />
                  <div>
                    <span className="text-sm font-medium text-white">
                      {CATO_MOODS[mood].label}
                    </span>
                    <p className="text-xs text-white/50">
                      {CATO_MOODS[mood].description}
                    </p>
                  </div>
                </button>
              ))}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// Voice Input Modal
// ============================================================================
interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscript: (text: string) => void;
  voiceState: VoiceState;
  setVoiceState: (state: VoiceState) => void;
}

export const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  isOpen,
  onClose,
  onTranscript,
  voiceState,
  setVoiceState,
}) => {
  const [transcript, setTranscript] = useState('');

  const startListening = useCallback(() => {
    setVoiceState('listening');
    setTranscript('');

    // Simulate voice recognition
    setTimeout(() => {
      setVoiceState('processing');
      setTimeout(() => {
        const mockTranscripts = [
          'How do I implement a binary search tree in TypeScript?',
          'Explain the concept of dependency injection',
          'What are the best practices for React state management?',
          'Help me debug this async function',
        ];
        const result = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
        setTranscript(result);
        setVoiceState('idle');
      }, 1500);
    }, 3000);
  }, [setVoiceState]);

  const stopListening = useCallback(() => {
    setVoiceState('idle');
  }, [setVoiceState]);

  const handleSubmit = () => {
    if (transcript) {
      onTranscript(transcript);
      setTranscript('');
      onClose();
    }
  };

  const stateConfig = {
    idle: { icon: Mic, color: 'text-white/50', label: 'Click to start' },
    listening: { icon: MicOff, color: 'text-red-400', label: 'Listening...' },
    processing: { icon: Loader2, color: 'text-blue-400', label: 'Processing...' },
    error: { icon: AlertCircle, color: 'text-red-400', label: 'Error occurred' },
  };

  const config = stateConfig[voiceState];
  const Icon = config.icon;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Voice Input" size="sm">
      <div className="flex flex-col items-center py-6">
        <motion.button
          onClick={voiceState === 'listening' ? stopListening : startListening}
          disabled={voiceState === 'processing'}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'w-24 h-24 rounded-full flex items-center justify-center transition-all',
            voiceState === 'listening'
              ? 'bg-red-500/20 border-2 border-red-500'
              : 'bg-white/10 hover:bg-white/20 border-2 border-white/20'
          )}
        >
          <Icon
            className={cn(
              'w-10 h-10',
              config.color,
              voiceState === 'processing' && 'animate-spin',
              voiceState === 'listening' && 'animate-pulse'
            )}
          />
        </motion.button>

        <p className="mt-4 text-sm text-white/50">{config.label}</p>

        {voiceState === 'listening' && (
          <div className="flex items-center gap-1 mt-4">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  height: [8, 24, 8],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
                className="w-1 bg-red-400 rounded-full"
              />
            ))}
          </div>
        )}

        {transcript && (
          <div className="mt-6 w-full">
            <GlassCard className="p-4">
              <p className="text-sm text-white/70 italic">&ldquo;{transcript}&rdquo;</p>
            </GlassCard>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" onClick={() => setTranscript('')} className="flex-1">
                Clear
              </Button>
              <Button variant="primary" onClick={handleSubmit} className="flex-1">
                Use This
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ============================================================================
// Brain Plan Viewer
// ============================================================================
interface BrainPlanViewerProps {
  plan: BrainPlan;
  isExpanded: boolean;
  onToggle: () => void;
}

export const BrainPlanViewer: React.FC<BrainPlanViewerProps> = ({
  plan,
  isExpanded,
  onToggle,
}) => {
  const modeInfo = ORCHESTRATION_MODES[plan.mode] || {
    label: plan.modeLabel,
    icon: '🧠',
    description: '',
  };

  const stepIcons: Record<string, React.ReactNode> = {
    pending: <div className="w-3 h-3 rounded-full border border-white/30" />,
    running: <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />,
    complete: <Check className="w-3 h-3 text-emerald-400" />,
    error: <AlertCircle className="w-3 h-3 text-red-400" />,
  };

  const completedSteps = plan.steps.filter((s) => s.status === 'complete').length;
  const progress = (completedSteps / plan.steps.length) * 100;

  return (
    <GlassCard className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-xl">
            {modeInfo.icon}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{modeInfo.label}</span>
              <Badge variant="purple" size="sm">
                {plan.model.name}
              </Badge>
            </div>
            <p className="text-xs text-white/50">
              {completedSteps}/{plan.steps.length} steps • ~{(plan.estimatedTime / 1000).toFixed(1)}s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProgressBar value={progress} className="w-24" />
          <ChevronDown
            className={cn(
              'w-5 h-5 text-white/50 transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Domain Detection */}
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-white/50 mb-1">Domain Detected</p>
                <p className="text-sm text-white">
                  {plan.domain.field} → {plan.domain.domain}
                  {plan.domain.subspecialty && ` → ${plan.domain.subspecialty}`}
                </p>
                <Badge variant="success" size="sm" className="mt-2">
                  {(plan.domain.confidence * 100).toFixed(0)}% confidence
                </Badge>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                {plan.steps.map((step) => (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-start gap-3 p-2 rounded-lg transition-all',
                      step.status === 'running' && 'bg-blue-500/10',
                      step.status === 'complete' && 'opacity-70'
                    )}
                  >
                    <div className="mt-1">{stepIcons[step.status]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{step.label}</p>
                      {step.detail && (
                        <p className="text-xs text-white/50 mt-0.5">{step.detail}</p>
                      )}
                    </div>
                    {step.duration && (
                      <span className="text-xs text-white/30">{step.duration}ms</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Estimated Cost */}
              <div className="flex items-center justify-between text-xs text-white/50 pt-2 border-t border-white/10">
                <span>Estimated cost</span>
                <span>${plan.estimatedCost.toFixed(4)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};

// ============================================================================
// Reality Scrubber Timeline (Time Machine)
// ============================================================================
interface RealityScrubberTimelineProps {
  snapshots: TimelineSnapshot[];
  currentPosition: number;
  onPositionChange?: (position: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onBookmark: (snapshotId: string) => void;
  onRestore: (snapshotId: string) => void;
  onBranch: (snapshotId: string) => void;
}

export const RealityScrubberTimeline: React.FC<RealityScrubberTimelineProps> = ({
  snapshots,
  currentPosition,
  isPlaying,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  onBookmark,
  onRestore,
  onBranch,
}) => {
  const [zoom, setZoom] = useState(1);
  const [selectedSnapshot, setSelectedSnapshot] = useState<TimelineSnapshot | null>(null);

  const currentSnapshot = snapshots[currentPosition] || snapshots[0];

  const typeColors = {
    checkpoint: 'bg-blue-500',
    branch: 'bg-purple-500',
    rollback: 'bg-amber-500',
    auto: 'bg-white/30',
  };

  // typeIcons available for future use: { checkpoint: Clock, branch: GitBranch, rollback: RotateCcw, auto: Clock }

  return (
    <div className="flex flex-col h-full">
      {/* Timeline Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div>
          <h3 className="text-lg font-semibold text-white">Time Machine</h3>
          <p className="text-sm text-white/50">
            {snapshots.length} snapshots • Position {currentPosition + 1}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IconBtn
            icon={ZoomOut}
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            title="Zoom out"
          />
          <span className="text-xs text-white/50 w-12 text-center">
            {(zoom * 100).toFixed(0)}%
          </span>
          <IconBtn
            icon={ZoomIn}
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
            title="Zoom in"
          />
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-4 p-4 border-b border-white/10">
        <IconBtn icon={SkipBack} onClick={onSkipBack} title="Previous" />
        <button
          onClick={onPlayPause}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all',
            isPlaying
              ? 'bg-blue-500 text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          )}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>
        <IconBtn icon={SkipForward} onClick={onSkipForward} title="Next" />
      </div>

      {/* Timeline Scrubber */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className="relative min-h-full"
          style={{ transform: `scaleX(${zoom})`, transformOrigin: 'left' }}
        >
          {/* Timeline Track */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-white/10" />

          {/* Snapshots */}
          <div className="space-y-4">
            {snapshots.map((snapshot, index) => {
              const isActive = index === currentPosition;
              const isSelected = selectedSnapshot?.id === snapshot.id;

              return (
                <motion.div
                  key={snapshot.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedSnapshot(isSelected ? null : snapshot)}
                  className={cn(
                    'relative flex items-start gap-4 p-3 rounded-lg cursor-pointer transition-all',
                    isActive && 'bg-blue-500/10 border border-blue-500/30',
                    !isActive && 'hover:bg-white/5',
                    isSelected && !isActive && 'bg-white/10'
                  )}
                >
                  {/* Timeline Node */}
                  <div
                    className={cn(
                      'relative z-10 w-4 h-4 rounded-full flex items-center justify-center',
                      typeColors[snapshot.type],
                      isActive && 'ring-2 ring-blue-400 ring-offset-2 ring-offset-[#0a0a0f]'
                    )}
                  >
                    {snapshot.isBookmarked && (
                      <BookmarkCheck className="w-2.5 h-2.5 text-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {snapshot.label}
                      </span>
                      <Badge
                        variant={
                          snapshot.type === 'checkpoint'
                            ? 'info'
                            : snapshot.type === 'branch'
                            ? 'purple'
                            : snapshot.type === 'rollback'
                            ? 'warning'
                            : 'default'
                        }
                        size="sm"
                      >
                        {snapshot.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-white/50 mt-1 truncate">
                      {snapshot.preview}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-white/30">
                      <span>{snapshot.messageCount} messages</span>
                      <span>
                        {snapshot.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Actions */}
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex gap-2 mt-3 pt-3 border-t border-white/10"
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={RotateCcw}
                          onClick={(e) => {
                            e?.stopPropagation();
                            onRestore(snapshot.id);
                          }}
                        >
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={GitBranch}
                          onClick={(e) => {
                            e?.stopPropagation();
                            onBranch(snapshot.id);
                          }}
                        >
                          Branch
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={snapshot.isBookmarked ? BookmarkCheck : Bookmark}
                          onClick={(e) => {
                            e?.stopPropagation();
                            onBookmark(snapshot.id);
                          }}
                        >
                          {snapshot.isBookmarked ? 'Saved' : 'Save'}
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current Snapshot Preview */}
      {currentSnapshot && (
        <div className="p-4 border-t border-white/10 bg-white/5">
          <p className="text-xs text-white/50 mb-1">Current Position</p>
          <p className="text-sm text-white font-medium">{currentSnapshot.label}</p>
          <p className="text-xs text-white/50 mt-1">{currentSnapshot.preview}</p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Workflow Editor
// ============================================================================
interface WorkflowEditorProps {
  steps: WorkflowStep[];
  onAddStep: (type: WorkflowStep['type']) => void;
  onRemoveStep: (stepId: string) => void;
  onUpdateStep?: (stepId: string, updates: Partial<WorkflowStep>) => void;
  onConnect?: (fromId: string, toId: string) => void;
}

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  steps,
  onAddStep,
  onRemoveStep,
}) => {
  const [zoom, setZoom] = useState(1);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  const typeColors = {
    generator: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
    critic: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
    verifier: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
    synthesizer: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
  };

  const typeIcons = {
    generator: Sparkles,
    critic: AlertCircle,
    verifier: Check,
    synthesizer: Brain,
  };

  // Calculate SVG path for connections
  const getConnectionPath = (from: WorkflowStep, to: WorkflowStep) => {
    const fromX = from.position.x + 120; // Right edge of node
    const fromY = from.position.y + 30; // Center height
    const toX = to.position.x; // Left edge of node
    const toY = to.position.y + 30;

    const midX = (fromX + toX) / 2;

    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Workflow Editor</span>
          <Badge variant="info" size="sm">
            {steps.length} steps
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <IconBtn
            icon={ZoomOut}
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            title="Zoom out"
          />
          <span className="text-xs text-white/50 w-12 text-center">
            {(zoom * 100).toFixed(0)}%
          </span>
          <IconBtn
            icon={ZoomIn}
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            title="Zoom in"
          />
          <div className="w-px h-6 bg-white/10 mx-2" />
          <IconBtn icon={RotateCcw} onClick={() => setZoom(1)} title="Reset zoom" />
        </div>
      </div>

      {/* Add Step Buttons */}
      <div className="flex items-center gap-2 p-4 border-b border-white/10">
        <span className="text-xs text-white/50 mr-2">Add:</span>
        {(['generator', 'critic', 'verifier', 'synthesizer'] as const).map((type) => {
          const Icon = typeIcons[type];
          return (
            <Button
              key={type}
              size="sm"
              variant="secondary"
              icon={Icon}
              onClick={() => onAddStep(type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          );
        })}
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-[#050508] relative">
        <div
          className="absolute inset-0 min-w-[1200px] min-h-[600px]"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        >
          {/* Grid Background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {steps.map((step) =>
              step.connections.map((targetId) => {
                const target = steps.find((s) => s.id === targetId);
                if (!target) return null;
                return (
                  <path
                    key={`${step.id}-${targetId}`}
                    d={getConnectionPath(step, target)}
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="2"
                    strokeDasharray="4"
                  />
                );
              })
            )}
          </svg>

          {/* Nodes */}
          {steps.map((step) => {
            const Icon = typeIcons[step.type];
            const isSelected = selectedStep === step.id;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  position: 'absolute',
                  left: step.position.x,
                  top: step.position.y,
                }}
                onClick={() => setSelectedStep(isSelected ? null : step.id)}
                className={cn(
                  'w-[240px] rounded-xl border-2 backdrop-blur-xl cursor-pointer transition-all',
                  typeColors[step.type],
                  isSelected && 'ring-2 ring-white/30'
                )}
              >
                <div className="flex items-center gap-3 p-3 border-b border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {step.label}
                    </p>
                    <p className="text-xs text-white/50">{step.type}</p>
                  </div>
                  <IconBtn
                    icon={Move}
                    size="sm"
                    className="cursor-move"
                    title="Drag to move"
                  />
                </div>

                <div className="p-3">
                  {step.model && (
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-3 h-3 text-white/50" />
                      <span className="text-xs text-white/70">{step.model}</span>
                    </div>
                  )}

                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-2 mt-2 pt-2 border-t border-white/10"
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Settings2}
                        onClick={(e) => {
                          e?.stopPropagation();
                          // Open config modal
                        }}
                      >
                        Config
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        onClick={(e) => {
                          e?.stopPropagation();
                          onRemoveStep(step.id);
                        }}
                      >
                        Remove
                      </Button>
                    </motion.div>
                  )}
                </div>

                {/* Connection Points */}
                <div
                  className="absolute left-0 top-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white/30 border-2 border-current"
                  title="Input"
                />
                <div
                  className="absolute right-0 top-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-white/30 border-2 border-current cursor-crosshair"
                  title="Output"
                />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between p-4 border-t border-white/10 bg-white/5">
        <p className="text-xs text-white/50">
          Click nodes to select • Drag to reposition • Connect outputs to inputs
        </p>
        <div className="flex items-center gap-4 text-xs text-white/50">
          {(['generator', 'critic', 'verifier', 'synthesizer'] as const).map((type) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 rounded-full', typeColors[type].split(' ')[0])} />
              <span className="capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Cost Estimation Display
// ============================================================================
export type ExecutionMode = 'sniper' | 'war_room';
export type MorphedViewType = 'chat' | 'terminal' | 'canvas' | 'dashboard' | 'diff_editor' | 'decision_cards' | 'datagrid' | 'chart' | 'kanban' | 'calculator' | 'code_editor' | 'document';

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  modelId: string;
  modelName: string;
  estimatedCostCents: number;
  estimatedLatencyMs: number;
  orchestrationMode: string;
  modelsInvolved: number;
  breakdown: {
    label: string;
    tokens: number;
    cost: number;
  }[];
}

interface CostEstimationPanelProps {
  prompt: string;
  selectedModel: string;
  executionMode: ExecutionMode;
  isVisible: boolean;
  onClose: () => void;
}

const MODEL_PRICING: Record<string, { inputPer1k: number; outputPer1k: number; name: string; avgLatency: number }> = {
  'auto': { inputPer1k: 0.003, outputPer1k: 0.015, name: 'Auto (Claude 3.5)', avgLatency: 1200 },
  'claude-3-5-sonnet': { inputPer1k: 0.003, outputPer1k: 0.015, name: 'Claude 3.5 Sonnet', avgLatency: 1200 },
  'claude-3-haiku': { inputPer1k: 0.00025, outputPer1k: 0.00125, name: 'Claude 3 Haiku', avgLatency: 400 },
  'gpt-4o': { inputPer1k: 0.005, outputPer1k: 0.015, name: 'GPT-4o', avgLatency: 1000 },
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006, name: 'GPT-4o Mini', avgLatency: 500 },
  'gemini-1.5-pro': { inputPer1k: 0.00125, outputPer1k: 0.005, name: 'Gemini 1.5 Pro', avgLatency: 1500 },
  'gemini-1.5-flash': { inputPer1k: 0.000075, outputPer1k: 0.0003, name: 'Gemini 1.5 Flash', avgLatency: 400 },
  'o1': { inputPer1k: 0.015, outputPer1k: 0.060, name: 'OpenAI o1', avgLatency: 5000 },
  'o1-mini': { inputPer1k: 0.003, outputPer1k: 0.012, name: 'OpenAI o1-mini', avgLatency: 3000 },
  'llama-3.1-70b': { inputPer1k: 0.00099, outputPer1k: 0.00099, name: 'Llama 3.1 70B', avgLatency: 800 },
};

function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

function calculateCostEstimate(
  prompt: string, 
  modelId: string, 
  mode: ExecutionMode
): CostEstimate {
  const pricing = MODEL_PRICING[modelId] || MODEL_PRICING['auto'];
  const inputTokens = estimateTokens(prompt);
  
  // Estimate output tokens based on complexity
  const isComplex = prompt.length > 200 || prompt.includes('explain') || prompt.includes('analyze');
  const baseOutputTokens = isComplex ? 1000 : 500;
  
  // War Room uses more tokens (multi-model consensus)
  const modeMultiplier = mode === 'war_room' ? 3 : 1;
  const outputTokens = baseOutputTokens * modeMultiplier;
  const modelsInvolved = mode === 'war_room' ? 3 : 1;
  
  const inputCost = (inputTokens / 1000) * pricing.inputPer1k * modelsInvolved;
  const outputCost = (outputTokens / 1000) * pricing.outputPer1k;
  const totalCost = (inputCost + outputCost) * 100; // Convert to cents
  
  const latencyMultiplier = mode === 'war_room' ? 2.5 : 1;
  const estimatedLatency = pricing.avgLatency * latencyMultiplier;

  return {
    inputTokens: inputTokens * modelsInvolved,
    outputTokens,
    inputCostPer1k: pricing.inputPer1k,
    outputCostPer1k: pricing.outputPer1k,
    modelId,
    modelName: pricing.name,
    estimatedCostCents: totalCost,
    estimatedLatencyMs: estimatedLatency,
    orchestrationMode: mode === 'war_room' ? 'Multi-Model Consensus' : 'Single Model',
    modelsInvolved,
    breakdown: [
      { label: 'Input Processing', tokens: inputTokens * modelsInvolved, cost: inputCost * 100 },
      { label: 'Response Generation', tokens: outputTokens, cost: outputCost * 100 },
      ...(mode === 'war_room' ? [
        { label: 'Consensus Synthesis', tokens: Math.ceil(outputTokens * 0.3), cost: outputCost * 100 * 0.3 },
      ] : []),
    ],
  };
}

export const CostEstimationPanel: React.FC<CostEstimationPanelProps> = ({
  prompt,
  selectedModel,
  executionMode,
  isVisible,
  onClose,
}) => {
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  
  useEffect(() => {
    if (prompt && isVisible) {
      const newEstimate = calculateCostEstimate(prompt, selectedModel, executionMode);
      setEstimate(newEstimate);
    }
  }, [prompt, selectedModel, executionMode, isVisible]);

  if (!isVisible || !estimate) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full left-0 right-0 mb-2 z-50"
    >
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            <h4 className="text-sm font-medium text-white">Cost Estimate</h4>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Main Cost Display */}
        <div className="flex items-center justify-between mb-4 p-3 bg-white/5 rounded-lg">
          <div>
            <p className="text-2xl font-bold text-white">
              ${(estimate.estimatedCostCents / 100).toFixed(4)}
            </p>
            <p className="text-xs text-white/50">Estimated cost</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-white/70">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{(estimate.estimatedLatencyMs / 1000).toFixed(1)}s</span>
            </div>
            <p className="text-xs text-white/50">Est. latency</p>
          </div>
        </div>
        
        {/* Model & Mode Info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-2 bg-white/5 rounded-lg">
            <p className="text-xs text-white/50 mb-1">Model</p>
            <p className="text-sm text-white font-medium">{estimate.modelName}</p>
          </div>
          <div className="p-2 bg-white/5 rounded-lg">
            <p className="text-xs text-white/50 mb-1">Mode</p>
            <div className="flex items-center gap-1">
              {executionMode === 'war_room' ? (
                <Users className="w-3 h-3 text-violet-400" />
              ) : (
                <Zap className="w-3 h-3 text-green-400" />
              )}
              <p className="text-sm text-white font-medium">{estimate.orchestrationMode}</p>
            </div>
          </div>
        </div>
        
        {/* Token Breakdown */}
        <div className="space-y-2">
          <p className="text-xs text-white/50 uppercase tracking-wide">Breakdown</p>
          {estimate.breakdown.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-white/70">{item.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-white/50">{item.tokens.toLocaleString()} tokens</span>
                <span className="text-white font-medium">${(item.cost / 100).toFixed(4)}</span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Models Involved */}
        {estimate.modelsInvolved > 1 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Activity className="w-3 h-3" />
              <span>{estimate.modelsInvolved} models will be consulted</span>
            </div>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
};

// ============================================================================
// Polymorphic UI / Agentic Morphing Panel
// ============================================================================
const VIEW_CONFIGS: Record<MorphedViewType, { 
  icon: React.ElementType; 
  label: string; 
  description: string;
  color: string;
}> = {
  chat: { icon: MessageSquare, label: 'Conversation', description: 'Multi-turn dialogue', color: 'text-slate-400' },
  terminal: { icon: Terminal, label: 'Command Center', description: 'Fast execution mode', color: 'text-green-400' },
  canvas: { icon: Map, label: 'Infinite Canvas', description: 'Visual exploration', color: 'text-blue-400' },
  dashboard: { icon: LayoutDashboard, label: 'Dashboard', description: 'Analytics view', color: 'text-cyan-400' },
  diff_editor: { icon: FileCode, label: 'Verification', description: 'Split-screen validation', color: 'text-orange-400' },
  decision_cards: { icon: HelpCircle, label: 'Mission Control', description: 'Human-in-the-loop', color: 'text-yellow-400' },
  datagrid: { icon: Table, label: 'Data Grid', description: 'Interactive spreadsheet', color: 'text-emerald-400' },
  chart: { icon: BarChart3, label: 'Chart', description: 'Data visualization', color: 'text-indigo-400' },
  kanban: { icon: Kanban, label: 'Kanban Board', description: 'Task management', color: 'text-purple-400' },
  calculator: { icon: Calculator, label: 'Calculator', description: 'Interactive calculations', color: 'text-amber-400' },
  code_editor: { icon: Code, label: 'Code Editor', description: 'Edit and run code', color: 'text-pink-400' },
  document: { icon: FileText, label: 'Document', description: 'Rich text document', color: 'text-teal-400' },
};

interface PolymorphicMorphingPanelProps {
  currentView: MorphedViewType;
  executionMode: ExecutionMode;
  onViewChange: (view: MorphedViewType) => void;
  onModeChange: (mode: ExecutionMode) => void;
  onEscalate: () => void;
  isTransitioning: boolean;
  domainHint?: string;
  estimatedCostCents?: number;
}

export const PolymorphicMorphingPanel: React.FC<PolymorphicMorphingPanelProps> = ({
  currentView,
  executionMode,
  onViewChange,
  onModeChange,
  onEscalate,
  isTransitioning,
  domainHint,
  estimatedCostCents,
}) => {
  const [showViewPicker, setShowViewPicker] = useState(false);
  const config = VIEW_CONFIGS[currentView];
  const Icon = config.icon;

  return (
    <div className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Execution Mode Badge */}
          <motion.div
            layout
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
              executionMode === 'sniper' 
                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
            )}
          >
            {executionMode === 'sniper' ? (
              <><Zap className="w-3 h-3" /> Sniper</>
            ) : (
              <><Users className="w-3 h-3" /> War Room</>
            )}
          </motion.div>
          
          {/* View Type Badge - Clickable */}
          <div className="relative">
            <button
              onClick={() => setShowViewPicker(!showViewPicker)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                "border border-white/10 hover:bg-white/5 transition-all",
                config.color
              )}
            >
              <Icon className="w-3 h-3" />
              {config.label}
              <ChevronDown className={cn("w-3 h-3 transition-transform", showViewPicker && "rotate-180")} />
            </button>
            
            {/* View Picker Dropdown */}
            <AnimatePresence>
              {showViewPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 mt-2 z-50 w-64"
                >
                  <GlassCard className="p-2 max-h-80 overflow-y-auto">
                    {(Object.keys(VIEW_CONFIGS) as MorphedViewType[]).map((viewType) => {
                      const viewConfig = VIEW_CONFIGS[viewType];
                      const ViewIcon = viewConfig.icon;
                      return (
                        <button
                          key={viewType}
                          onClick={() => {
                            onViewChange(viewType);
                            setShowViewPicker(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all",
                            "hover:bg-white/10",
                            currentView === viewType && "bg-white/10"
                          )}
                        >
                          <ViewIcon className={cn("w-4 h-4", viewConfig.color)} />
                          <div>
                            <p className="text-sm font-medium text-white">{viewConfig.label}</p>
                            <p className="text-xs text-white/50">{viewConfig.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Cost Badge */}
          {estimatedCostCents !== undefined && (
            <Badge variant="default" size="sm" className="gap-1 text-[10px] text-slate-500">
              <DollarSign className="w-2.5 h-2.5" />
              {(estimatedCostCents / 100).toFixed(3)}
            </Badge>
          )}
          
          {/* Domain Hint */}
          {domainHint && domainHint !== 'general' && (
            <Badge 
              variant="default"
              size="sm"
              className={cn(
                "text-[10px]",
                domainHint === 'medical' && 'border-red-500/30 text-red-400',
                domainHint === 'financial' && 'border-yellow-500/30 text-yellow-400',
                domainHint === 'legal' && 'border-blue-500/30 text-blue-400',
                domainHint === 'technical' && 'border-cyan-500/30 text-cyan-400',
                domainHint === 'creative' && 'border-pink-500/30 text-pink-400',
              )}
            >
              {domainHint}
            </Badge>
          )}
          
          {/* Transitioning Indicator */}
          {isTransitioning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1 text-xs text-white/50"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              Morphing...
            </motion.div>
          )}
        </div>
        
        {/* Gearbox Controls */}
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex items-center rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
            <button
              onClick={() => onModeChange('sniper')}
              className={cn(
                "h-6 px-2 flex items-center gap-1 text-[10px] rounded-md transition-all",
                executionMode === 'sniper' && 'bg-green-500/20 text-green-400'
              )}
            >
              <Zap className="w-3 h-3" /> Fast
            </button>
            <button
              onClick={() => onModeChange('war_room')}
              className={cn(
                "h-6 px-2 flex items-center gap-1 text-[10px] rounded-md transition-all",
                executionMode === 'war_room' && 'bg-violet-500/20 text-violet-400'
              )}
            >
              <Users className="w-3 h-3" /> Deep
            </button>
          </div>
          
          {/* Escalate Button */}
          {executionMode === 'sniper' && (
            <button
              onClick={onEscalate}
              className="h-6 px-2 flex items-center gap-1 text-[10px] text-violet-400 hover:bg-violet-500/10 rounded-md transition-all"
            >
              <ArrowUp className="w-3 h-3" /> Escalate
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Morphing Transition Effect
// ============================================================================
interface MorphTransitionEffectProps {
  isActive: boolean;
  targetView: MorphedViewType;
  onComplete: () => void;
}

export const MorphTransitionEffect: React.FC<MorphTransitionEffectProps> = ({
  isActive,
  targetView,
  onComplete,
}) => {
  const config = VIEW_CONFIGS[targetView];
  const Icon = config.icon;

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className={cn('p-4 rounded-full bg-white/[0.1] mx-auto mb-4', config.color)}
        >
          <Icon className="h-8 w-8" />
        </motion.div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Morphing to {config.label}
        </h3>
        <p className="text-sm text-slate-400">
          Chat becomes app. App becomes whatever you need.
        </p>
      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// Agentic Morphing Demo Panel
// ============================================================================
interface AgenticMorphingDemoProps {
  onMorphComplete?: (viewType: MorphedViewType) => void;
}

export const AgenticMorphingDemo: React.FC<AgenticMorphingDemoProps> = ({
  onMorphComplete,
}) => {
  const [currentView, setCurrentView] = useState<MorphedViewType>('chat');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('sniper');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showMorphEffect, setShowMorphEffect] = useState(false);
  const [targetView, setTargetView] = useState<MorphedViewType>('chat');
  const [domainHint, setDomainHint] = useState<string>('general');
  const [costCents, setCostCents] = useState(1);
  
  // Simulate prompt analysis and auto-morphing
  const [demoPrompt, setDemoPrompt] = useState('');
  
  const analyzeAndMorph = useCallback((prompt: string) => {
    // Simulate AI analyzing the prompt and determining the best view
    let newView: MorphedViewType = 'chat';
    let newDomain = 'general';
    let newCost = executionMode === 'sniper' ? 1 : 50;
    
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('spreadsheet') || lowerPrompt.includes('table') || lowerPrompt.includes('data')) {
      newView = 'datagrid';
      newDomain = 'technical';
      newCost = executionMode === 'sniper' ? 3 : 75;
    } else if (lowerPrompt.includes('chart') || lowerPrompt.includes('graph') || lowerPrompt.includes('visualiz')) {
      newView = 'chart';
      newDomain = 'technical';
      newCost = executionMode === 'sniper' ? 5 : 100;
    } else if (lowerPrompt.includes('code') || lowerPrompt.includes('function') || lowerPrompt.includes('implement')) {
      newView = 'code_editor';
      newDomain = 'technical';
      newCost = executionMode === 'sniper' ? 8 : 150;
    } else if (lowerPrompt.includes('kanban') || lowerPrompt.includes('task') || lowerPrompt.includes('project')) {
      newView = 'kanban';
      newDomain = 'general';
      newCost = executionMode === 'sniper' ? 2 : 60;
    } else if (lowerPrompt.includes('calculate') || lowerPrompt.includes('math') || lowerPrompt.includes('formula')) {
      newView = 'calculator';
      newDomain = 'technical';
      newCost = executionMode === 'sniper' ? 2 : 40;
    } else if (lowerPrompt.includes('document') || lowerPrompt.includes('write') || lowerPrompt.includes('essay')) {
      newView = 'document';
      newDomain = 'creative';
      newCost = executionMode === 'sniper' ? 4 : 80;
    } else if (lowerPrompt.includes('medical') || lowerPrompt.includes('health') || lowerPrompt.includes('symptom')) {
      newView = 'decision_cards';
      newDomain = 'medical';
      newCost = executionMode === 'sniper' ? 10 : 200;
    } else if (lowerPrompt.includes('financial') || lowerPrompt.includes('invest') || lowerPrompt.includes('stock')) {
      newView = 'dashboard';
      newDomain = 'financial';
      newCost = executionMode === 'sniper' ? 8 : 180;
    } else if (lowerPrompt.includes('legal') || lowerPrompt.includes('contract') || lowerPrompt.includes('law')) {
      newView = 'diff_editor';
      newDomain = 'legal';
      newCost = executionMode === 'sniper' ? 12 : 250;
    } else if (lowerPrompt.includes('explore') || lowerPrompt.includes('brainstorm') || lowerPrompt.includes('mindmap')) {
      newView = 'canvas';
      newDomain = 'creative';
      newCost = executionMode === 'sniper' ? 3 : 70;
    } else if (lowerPrompt.includes('terminal') || lowerPrompt.includes('command') || lowerPrompt.includes('shell')) {
      newView = 'terminal';
      newDomain = 'technical';
      newCost = executionMode === 'sniper' ? 2 : 50;
    }
    
    if (newView !== currentView) {
      setTargetView(newView);
      setShowMorphEffect(true);
      setIsTransitioning(true);
    }
    
    setDomainHint(newDomain);
    setCostCents(newCost);
  }, [currentView, executionMode]);
  
  const handleMorphComplete = useCallback(() => {
    setCurrentView(targetView);
    setShowMorphEffect(false);
    setIsTransitioning(false);
    onMorphComplete?.(targetView);
  }, [targetView, onMorphComplete]);
  
  const handleEscalate = useCallback(() => {
    setExecutionMode('war_room');
    setCostCents(prev => prev * 10);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] rounded-xl border border-white/10 overflow-hidden">
      {/* Polymorphic Header */}
      <PolymorphicMorphingPanel
        currentView={currentView}
        executionMode={executionMode}
        onViewChange={(view) => {
          setTargetView(view);
          setShowMorphEffect(true);
          setIsTransitioning(true);
        }}
        onModeChange={setExecutionMode}
        onEscalate={handleEscalate}
        isTransitioning={isTransitioning}
        domainHint={domainHint}
        estimatedCostCents={costCents}
      />
      
      {/* Demo Content Area */}
      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold text-white mb-2">Agentic Morphing Demo</h3>
            <p className="text-sm text-white/50">
              Type a prompt below to see the UI automatically morph based on your intent
            </p>
          </div>
          
          {/* Demo Prompt Input */}
          <GlassCard className="p-4">
            <input
              type="text"
              value={demoPrompt}
              onChange={(e) => setDemoPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && demoPrompt.trim()) {
                  analyzeAndMorph(demoPrompt);
                }
              }}
              placeholder="Try: 'Create a spreadsheet', 'Show me a chart', 'Write some code'..."
              className="w-full bg-transparent border-none outline-none text-white placeholder-white/30 text-sm"
            />
          </GlassCard>
          
          <button
            onClick={() => analyzeAndMorph(demoPrompt)}
            disabled={!demoPrompt.trim()}
            className={cn(
              "w-full py-3 rounded-lg font-medium transition-all",
              demoPrompt.trim()
                ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:opacity-90"
                : "bg-white/5 text-white/30 cursor-not-allowed"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Rocket className="w-4 h-4" />
              Analyze & Morph
            </div>
          </button>
          
          {/* Example Prompts */}
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wide">Quick Examples</p>
            <div className="flex flex-wrap gap-2">
              {[
                'Create a spreadsheet for expenses',
                'Show a chart of sales data',
                'Write a Python function',
                'Help me brainstorm ideas',
                'Calculate compound interest',
                'Draft a legal contract',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    setDemoPrompt(example);
                    analyzeAndMorph(example);
                  }}
                  className="px-3 py-1.5 text-xs text-white/60 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
          
          {/* Current View Display */}
          <GlassCard className="p-6 text-center">
            {(() => {
              const config = VIEW_CONFIGS[currentView];
              const CurrentIcon = config.icon;
              return (
                <>
                  <CurrentIcon className={cn("w-12 h-12 mx-auto mb-3", config.color)} />
                  <h4 className="text-lg font-medium text-white">{config.label}</h4>
                  <p className="text-sm text-white/50">{config.description}</p>
                  <div className="flex justify-center gap-2 mt-4">
                    <Badge variant="default" size="sm">Interactive</Badge>
                    <Badge variant="default" size="sm">AI-Assisted</Badge>
                    <Badge variant="default" size="sm">Exportable</Badge>
                  </div>
                </>
              );
            })()}
          </GlassCard>
          
          {/* Multi-Model Method Node Visualization (War Room) */}
          {executionMode === 'war_room' && (
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-violet-400" />
                <h5 className="text-sm font-medium text-white">Method Node: Multi-Model Consensus</h5>
              </div>
              <p className="text-xs text-white/50 mb-4">
                Multiple AI models collaborate on each method node for higher accuracy
              </p>
              
              {/* Models in this method node */}
              <div className="space-y-2">
                {[
                  { name: 'Claude 3.5 Sonnet', role: 'Primary Generator', status: 'active', color: 'text-orange-400' },
                  { name: 'GPT-4o', role: 'Critic & Validator', status: 'active', color: 'text-green-400' },
                  { name: 'Gemini 1.5 Pro', role: 'Synthesizer', status: 'standby', color: 'text-blue-400' },
                ].map((model, i) => (
                  <div 
                    key={i}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg",
                      model.status === 'active' ? 'bg-white/10' : 'bg-white/5'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        model.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-white/30'
                      )} />
                      <span className={cn("text-sm font-medium", model.color)}>{model.name}</span>
                    </div>
                    <Badge variant="default" size="sm">{model.role}</Badge>
                  </div>
                ))}
              </div>
              
              {/* Method Flow */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>Flow: Generate → Critique → Synthesize</span>
                  <span className="text-violet-400">3 models active</span>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>
      
      {/* Morph Transition Effect */}
      <AnimatePresence>
        {showMorphEffect && (
          <MorphTransitionEffect
            isActive={showMorphEffect}
            targetView={targetView}
            onComplete={handleMorphComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
