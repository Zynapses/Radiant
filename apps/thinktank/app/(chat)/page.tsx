'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Sparkles, Zap, Settings, MoreVertical, Table, BarChart3, Kanban, Calculator, Code, FileText } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { chatService, type Conversation, type StreamChunk } from '@/lib/api/chat';
import { exportConversation, type ExportFormat } from '@/lib/api/compliance-export';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sidebar, MessageBubble, ChatInput, AdvancedModeToggle, BrainPlanViewer } from '@/components/chat';
import { ViewRouter } from '@/components/polymorphic';
import { LiquidMorphPanel, type MorphedViewType } from '@/components/liquid';
import { useUIStore } from '@/lib/stores/ui-store';
import { useTranslation, T } from '@/lib/i18n';
import type { BrainPlan } from '@/lib/api/types';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  metadata?: {
    modelUsed?: string;
    tokensUsed?: number;
    latencyMs?: number;
    costEstimate?: number;
  };
}

const getWelcomeMessage = (t: (key: string) => string): LocalMessage => ({
  id: '1',
  role: 'assistant',
  content: t(T.chat.welcomeMessage),
  timestamp: new Date(),
});

export default function ThinkTankChat() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { sidebarOpen, setSidebarOpen, advancedMode } = useUIStore();
  
  const [messages, setMessages] = useState<LocalMessage[]>(() => [getWelcomeMessage(t)]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<BrainPlan | null>(null);
  const [isPlanExpanded, setIsPlanExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  const [viewState, setViewState] = useState<{ viewType: string; executionMode: string }>({ viewType: 'chat', executionMode: 'sniper' });
  
  // Morphing UI state
  const [morphedView, setMorphedView] = useState<MorphedViewType | null>(null);
  const [isMorphFullscreen, setIsMorphFullscreen] = useState(false);
  const [showMorphChat, setShowMorphChat] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keyboard shortcut for advanced mode toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        useUIStore.getState().toggleAdvancedMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadConversations = async () => {
    setIsLoadingConversations(true);
    try {
      const convs = await chatService.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const { messages: apiMessages } = await chatService.getConversation(conversationId);
      const mappedMessages: LocalMessage[] = apiMessages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.timestamp),
      }));
      setMessages(mappedMessages.length > 0 ? mappedMessages : [getWelcomeMessage(t)]);
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const startNewConversation = async () => {
    try {
      const conversation = await chatService.createConversation();
      setCurrentConversationId(conversation.id);
      setMessages([getWelcomeMessage(t)]);
      setCurrentPlan(null);
      await loadConversations();
    } catch (error) {
      console.error('Failed to create conversation:', error);
      setCurrentConversationId(null);
      setMessages([getWelcomeMessage(t)]);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await chatService.deleteConversation(conversationId);
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        setMessages([getWelcomeMessage(t)]);
      }
      await loadConversations();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleExportConversation = async (conversationId: string, format: ExportFormat) => {
    try {
      const result = await exportConversation(conversationId, { format });
      
      if (result.success) {
        if (result.downloadUrl) {
          // Open download URL in new tab
          window.open(result.downloadUrl, '_blank');
        } else if (result.artifactId) {
          // Navigate to decision record view
          alert(`Decision Record created: ${result.artifactId}`);
        }
      } else {
        alert(`Export failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to export conversation:', error);
      alert('Failed to export conversation');
    }
  };

  const handleSend = useCallback(async (input: string) => {
    if (!input.trim() || isTyping) return;

    const userMessage: LocalMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: LocalMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      if (isAuthenticated && currentConversationId) {
        await chatService.streamMessage(
          currentConversationId,
          input,
          (chunk: StreamChunk) => {
            if (chunk.type === 'content' && chunk.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: m.content + chunk.content }
                    : m
                )
              );
            } else if (chunk.type === 'metadata' && chunk.metadata) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { 
                        ...m, 
                        metadata: {
                          modelUsed: chunk.metadata?.modelId,
                          tokensUsed: chunk.metadata?.tokensUsed,
                          latencyMs: chunk.metadata?.latencyMs,
                        }
                      }
                    : m
                )
              );
            } else if (chunk.type === 'done') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId ? { ...m, isStreaming: false } : m
                )
              );
              setIsTyping(false);
            } else if (chunk.type === 'error') {
              throw new Error(chunk.error);
            }
          }
        );
      } else {
        await simulateResponse(assistantMessageId);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      await simulateResponse(assistantMessageId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTyping, isAuthenticated, currentConversationId]);

  const simulateResponse = useCallback(async (messageId: string) => {
    const responses = [
      "That's a great question! Let me break this down for you with some detailed insights.",
      "I'd be happy to help with that. Here's what I'm thinking...",
      "Interesting topic! Based on my analysis, there are several key aspects to consider.",
      "Let me explore that with you. Here are some important points to consider.",
    ];
    
    const responseText = responses[Math.floor(Math.random() * responses.length)] + 
      (isAuthenticated ? "" : "\n\nSign in to connect to the full Think Tank platform with 106+ AI models.");

    for (let i = 0; i <= responseText.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 15));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: responseText.slice(0, i) } : m
        )
      );
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isStreaming: false } : m))
    );
    setIsTyping(false);
  }, [isAuthenticated]);

  const handleRateMessage = async (messageId: string, positive: boolean) => {
    if (!currentConversationId) return;
    try {
      await chatService.rateMessage(
        currentConversationId,
        messageId,
        positive ? 'positive' : 'negative'
      );
    } catch (error) {
      console.error('Failed to rate message:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-r border-white/10 bg-slate-900/60 backdrop-blur-xl overflow-hidden"
          >
            <Sidebar
              conversations={conversations}
              currentConversationId={currentConversationId}
              onNewConversation={startNewConversation}
              onSelectConversation={loadConversation}
              onDeleteConversation={handleDeleteConversation}
              onExportConversation={handleExportConversation}
              isLoading={isLoadingConversations}
              user={user}
              isAuthenticated={isAuthenticated}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area with ViewRouter */}
      <ViewRouter
        initialView="chat"
        initialMode="sniper"
        onViewChange={(state) => setViewState(state)}
        className="flex-1 flex flex-col min-w-0"
      >
        {/* Header */}
        <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-slate-900/60 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon-sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-400 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
              <span className="font-medium text-white">Cato</span>
            </div>

            <Badge variant="glow" className="text-xs">
              {advancedMode ? (
                <>
                  <Zap className="h-3 w-3 mr-1" />
                  Advanced Mode
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1" />
                  Auto Mode
                </>
              )}
            </Badge>

            {advancedMode && selectedModel !== 'auto' && (
              <Badge variant="outline" className="text-xs text-slate-400">
                {selectedModel}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Morphing View Triggers (Advanced Mode) */}
            {advancedMode && !morphedView && (
              <div className="flex items-center gap-1 mr-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMorphedView('datagrid')}
                  className="text-slate-400 hover:text-green-400"
                  title="Open Data Grid"
                >
                  <Table className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMorphedView('chart')}
                  className="text-slate-400 hover:text-blue-400"
                  title="Open Chart"
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMorphedView('kanban')}
                  className="text-slate-400 hover:text-purple-400"
                  title="Open Kanban"
                >
                  <Kanban className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMorphedView('calculator')}
                  className="text-slate-400 hover:text-orange-400"
                  title="Open Calculator"
                >
                  <Calculator className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMorphedView('code_editor')}
                  className="text-slate-400 hover:text-cyan-400"
                  title="Open Code Editor"
                >
                  <Code className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMorphedView('document')}
                  className="text-slate-400 hover:text-amber-400"
                  title="Open Document"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            <AdvancedModeToggle />
            
            <Link href="/settings">
              <Button variant="ghost" size="icon-sm" className="text-slate-400 hover:text-white">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            
            <Button variant="ghost" size="icon-sm" className="text-slate-400 hover:text-white">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Morphed View Panel (when active) */}
        <AnimatePresence>
          {morphedView && (
            <LiquidMorphPanel
              viewType={morphedView}
              isFullscreen={isMorphFullscreen}
              onClose={() => setMorphedView(null)}
              onToggleFullscreen={() => setIsMorphFullscreen(!isMorphFullscreen)}
              onChatToggle={() => setShowMorphChat(!showMorphChat)}
              showChat={showMorphChat}
              intent={{
                category: viewState.executionMode === 'war_room' ? 'data_analysis' : 'general',
                confidence: 0.85,
                suggestedComponents: [morphedView],
                action: 'view',
                entities: {},
              }}
            />
          )}
        </AnimatePresence>

        {/* Messages (hidden when morphed view is active) */}
        {!morphedView && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Brain Plan Viewer (Advanced Mode) */}
              {advancedMode && currentPlan && (
                <BrainPlanViewer
                  plan={currentPlan}
                  isExpanded={isPlanExpanded}
                  onToggle={() => setIsPlanExpanded(!isPlanExpanded)}
                />
              )}

              {/* Messages */}
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={{
                    id: message.id,
                    role: message.role,
                    content: message.content,
                    timestamp: message.timestamp,
                    metadata: message.metadata,
                  }}
                  isStreaming={message.isStreaming}
                  showMetadata={advancedMode}
                  onRate={(positive) => handleRateMessage(message.id, positive)}
                />
              ))}

              {/* Typing Indicator */}
              {isTyping && !messages[messages.length - 1]?.isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-slate-800/80 rounded-2xl px-4 py-3 border border-slate-700/50">
                    <div className="flex gap-1.5">
                      <motion.div
                        className="w-2 h-2 bg-violet-400 rounded-full"
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                      />
                      <motion.div
                        className="w-2 h-2 bg-violet-400 rounded-full"
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
                      />
                      <motion.div
                        className="w-2 h-2 bg-violet-400 rounded-full"
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Input Area (hidden when morphed view is fullscreen) */}
        {!isMorphFullscreen && (
          <ChatInput
            onSend={handleSend}
            isLoading={isTyping}
            selectedModel={advancedMode ? selectedModel : undefined}
            onModelSelect={() => setSelectedModel('auto')}
          />
        )}
      </ViewRouter>
    </div>
  );
}
