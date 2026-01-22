'use client';

/**
 * Think Tank Consumer App Simulator v3.0
 * Full-featured simulator for Cato AI Assistant
 * 
 * Features:
 * - Chat with simulated AI responses
 * - Voice input simulation
 * - Advanced mode with model selection
 * - Brain Plan visualization
 * - Time Machine (Reality Scrubber)
 * - Workflow Editor
 * - Rules management
 * - Artifacts gallery
 * - Settings & Profile
 * - Cato mood/persona selection
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Mic,
  History,
  Settings,
  User,
  FileText,
  Workflow,
  Clock,
  PanelLeft,
  Sparkles,
  Code,
  FileCode,
  Table,
  BarChart3,
  Plus,
  Search,
  MoreHorizontal,
  Shield,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Save,
  Download,
  Trash2,
  Edit3,
  ChevronRight,
  Globe,
  Bell,
  Lock,
  Palette,
  Image,
  Layers,
  DollarSign,
} from 'lucide-react';

import type { ViewType, VoiceState, Message, WorkflowStep, CatoMood } from './types';
import {
  GlassCard,
  Badge,
  IconBtn,
  Toggle,
  Button,
  cn,

  Tabs,
} from './ui-components';
import {
  AdvancedModeToggle,
  ModelSelector,
  MoodSelector,
  VoiceInputModal,
  BrainPlanViewer,
  RealityScrubberTimeline,
  WorkflowEditor,
  AgenticMorphingDemo,
} from './feature-components';
import {
  MOCK_MODELS,
  MOCK_BRAIN_PLAN,
  MOCK_SNAPSHOTS,
  MOCK_WORKFLOW_STEPS,

  MOCK_ARTIFACTS,
  MOCK_RULES,
  MOCK_USER_PROFILE,
  MOCK_HISTORY_SESSIONS,
  INITIAL_MESSAGES,
  CATO_MOODS,
} from './mock-data';

// Navigation items configuration
const NAV_ITEMS: { id: ViewType; icon: React.ComponentType<{ className?: string }>; label: string; badge?: number }[] = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'morphing', icon: Layers, label: 'Morphing UI' },
  { id: 'history', icon: History, label: 'History', badge: MOCK_HISTORY_SESSIONS.length },
  { id: 'artifacts', icon: FileCode, label: 'Artifacts', badge: MOCK_ARTIFACTS.length },
  { id: 'rules', icon: Shield, label: 'Rules', badge: MOCK_RULES.filter(r => r.isEnabled).length },
  { id: 'workflows', icon: Workflow, label: 'Workflows' },
  { id: 'timemachine', icon: Clock, label: 'Time Machine' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'profile', icon: User, label: 'Profile' },
];

export default function SimulatorPage() {
  // View state
  const [currentView, setCurrentView] = useState<ViewType>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Chat state
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Advanced mode state
  const [advancedMode, setAdvancedMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [currentMood, setCurrentMood] = useState<CatoMood>('balanced');
  const [moodSelectorOpen, setMoodSelectorOpen] = useState(false);

  // Voice state
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');

  // Brain plan state
  const [isPlanExpanded, setIsPlanExpanded] = useState(false);
  const [showBrainPlan, setShowBrainPlan] = useState(true);

  // Settings state
  const [darkMode, setDarkMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  // Time Machine state
  const [timelinePosition, setTimelinePosition] = useState(MOCK_SNAPSHOTS.length - 1);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [snapshots, setSnapshots] = useState(MOCK_SNAPSHOTS);

  // Workflow state
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(MOCK_WORKFLOW_STEPS);

  // Rules state
  const [rules, setRules] = useState(MOCK_RULES);

  // Handle sending a message
  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
      mood: currentMood,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const model = MOCK_MODELS.find((m) => m.id === selectedModel) || MOCK_MODELS[0];
      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: generateMockResponse(inputValue, currentMood),
        timestamp: new Date(),
        model: model.name,
        brainPlan: advancedMode ? MOCK_BRAIN_PLAN : undefined,
        mood: currentMood,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1500);
  }, [inputValue, advancedMode, selectedModel, currentMood]);

  // Generate mock response based on mood
  const generateMockResponse = (prompt: string, mood: CatoMood): string => {
    const responses: Record<CatoMood, string[]> = {
      balanced: [
        "I'd be happy to help you with that. Let me break this down step by step...",
        "Great question! Here's what I think about this...",
        "I understand what you're looking for. Here's my analysis...",
      ],
      scout: [
        "Interesting! Let me explore this from multiple angles...",
        "There are several perspectives we could consider here...",
        "I'm curious about this too! Let's dig deeper...",
      ],
      sage: [
        "This is a profound question that requires careful consideration...",
        "Let me provide a thorough analysis based on first principles...",
        "The underlying concepts here are quite fascinating...",
      ],
      spark: [
        "Ooh, I love this kind of creative challenge! What if we tried...",
        "Let's think outside the box here! Imagine...",
        "Here's a wild idea that might just work...",
      ],
      guide: [
        "I'll walk you through this step by step, no rush...",
        "Let's start with the basics and build up from there...",
        "Think of it this way - imagine you're...",
      ],
    };

    const moodResponses = responses[mood];
    return moodResponses[Math.floor(Math.random() * moodResponses.length)] + 
      `\n\nBased on your question about "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}", here's what I recommend...`;
  };

  // Workflow handlers
  const handleAddWorkflowStep = (type: WorkflowStep['type']) => {
    const newStep: WorkflowStep = {
      id: `wf-${Date.now()}`,
      type,
      label: `New ${type}`,
      position: { x: 100 + workflowSteps.length * 50, y: 100 + workflowSteps.length * 30 },
      connections: [],
      config: {},
    };
    setWorkflowSteps((prev) => [...prev, newStep]);
  };

  const handleRemoveWorkflowStep = (stepId: string) => {
    setWorkflowSteps((prev) => prev.filter((s) => s.id !== stepId));
  };

  // Timeline handlers
  const handleBookmark = (snapshotId: string) => {
    setSnapshots((prev) =>
      prev.map((s) =>
        s.id === snapshotId ? { ...s, isBookmarked: !s.isBookmarked } : s
      )
    );
  };

  const handleRestore = (snapshotId: string) => {
    const index = snapshots.findIndex((s) => s.id === snapshotId);
    if (index !== -1) {
      setTimelinePosition(index);
    }
  };

  const handleBranch = (snapshotId: string) => {
    const index = snapshots.findIndex((s) => s.id === snapshotId);
    if (index !== -1) {
      const newSnapshot = {
        ...snapshots[index],
        id: `snap-${Date.now()}`,
        type: 'branch' as const,
        label: `Branch from ${snapshots[index].label}`,
        timestamp: new Date(),
      };
      setSnapshots((prev) => [...prev.slice(0, index + 1), newSnapshot]);
    }
  };

  // Toggle rule enabled state
  const toggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId ? { ...r, isEnabled: !r.isEnabled } : r
      )
    );
  };

  // Render the current view content
  const renderContent = () => {
    switch (currentView) {
      case 'chat':
        return renderChatView();
      case 'morphing':
        return renderMorphingView();
      case 'history':
        return renderHistoryView();
      case 'artifacts':
        return renderArtifactsView();
      case 'rules':
        return renderRulesView();
      case 'workflows':
        return renderWorkflowsView();
      case 'timemachine':
        return renderTimeMachineView();
      case 'settings':
        return renderSettingsView();
      case 'profile':
        return renderProfileView();
      default:
        return null;
    }
  };

  // ============================================================================
  // Chat View
  // ============================================================================
  const renderChatView = () => (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[70%] rounded-2xl p-4',
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-white'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              {message.model && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                  <Badge variant="default" size="sm">
                    {message.model}
                  </Badge>
                  {message.mood && (
                    <Badge variant={
                      message.mood === 'balanced' ? 'info' :
                      message.mood === 'scout' ? 'success' :
                      message.mood === 'sage' ? 'purple' :
                      message.mood === 'spark' ? 'orange' : 'cyan'
                    } size="sm">
                      {CATO_MOODS[message.mood].label}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white/70" />
              </div>
            )}
          </motion.div>
        ))}

        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white/10 rounded-2xl p-4">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    className="w-2 h-2 bg-white/50 rounded-full"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Brain Plan (when in advanced mode and plan exists) */}
      {advancedMode && showBrainPlan && messages.some((m) => m.brainPlan) && (
        <div className="px-4 pb-2">
          <BrainPlanViewer
            plan={MOCK_BRAIN_PLAN}
            isExpanded={isPlanExpanded}
            onToggle={() => setIsPlanExpanded(!isPlanExpanded)}
          />
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-white/10">
        {/* Advanced Controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AdvancedModeToggle
              enabled={advancedMode}
              onChange={setAdvancedMode}
            />
            {advancedMode && (
              <>
                <ModelSelector
                  models={MOCK_MODELS}
                  selectedModel={selectedModel}
                  onSelect={setSelectedModel}
                  isOpen={modelSelectorOpen}
                  onToggle={() => setModelSelectorOpen(!modelSelectorOpen)}
                />
                <Toggle
                  checked={showBrainPlan}
                  onChange={setShowBrainPlan}
                  label="Show Plan"
                />
              </>
            )}
          </div>
          <MoodSelector
            currentMood={currentMood}
            onSelect={setCurrentMood}
            isOpen={moodSelectorOpen}
            onToggle={() => setMoodSelectorOpen(!moodSelectorOpen)}
          />
        </div>

        {/* Input Field */}
        <div className="flex items-center gap-2">
          <GlassCard className="flex-1 flex items-center gap-2 px-4 py-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask Cato anything..."
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/30"
            />
            <IconBtn
              icon={Mic}
              onClick={() => setVoiceModalOpen(true)}
              title="Voice input"
            />
          </GlassCard>
          <Button
            variant="primary"
            icon={Send}
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="h-[52px] px-6"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // History View
  // ============================================================================
  const renderHistoryView = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <GlassCard className="flex-1 flex items-center gap-2 px-3 py-2">
            <Search className="w-4 h-4 text-white/50" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-white/30"
            />
          </GlassCard>
          <Button variant="secondary" size="sm">
            Filter
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {MOCK_HISTORY_SESSIONS.map((session) => (
          <GlassCard
            key={session.id}
            hover
            className="p-4"
            onClick={() => setCurrentView('chat')}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white truncate">
                  {session.title}
                </h4>
                <p className="text-xs text-white/50 mt-1 truncate">
                  {session.preview}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="default" size="sm">
                    {session.messageCount} messages
                  </Badge>
                  <Badge variant={
                    session.mood === 'balanced' ? 'info' :
                    session.mood === 'scout' ? 'success' :
                    session.mood === 'sage' ? 'purple' :
                    session.mood === 'spark' ? 'orange' : 'cyan'
                  } size="sm">
                    {CATO_MOODS[session.mood].label}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/30">
                  {session.updatedAt.toLocaleDateString()}
                </p>
                <IconBtn icon={MoreHorizontal} size="sm" />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );

  // ============================================================================
  // Artifacts View
  // ============================================================================
  const renderArtifactsView = () => {
    const artifactIcons = {
      code: Code,
      document: FileText,
      table: Table,
      chart: BarChart3,
      image: Image,
    };

    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Artifacts</h3>
            <Button variant="secondary" size="sm" icon={Plus}>
              New Artifact
            </Button>
          </div>
          <Tabs
            tabs={[
              { id: 'all', label: 'All' },
              { id: 'code', label: 'Code', icon: Code },
              { id: 'documents', label: 'Documents', icon: FileText },
            ]}
            activeTab="all"
            onChange={() => {}}
            className="mt-4"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-4">
            {MOCK_ARTIFACTS.map((artifact) => {
              const Icon = artifactIcons[artifact.type];
              return (
                <GlassCard key={artifact.id} hover className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-white/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">
                        {artifact.title}
                      </h4>
                      <p className="text-xs text-white/50 mt-1">
                        {artifact.type} • {artifact.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {artifact.type === 'code' && (
                    <div className="mt-3 p-2 bg-black/30 rounded-lg overflow-hidden">
                      <pre className="text-xs text-white/70 overflow-hidden max-h-20">
                        {artifact.content.slice(0, 200)}...
                      </pre>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button variant="ghost" size="sm" icon={Download}>
                      Download
                    </Button>
                    <Button variant="ghost" size="sm" icon={Edit3}>
                      Edit
                    </Button>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // Rules View
  // ============================================================================
  const renderRulesView = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">User Rules</h3>
            <p className="text-sm text-white/50">
              {rules.filter((r) => r.isEnabled).length} of {rules.length} rules active
            </p>
          </div>
          <Button variant="primary" size="sm" icon={Plus}>
            Add Rule
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {rules.map((rule) => (
          <GlassCard key={rule.id} className="p-4">
            <div className="flex items-start gap-4">
              <Toggle
                checked={rule.isEnabled}
                onChange={() => toggleRule(rule.id)}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-white">{rule.name}</h4>
                  <Badge variant={rule.priority === 0 ? 'error' : rule.priority === 1 ? 'warning' : 'default'} size="sm">
                    Priority {rule.priority}
                  </Badge>
                </div>
                <p className="text-xs text-white/50 mt-1">{rule.description}</p>
                
                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-xs text-white/30 mb-1">Conditions:</p>
                    <div className="flex flex-wrap gap-1">
                      {rule.conditions.map((cond, i) => (
                        <Badge key={i} variant="info" size="sm">{cond}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/30 mb-1">Actions:</p>
                    <div className="flex flex-wrap gap-1">
                      {rule.actions.map((action, i) => (
                        <Badge key={i} variant="success" size="sm">{action}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <IconBtn icon={Edit3} size="sm" title="Edit rule" />
                <IconBtn icon={Trash2} size="sm" title="Delete rule" />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );

  // ============================================================================
  // Workflows View
  // ============================================================================
  const renderWorkflowsView = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Workflows</h3>
            <p className="text-sm text-white/50">
              Visual workflow editor for multi-model orchestration
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={Save}>
              Save
            </Button>
            <Button variant="primary" size="sm" icon={Plus}>
              New Workflow
            </Button>
          </div>
        </div>
      </div>

      <WorkflowEditor
        steps={workflowSteps}
        onAddStep={handleAddWorkflowStep}
        onRemoveStep={handleRemoveWorkflowStep}
      />
    </div>
  );

  // ============================================================================
  // Time Machine View
  // ============================================================================
  const renderTimeMachineView = () => (
    <RealityScrubberTimeline
      snapshots={snapshots}
      currentPosition={timelinePosition}
      onPositionChange={setTimelinePosition}
      isPlaying={isTimelinePlaying}
      onPlayPause={() => setIsTimelinePlaying(!isTimelinePlaying)}
      onSkipBack={() => setTimelinePosition((p) => Math.max(0, p - 1))}
      onSkipForward={() => setTimelinePosition((p) => Math.min(snapshots.length - 1, p + 1))}
      onBookmark={handleBookmark}
      onRestore={handleRestore}
      onBranch={handleBranch}
    />
  );

  // ============================================================================
  // Morphing UI View (Agentic Polymorphic UI + Cost Estimation)
  // ============================================================================
  const renderMorphingView = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-400" />
              Agentic Morphing UI
            </h3>
            <p className="text-sm text-white/50">
              Watch the UI automatically transform based on your intent
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="purple" size="sm">
              <DollarSign className="w-3 h-3 mr-1" />
              Cost Estimation
            </Badge>
            <Badge variant="info" size="sm">
              Sniper / War Room
            </Badge>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <AgenticMorphingDemo 
          onMorphComplete={(viewType) => {
            console.log('Morphed to:', viewType);
          }}
        />
      </div>
    </div>
  );

  // ============================================================================
  // Settings View
  // ============================================================================
  const renderSettingsView = () => (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">Settings</h3>
        <p className="text-sm text-white/50">Customize your Think Tank experience</p>
      </div>

      <div className="p-4 space-y-6">
        {/* Appearance */}
        <GlassCard className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Palette className="w-5 h-5 text-white/70" />
            <h4 className="text-sm font-medium text-white">Appearance</h4>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="w-4 h-4 text-white/50" /> : <Sun className="w-4 h-4 text-white/50" />}
                <span className="text-sm text-white/70">Dark Mode</span>
              </div>
              <Toggle checked={darkMode} onChange={setDarkMode} />
            </div>
          </div>
        </GlassCard>

        {/* Sound & Notifications */}
        <GlassCard className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-white/70" />
            <h4 className="text-sm font-medium text-white">Sound & Notifications</h4>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {soundEnabled ? <Volume2 className="w-4 h-4 text-white/50" /> : <VolumeX className="w-4 h-4 text-white/50" />}
                <span className="text-sm text-white/70">Sound Effects</span>
              </div>
              <Toggle checked={soundEnabled} onChange={setSoundEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-white/50" />
                <span className="text-sm text-white/70">Notifications</span>
              </div>
              <Toggle checked={notificationsEnabled} onChange={setNotificationsEnabled} />
            </div>
          </div>
        </GlassCard>

        {/* Data & Privacy */}
        <GlassCard className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-white/70" />
            <h4 className="text-sm font-medium text-white">Data & Privacy</h4>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Save className="w-4 h-4 text-white/50" />
                <span className="text-sm text-white/70">Auto-save conversations</span>
              </div>
              <Toggle checked={autoSaveEnabled} onChange={setAutoSaveEnabled} />
            </div>
            <Button variant="danger" size="sm" icon={Trash2}>
              Clear All Data
            </Button>
          </div>
        </GlassCard>

        {/* Language & Region */}
        <GlassCard className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-white/70" />
            <h4 className="text-sm font-medium text-white">Language & Region</h4>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Language</span>
              <Badge variant="default">English (US)</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Timezone</span>
              <Badge variant="default">Pacific Time (PT)</Badge>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );

  // ============================================================================
  // Profile View
  // ============================================================================
  const renderProfileView = () => (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">Profile</h3>
      </div>

      <div className="p-4 space-y-6">
        {/* User Info */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
              {MOCK_USER_PROFILE.name.charAt(0)}
            </div>
            <div>
              <h4 className="text-xl font-semibold text-white">{MOCK_USER_PROFILE.name}</h4>
              <p className="text-sm text-white/50">{MOCK_USER_PROFILE.email}</p>
              <Button variant="secondary" size="sm" className="mt-2" icon={Edit3}>
                Edit Profile
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Usage Stats */}
        <GlassCard className="p-4">
          <h4 className="text-sm font-medium text-white mb-4">Usage Statistics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {MOCK_USER_PROFILE.stats.totalMessages.toLocaleString()}
              </p>
              <p className="text-xs text-white/50">Total Messages</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {MOCK_USER_PROFILE.stats.sessionsCount}
              </p>
              <p className="text-xs text-white/50">Sessions</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {(MOCK_USER_PROFILE.stats.totalTokens / 1000000).toFixed(1)}M
              </p>
              <p className="text-xs text-white/50">Tokens Used</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {Math.floor((Date.now() - MOCK_USER_PROFILE.stats.joinedAt.getTime()) / 86400000)}
              </p>
              <p className="text-xs text-white/50">Days Active</p>
            </div>
          </div>
        </GlassCard>

        {/* Preferences */}
        <GlassCard className="p-4">
          <h4 className="text-sm font-medium text-white mb-4">Preferences</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Default Model</span>
              <Badge variant="info">{MOCK_USER_PROFILE.preferences.defaultModel}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Theme</span>
              <Badge variant="default">{MOCK_USER_PROFILE.preferences.theme}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Advanced Mode</span>
              <Badge variant={MOCK_USER_PROFILE.preferences.advancedMode ? 'success' : 'default'}>
                {MOCK_USER_PROFILE.preferences.advancedMode ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================
  return (
    <div className="flex h-screen bg-[#0a0a0f] text-white">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full border-r border-white/10 flex flex-col bg-[#0d0d14] overflow-hidden"
          >
            {/* Logo */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Think Tank</h1>
                  <p className="text-xs text-white/50">Simulator v3.0</p>
                </div>
              </div>
            </div>

            {/* New Chat Button */}
            <div className="p-3">
              <Button
                variant="primary"
                className="w-full"
                icon={Plus}
                onClick={() => {
                  setMessages(INITIAL_MESSAGES);
                  setCurrentView('chat');
                }}
              >
                New Chat
              </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-2">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-1',
                    currentView === item.id
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && (
                    <Badge variant="default" size="sm">
                      {item.badge}
                    </Badge>
                  )}
                  <ChevronRight className={cn(
                    'w-4 h-4 transition-transform',
                    currentView === item.id && 'rotate-90'
                  )} />
                </button>
              ))}
            </nav>

            {/* User Section */}
            <div className="p-3 border-t border-white/10">
              <GlassCard
                hover
                className="p-3 flex items-center gap-3"
                onClick={() => setCurrentView('profile')}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">
                  {MOCK_USER_PROFILE.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {MOCK_USER_PROFILE.name}
                  </p>
                  <p className="text-xs text-white/50 truncate">
                    {MOCK_USER_PROFILE.email}
                  </p>
                </div>
              </GlassCard>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-[#0d0d14]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <IconBtn
              icon={PanelLeft}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              active={sidebarOpen}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            />
            <div>
              <h2 className="text-sm font-semibold text-white">
                {NAV_ITEMS.find((n) => n.id === currentView)?.label || 'Chat'}
              </h2>
              <p className="text-xs text-white/50">
                {currentView === 'chat' && `${messages.length} messages`}
                {currentView === 'history' && `${MOCK_HISTORY_SESSIONS.length} conversations`}
                {currentView === 'artifacts' && `${MOCK_ARTIFACTS.length} artifacts`}
                {currentView === 'rules' && `${rules.filter(r => r.isEnabled).length} active rules`}
                {currentView === 'workflows' && `${workflowSteps.length} steps`}
                {currentView === 'timemachine' && `${snapshots.length} snapshots`}
                {currentView === 'settings' && 'Customize your experience'}
                {currentView === 'profile' && MOCK_USER_PROFILE.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconBtn icon={Search} title="Search" />
            <IconBtn icon={Bell} title="Notifications" />
            <IconBtn icon={Settings} title="Settings" onClick={() => setCurrentView('settings')} />
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </main>

      {/* Voice Input Modal */}
      <VoiceInputModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        onTranscript={(text) => setInputValue(text)}
        voiceState={voiceState}
        setVoiceState={setVoiceState}
      />
    </div>
  );
}
