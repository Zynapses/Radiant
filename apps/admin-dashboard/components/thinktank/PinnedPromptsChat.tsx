'use client';

import { useState, useEffect, useMemo } from 'react';
import { Pin, Star, Search, Plus, X, Sparkles, MessageSquare, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Types
export interface ChatPrompt {
  id: string;
  name: string;
  prompt: string;
  category: string;
  createdAt: string;
  usageCount: number;
  isFavorite: boolean;
  model?: string;
}

interface PinnedPromptsChatProps {
  onSelectPrompt: (prompt: string) => void;
  currentInput?: string;
  className?: string;
}

const STORAGE_KEY = 'thinktank.pinnedPrompts';

const DEFAULT_CHAT_PROMPTS: ChatPrompt[] = [
  {
    id: 'tt-1',
    name: 'Explain Like I\'m 5',
    prompt: 'Explain this concept in very simple terms, as if you were explaining to a 5-year-old:',
    category: 'Learning',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: true,
  },
  {
    id: 'tt-2',
    name: 'Pros and Cons',
    prompt: 'List the pros and cons of the following, with a brief analysis:',
    category: 'Analysis',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: true,
  },
  {
    id: 'tt-3',
    name: 'Step by Step',
    prompt: 'Break this down into clear, numbered steps:',
    category: 'Instructions',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tt-4',
    name: 'Creative Story',
    prompt: 'Write a creative short story based on the following premise:',
    category: 'Creative',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tt-5',
    name: 'Debug Helper',
    prompt: 'Help me debug this issue. Here\'s what\'s happening and what I\'ve tried:',
    category: 'Development',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: true,
  },
  {
    id: 'tt-6',
    name: 'Brainstorm Ideas',
    prompt: 'Brainstorm 10 creative ideas for the following:',
    category: 'Creative',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tt-7',
    name: 'Summarize',
    prompt: 'Provide a concise summary of the following in bullet points:',
    category: 'Summary',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: true,
  },
  {
    id: 'tt-8',
    name: 'Compare Options',
    prompt: 'Compare these options and recommend the best choice with reasoning:',
    category: 'Analysis',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: false,
  },
];

const CATEGORIES = [
  'General',
  'Learning',
  'Analysis',
  'Instructions',
  'Creative',
  'Development',
  'Summary',
  'Research',
  'Writing',
];

export function PinnedPromptsChat({
  onSelectPrompt,
  currentInput = '',
  className,
}: PinnedPromptsChatProps) {
  const [prompts, setPrompts] = useState<ChatPrompt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ name: '', prompt: '', category: 'General' });
  const [isOpen, setIsOpen] = useState(false);

  // Load prompts
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPrompts(JSON.parse(stored));
      } catch {
        setPrompts(DEFAULT_CHAT_PROMPTS);
      }
    } else {
      setPrompts(DEFAULT_CHAT_PROMPTS);
    }
  }, []);

  // Save prompts
  const savePrompts = (newPrompts: ChatPrompt[]) => {
    setPrompts(newPrompts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrompts));
  };

  // Get unique categories from prompts
  const categories = useMemo(() => {
    const cats = new Set(prompts.map((p) => p.category));
    return Array.from(cats).sort();
  }, [prompts]);

  // Filter prompts
  const filteredPrompts = useMemo(() => {
    let filtered = [...prompts];

    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.prompt.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return b.usageCount - a.usageCount;
    });
  }, [prompts, searchQuery, selectedCategory]);

  // Favorite prompts for quick access
  const favoritePrompts = useMemo(() => {
    return prompts.filter((p) => p.isFavorite).slice(0, 4);
  }, [prompts]);

  const handleSelect = (prompt: ChatPrompt) => {
    const updated = prompts.map((p) =>
      p.id === prompt.id ? { ...p, usageCount: p.usageCount + 1 } : p
    );
    savePrompts(updated);
    onSelectPrompt(prompt.prompt);
    setIsOpen(false);
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = prompts.map((p) =>
      p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
    );
    savePrompts(updated);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    savePrompts(prompts.filter((p) => p.id !== id));
  };

  const handleAdd = () => {
    if (!newPrompt.name || !newPrompt.prompt) return;

    const prompt: ChatPrompt = {
      id: `tt-${Date.now()}`,
      name: newPrompt.name,
      prompt: newPrompt.prompt,
      category: newPrompt.category,
      createdAt: new Date().toISOString(),
      usageCount: 0,
      isFavorite: false,
    };

    savePrompts([prompt, ...prompts]);
    setNewPrompt({ name: '', prompt: '', category: 'General' });
    setShowAddDialog(false);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Quick Favorite Buttons */}
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
        {favoritePrompts.map((prompt) => (
          <Button
            key={prompt.id}
            variant="outline"
            size="sm"
            onClick={() => handleSelect(prompt)}
            className="shrink-0 gap-1.5 text-xs h-8 px-2.5"
          >
            <Zap className="h-3 w-3 text-yellow-500" />
            <span className="max-w-[100px] truncate">{prompt.name}</span>
          </Button>
        ))}
      </div>

      {/* Main Prompts Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
            <Pin className="h-4 w-4" />
            <span className="hidden sm:inline">Prompts</span>
            <Badge variant="secondary" className="ml-0.5 h-5 px-1.5">
              {prompts.length}
            </Badge>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[380px] p-0" align="end">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Saved Prompts
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNewPrompt({ ...newPrompt, prompt: currentInput });
                  setShowAddDialog(true);
                }}
                className="h-7 gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search prompts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>

            {/* Category Filter */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <Button
                variant={selectedCategory === null ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="h-6 text-xs px-2"
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="h-6 text-xs px-2"
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Prompts List */}
          <ScrollArea className="h-[300px]">
            {filteredPrompts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">No prompts found</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredPrompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    onClick={() => handleSelect(prompt)}
                    className="group flex items-start gap-2 p-2.5 rounded-md hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {prompt.isFavorite && (
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />
                        )}
                        <span className="font-medium text-sm truncate">
                          {prompt.name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {prompt.prompt}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {prompt.category}
                        </Badge>
                        {prompt.usageCount > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {prompt.usageCount}x used
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => handleToggleFavorite(prompt.id, e)}
                      >
                        <Star
                          className={cn(
                            'h-3 w-3',
                            prompt.isFavorite && 'fill-yellow-400 text-yellow-400'
                          )}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={(e) => handleDelete(prompt.id, e)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save New Prompt</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Give your prompt a name..."
                value={newPrompt.name}
                onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={newPrompt.category}
                onValueChange={(v) => setNewPrompt({ ...newPrompt, category: v })}
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
              <Label>Prompt Template</Label>
              <Textarea
                placeholder="Enter your prompt..."
                value={newPrompt.prompt}
                onChange={(e) => setNewPrompt({ ...newPrompt, prompt: e.target.value })}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!newPrompt.name || !newPrompt.prompt}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
