'use client';

import { useState, useEffect, useMemo } from 'react';
import { Pin, Star, Search, Plus, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  PinnedPrompt,
  PromptScope,
  PROMPT_CATEGORIES,
  loadPrompts,
  savePrompts,
  filterPrompts,
  createPrompt,
  updatePromptUsage,
  togglePromptFavorite,
  deletePrompt,
  DEFAULT_ADMIN_PROMPTS,
} from '@/lib/prompts';

// Re-export type for consumers
export type { PinnedPrompt };

interface PinnedPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  currentPrompt?: string;
  scope?: PromptScope;
  className?: string;
}

const CATEGORIES = [
  'General',
  'Summarization',
  'Development',
  'Education',
  'Writing',
  'Analytics',
  'Research',
  'Creative',
  'Support',
];

export function PinnedPrompts({
  onSelectPrompt,
  currentPrompt = '',
  scope = 'all',
  className,
}: PinnedPromptsProps) {
  const [prompts, setPrompts] = useState<PinnedPrompt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ name: '', prompt: '', category: 'General' });

  // Load prompts from localStorage
  useEffect(() => {
    const stored = loadPrompts(scope);
    if (stored) {
      setPrompts(stored);
    } else {
      setPrompts(DEFAULT_ADMIN_PROMPTS);
    }
  }, [scope]);

  // Save prompts to localStorage
  const handleSavePrompts = (newPrompts: PinnedPrompt[]) => {
    setPrompts(newPrompts);
    savePrompts(newPrompts, scope);
  };

  // Filter prompts based on search and scope
  const filteredPrompts = useMemo(() => {
    return filterPrompts(prompts, { scope, searchQuery });
  }, [prompts, scope, searchQuery]);

  const handleSelectPrompt = (prompt: PinnedPrompt) => {
    const updated = updatePromptUsage(prompts, prompt.id);
    handleSavePrompts(updated);
    onSelectPrompt(prompt.prompt);
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = togglePromptFavorite(prompts, id);
    handleSavePrompts(updated);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deletePrompt(prompts, id);
    handleSavePrompts(updated);
  };

  const handleAddPrompt = () => {
    if (!newPrompt.name || !newPrompt.prompt) return;

    const prompt = createPrompt(
      newPrompt.name,
      newPrompt.prompt,
      newPrompt.category,
      scope
    );

    handleSavePrompts([prompt, ...prompts]);
    setNewPrompt({ name: '', prompt: '', category: 'General' });
    setShowAddDialog(false);
  };

  const handlePinCurrent = () => {
    if (!currentPrompt) return;
    setNewPrompt({ ...newPrompt, prompt: currentPrompt });
    setShowAddDialog(true);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant={isExpanded ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          <Pin className="h-4 w-4" />
          <span>Saved Prompts</span>
          <Badge variant="secondary" className="ml-1">
            {filteredPrompts.length}
          </Badge>
        </Button>

        <div className="flex items-center gap-1">
          {currentPrompt && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePinCurrent}
              title="Pin current prompt"
            >
              <Pin className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            title="Add new prompt"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="rounded-lg border bg-card p-3 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Prompts Grid */}
          {filteredPrompts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Pin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No saved prompts found</p>
            </div>
          ) : (
            <div className="grid gap-2 max-h-[300px] overflow-y-auto">
              {filteredPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  onClick={() => handleSelectPrompt(prompt)}
                  className="group flex items-start gap-3 p-2.5 rounded-md border bg-background hover:bg-accent cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {prompt.isFavorite && (
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      )}
                      <span className="font-medium text-sm truncate">
                        {prompt.name}
                      </span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {prompt.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {prompt.prompt}
                    </p>
                    {prompt.usageCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Used {prompt.usageCount}x
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => handleToggleFavorite(prompt.id, e)}
                      title={prompt.isFavorite ? 'Unfavorite' : 'Favorite'}
                    >
                      <Star
                        className={cn(
                          'h-3.5 w-3.5',
                          prompt.isFavorite && 'fill-yellow-400 text-yellow-400'
                        )}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => handleDelete(prompt.id, e)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Prompt Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Prompt</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Code Review Request"
                value={newPrompt.name}
                onChange={(e) =>
                  setNewPrompt({ ...newPrompt, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={newPrompt.category}
                onValueChange={(value) =>
                  setNewPrompt({ ...newPrompt, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                placeholder="Enter your prompt template..."
                value={newPrompt.prompt}
                onChange={(e) =>
                  setNewPrompt({ ...newPrompt, prompt: e.target.value })
                }
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddPrompt}
              disabled={!newPrompt.name || !newPrompt.prompt}
            >
              Save Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Quick Prompts Row - simplified horizontal version
export function QuickPrompts({
  onSelectPrompt,
  scope = 'all',
  className,
}: Omit<PinnedPromptsProps, 'currentPrompt'>) {
  const [prompts, setPrompts] = useState<PinnedPrompt[]>([]);

  useEffect(() => {
    const stored = loadPrompts(scope);
    if (stored) {
      setPrompts(stored);
    } else {
      setPrompts(DEFAULT_ADMIN_PROMPTS);
    }
  }, [scope]);

  const favorites = useMemo(() => {
    return prompts
      .filter((p) => p.isFavorite && (p.scope === scope || p.scope === 'all'))
      .slice(0, 5);
  }, [prompts, scope]);

  if (favorites.length === 0) return null;

  return (
    <div className={cn('flex gap-2 flex-wrap', className)}>
      {favorites.map((prompt) => (
        <Button
          key={prompt.id}
          variant="outline"
          size="sm"
          onClick={() => onSelectPrompt(prompt.prompt)}
          className="gap-1.5 text-xs"
        >
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          {prompt.name}
        </Button>
      ))}
    </div>
  );
}
