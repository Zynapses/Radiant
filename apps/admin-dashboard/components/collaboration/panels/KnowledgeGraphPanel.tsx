'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Network, Plus, Maximize2, Brain, Check, HelpCircle, Zap, ListTodo, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface KnowledgeGraphPanelProps {
  session: any;
}

export function KnowledgeGraphPanel({ session }: KnowledgeGraphPanelProps) {
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const { data: graph } = useQuery({
    queryKey: ['knowledge-graph', session.id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/thinktank/collaboration/sessions/${session.id}/knowledge-graph`);
      if (!res.ok) throw new Error('Failed to fetch graph');
      const { data } = await res.json();
      return data;
    },
  });

  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'concept': return Brain;
      case 'fact': return Check;
      case 'question': return HelpCircle;
      case 'decision': return Zap;
      case 'action_item': return ListTodo;
      default: return Brain;
    }
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
            <Network className="h-5 w-5" />
            Knowledge Graph
          </h3>
          <p className="text-sm text-muted-foreground">Collective understanding visualization</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Node
          </Button>
          <Button variant="outline" size="sm">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 relative bg-muted/20">
        {graph?.nodes?.length > 0 ? (
          <div className="absolute inset-0 p-8">
            <div className="relative w-full h-full">
              {graph.nodes.map((node: any, i: number) => {
                const angle = (i / graph.nodes.length) * 2 * Math.PI;
                const x = 50 + Math.cos(angle) * 30;
                const y = 50 + Math.sin(angle) * 30;
                const NodeIcon = getNodeIcon(node.nodeType);

                return (
                  <div
                    key={node.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all hover:scale-110"
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onClick={() => setSelectedNode(node)}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg"
                      style={{ backgroundColor: node.color || '#6366f1' }}
                    >
                      <NodeIcon className="h-5 w-5" />
                    </div>
                    <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium">
                      {node.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Network className="h-16 w-16 mb-4 opacity-30" />
            <p>Knowledge graph is empty</p>
            <p className="text-sm mt-1">Concepts will be extracted from the conversation</p>
          </div>
        )}
      </div>

      {graph?.aiGaps?.length > 0 && (
        <div className="p-4 border-t bg-amber-50/50 dark:bg-amber-900/10">
          <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Knowledge Gaps Detected
          </h4>
          <div className="space-y-1">
            {graph.aiGaps.slice(0, 2).map((gap: any, i: number) => (
              <p key={i} className="text-sm text-muted-foreground">• {gap.topic}: {gap.reason}</p>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
