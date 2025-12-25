'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, ArrowLeftRight, ArrowUpDown, Grid } from 'lucide-react';
import { api } from '@/lib/api/client';

interface Pane {
  id: string;
  paneIndex: number;
  chatId?: string;
  model?: string;
  status: string;
}

interface SplitPaneProps {
  sessionId: string;
  onSendMessage: (paneIndex: number, message: string) => void;
}

export function SplitPane({ sessionId, onSendMessage }: SplitPaneProps) {
  const queryClient = useQueryClient();
  const [layout, setLayout] = useState<'horizontal' | 'vertical' | 'grid'>('horizontal');
  const [sizes, setSizes] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: session } = useQuery({
    queryKey: ['concurrent-session', sessionId],
    queryFn: () => api.get(`/admin/concurrent/${sessionId}`),
  });

  const { data: panes = [] } = useQuery({
    queryKey: ['concurrent-panes', sessionId],
    queryFn: () => api.get<Pane[]>(`/admin/concurrent/${sessionId}/panes`),
  });

  const addPaneMutation = useMutation({
    mutationFn: () => api.post(`/admin/concurrent/${sessionId}/panes`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concurrent-panes', sessionId] }),
  });

  const removePaneMutation = useMutation({
    mutationFn: (paneIndex: number) =>
      api.delete(`/admin/concurrent/${sessionId}/panes/${paneIndex}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concurrent-panes', sessionId] }),
  });

  const updateModelMutation = useMutation({
    mutationFn: ({ paneIndex, model }: { paneIndex: number; model: string }) =>
      api.patch(`/admin/concurrent/${sessionId}/panes/${paneIndex}`, { model }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concurrent-panes', sessionId] }),
  });

  const handleResize = useCallback((index: number, delta: number) => {
    setSizes((prev) => {
      const newSizes = [...prev];
      newSizes[index] = Math.max(10, Math.min(90, newSizes[index] + delta));
      newSizes[index + 1] = Math.max(10, Math.min(90, newSizes[index + 1] - delta));
      return newSizes;
    });
  }, []);

  const getLayoutClasses = () => {
    switch (layout) {
      case 'vertical':
        return 'flex-col';
      case 'grid':
        return 'grid grid-cols-2';
      default:
        return 'flex-row';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Button
            variant={layout === 'horizontal' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLayout('horizontal')}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          <Button
            variant={layout === 'vertical' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLayout('vertical')}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <Button
            variant={layout === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLayout('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
        </div>

        <Button
          size="sm"
          onClick={() => addPaneMutation.mutate()}
          disabled={panes.length >= 4 || addPaneMutation.isPending}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Pane
        </Button>
      </div>

      {/* Panes Container */}
      <div ref={containerRef} className={`flex-1 flex ${getLayoutClasses()} gap-1 p-1`}>
        {panes.map((pane: Pane, index: number) => (
          <React.Fragment key={pane.id}>
            <div
              className="flex-1 min-w-0 border rounded-lg overflow-hidden bg-card"
              style={{ flex: sizes[index] ? `0 0 ${sizes[index]}%` : 1 }}
            >
              <PaneContent
                pane={pane}
                onRemove={() => removePaneMutation.mutate(pane.paneIndex)}
                onModelChange={(model) =>
                  updateModelMutation.mutate({ paneIndex: pane.paneIndex, model })
                }
                onSendMessage={(message) => onSendMessage(pane.paneIndex, message)}
                canRemove={panes.length > 1}
              />
            </div>
            {index < panes.length - 1 && layout !== 'grid' && (
              <div
                className={`${
                  layout === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
                } bg-border hover:bg-primary transition-colors`}
                onMouseDown={(e) => {
                  const startPos = layout === 'horizontal' ? e.clientX : e.clientY;
                  const onMouseMove = (moveEvent: MouseEvent) => {
                    const currentPos =
                      layout === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
                    handleResize(index, (currentPos - startPos) / 5);
                  };
                  const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                  };
                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

interface PaneContentProps {
  pane: Pane;
  onRemove: () => void;
  onModelChange: (model: string) => void;
  onSendMessage: (message: string) => void;
  canRemove: boolean;
}

function PaneContent({ pane, onRemove, onModelChange, onSendMessage, canRemove }: PaneContentProps) {
  const [input, setInput] = useState('');

  const models = [
    { id: 'claude-opus-4', name: 'Claude Opus 4' },
    { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'grok-3', name: 'Grok 3' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  ];

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Pane Header */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30">
        <Select value={pane.model || ''} onValueChange={onModelChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-auto p-4 bg-muted/10">
        <div className="text-muted-foreground text-center text-sm">
          {pane.model ? `Ready to chat with ${pane.model}` : 'Select a model to start'}
        </div>
      </div>

      {/* Input */}
      <div className="p-2 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!pane.model}
          />
          <Button onClick={handleSend} disabled={!pane.model || !input.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SplitPane;
