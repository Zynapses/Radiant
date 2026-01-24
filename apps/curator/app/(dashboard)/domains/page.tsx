'use client';

import { useState, useEffect } from 'react';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';

interface DomainNode {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  children?: DomainNode[];
}

const defaultDomains: DomainNode[] = [];

function DomainTreeItem({
  node,
  level = 0,
  selectedId,
  onSelect,
  expandedIds,
  onToggle,
}: {
  node: DomainNode;
  level?: number;
  selectedId: string | null;
  onSelect: (node: DomainNode) => void;
  expandedIds: string[];
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.includes(node.id);
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        onClick={() => {
          onSelect(node);
          if (hasChildren) onToggle(node.id);
        }}
        className={cn(
          'domain-tree-item w-full',
          isSelected && 'selected'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
        <Folder className="h-4 w-4 text-curator-gold" />
        <span className="flex-1 text-left text-sm">{node.name}</span>
        <span className="text-xs text-muted-foreground">{node.nodeCount}</span>
      </button>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <DomainTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<DomainNode[]>(defaultDomains);
  const [selectedDomain, setSelectedDomain] = useState<DomainNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDomains() {
      try {
        const res = await fetch('/api/curator/domains');
        if (res.ok) {
          const data = await res.json();
          setDomains(data.domains || []);
          if (data.domains?.length > 0) {
            setExpandedIds([data.domains[0].id]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch domains:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchDomains();
  }, []);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const totalNodes = domains.reduce((sum: number, d: DomainNode) => sum + d.nodeCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Domain Taxonomy</h1>
          <p className="text-muted-foreground mt-1">
            Organize knowledge into hierarchical domains for better retrieval.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Add Domain
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Domain Tree */}
        <div className="lg:col-span-1">
          <GlassCard variant="default" padding="none">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-curator-gold" />
                <h3 className="font-semibold">Domains</h3>
              </div>
              <span className="text-xs text-muted-foreground">{totalNodes} nodes</span>
            </div>
            <div className="p-2 max-h-[500px] overflow-y-auto">
              {domains.map((domain) => (
                <DomainTreeItem
                  key={domain.id}
                  node={domain}
                  selectedId={selectedDomain?.id || null}
                  onSelect={setSelectedDomain}
                  expandedIds={expandedIds}
                  onToggle={toggleExpanded}
                />
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Domain Details */}
        <div className="lg:col-span-2">
          {selectedDomain ? (
            <GlassCard variant="elevated" padding="lg" className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selectedDomain.name}</h2>
                  {selectedDomain.description && (
                    <p className="text-muted-foreground mt-1">{selectedDomain.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-accent rounded-md" title="Edit">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button className="p-2 hover:bg-accent rounded-md text-destructive" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Knowledge Nodes</p>
                  <p className="text-2xl font-bold">{selectedDomain.nodeCount}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Sub-domains</p>
                  <p className="text-2xl font-bold">{selectedDomain.children?.length || 0}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Documents</p>
                  <p className="text-2xl font-bold">{Math.floor(selectedDomain.nodeCount / 3)}</p>
                </div>
              </div>

              {selectedDomain.children && selectedDomain.children.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Sub-domains</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedDomain.children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => setSelectedDomain(child)}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-curator-gold" />
                          <span className="font-medium">{child.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{child.nodeCount} nodes</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-3">Domain Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-categorization</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically assign new documents to this domain
                      </p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-curator-gold">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Require Verification</p>
                      <p className="text-sm text-muted-foreground">
                        All new facts must be verified before deployment
                      </p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-curator-gold">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>
          ) : (
            <GlassCard variant="default" padding="lg" className="flex flex-col items-center justify-center text-center h-[400px]">
              <Settings className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold">Select a Domain</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a domain from the tree to view and edit its settings
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
