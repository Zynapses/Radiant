'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  Search,
  Star,
  StarOff,
  Sparkles,
  Zap,
  DollarSign,
  Brain,
  Check,
  Settings2,
} from 'lucide-react';

interface Model {
  id: string;
  displayName: string;
  providerId: string;
  providerName: string;
  isNovel: boolean;
  category: string;
  contextWindow: number;
  capabilities: string[];
  userInputPrice: number;
  userOutputPrice: number;
  isFavorite?: boolean;
}

interface ModelPreferences {
  selectionMode: 'auto' | 'manual' | 'favorites';
  defaultModelId?: string;
  favoriteModels: string[];
  showStandardModels: boolean;
  showNovelModels: boolean;
  showCostPerMessage: boolean;
  maxCostPerMessage?: number;
}

interface ModelSelectorProps {
  selectedModel: string | null;
  onModelChange: (modelId: string | null) => void;
  disabled?: boolean;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  disabled,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: models = [] } = useQuery<Model[]>({
    queryKey: ['thinktank-models'],
    queryFn: () => fetch('/api/thinktank/models').then((r) => r.json()),
  });

  const { data: preferences } = useQuery<ModelPreferences>({
    queryKey: ['thinktank-model-preferences'],
    queryFn: () =>
      fetch('/api/thinktank/preferences/models').then((r) => r.json()),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: (modelId: string) =>
      fetch('/api/thinktank/preferences/models/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['thinktank-model-preferences'],
      });
      queryClient.invalidateQueries({ queryKey: ['thinktank-models'] });
    },
  });

  const { standardModels, novelModels, favoriteModels } = useMemo(() => {
    const filtered = models.filter(
      (m) =>
        m.displayName.toLowerCase().includes(search.toLowerCase()) ||
        m.providerId.toLowerCase().includes(search.toLowerCase())
    );

    return {
      standardModels: filtered.filter(
        (m) => !m.isNovel && preferences?.showStandardModels !== false
      ),
      novelModels: filtered.filter(
        (m) => m.isNovel && preferences?.showNovelModels !== false
      ),
      favoriteModels: filtered.filter((m) =>
        preferences?.favoriteModels?.includes(m.id)
      ),
    };
  }, [models, search, preferences]);

  const selectedModelDetails = selectedModel
    ? models.find((m) => m.id === selectedModel)
    : null;

  const formatPrice = (inputPrice: number, outputPrice: number) => {
    const avgPrice = (inputPrice + outputPrice) / 2;
    if (avgPrice < 1) return `$${avgPrice.toFixed(3)}/1K`;
    return `$${avgPrice.toFixed(2)}/1M`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="justify-between min-w-[200px]"
        >
          <div className="flex items-center gap-2">
            {selectedModel === null ? (
              <>
                <Brain className="h-4 w-4 text-purple-500" />
                <span>Auto</span>
                <Badge variant="secondary" className="text-xs">
                  RADIANT Brain
                </Badge>
              </>
            ) : (
              <>
                {selectedModelDetails?.isNovel && (
                  <Sparkles className="h-4 w-4 text-amber-500" />
                )}
                <span>
                  {selectedModelDetails?.displayName || selectedModel}
                </span>
                {preferences?.showCostPerMessage && selectedModelDetails && (
                  <span className="text-xs text-muted-foreground">
                    {formatPrice(
                      selectedModelDetails.userInputPrice,
                      selectedModelDetails.userOutputPrice
                    )}
                  </span>
                )}
              </>
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="all"
              className="rounded-none data-[state=active]:border-b-2"
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="favorites"
              className="rounded-none data-[state=active]:border-b-2"
            >
              <Star className="h-3 w-3 mr-1" />
              Favorites
            </TabsTrigger>
            <TabsTrigger
              value="standard"
              className="rounded-none data-[state=active]:border-b-2"
            >
              Standard
            </TabsTrigger>
            <TabsTrigger
              value="novel"
              className="rounded-none data-[state=active]:border-b-2"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Novel
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[300px]">
            {/* Auto Option */}
            <div className="p-1">
              <ModelOption
                model={null}
                isSelected={selectedModel === null}
                onSelect={() => {
                  onModelChange(null);
                  setOpen(false);
                }}
                showCost={false}
              />
            </div>

            <TabsContent value="all" className="m-0 p-1">
              {favoriteModels.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Favorites
                  </div>
                  {favoriteModels.map((model) => (
                    <ModelOption
                      key={model.id}
                      model={model}
                      isSelected={selectedModel === model.id}
                      isFavorite={true}
                      onSelect={() => {
                        onModelChange(model.id);
                        setOpen(false);
                      }}
                      onToggleFavorite={() =>
                        toggleFavoriteMutation.mutate(model.id)
                      }
                      showCost={preferences?.showCostPerMessage}
                    />
                  ))}
                </div>
              )}

              {standardModels.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Standard Models
                  </div>
                  {standardModels.map((model) => (
                    <ModelOption
                      key={model.id}
                      model={model}
                      isSelected={selectedModel === model.id}
                      isFavorite={preferences?.favoriteModels?.includes(
                        model.id
                      )}
                      onSelect={() => {
                        onModelChange(model.id);
                        setOpen(false);
                      }}
                      onToggleFavorite={() =>
                        toggleFavoriteMutation.mutate(model.id)
                      }
                      showCost={preferences?.showCostPerMessage}
                    />
                  ))}
                </div>
              )}

              {novelModels.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Novel / Experimental
                  </div>
                  {novelModels.map((model) => (
                    <ModelOption
                      key={model.id}
                      model={model}
                      isSelected={selectedModel === model.id}
                      isFavorite={preferences?.favoriteModels?.includes(
                        model.id
                      )}
                      onSelect={() => {
                        onModelChange(model.id);
                        setOpen(false);
                      }}
                      onToggleFavorite={() =>
                        toggleFavoriteMutation.mutate(model.id)
                      }
                      showCost={preferences?.showCostPerMessage}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="favorites" className="m-0 p-1">
              {favoriteModels.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No favorite models yet. Star models to add them here.
                </div>
              ) : (
                favoriteModels.map((model) => (
                  <ModelOption
                    key={model.id}
                    model={model}
                    isSelected={selectedModel === model.id}
                    isFavorite={true}
                    onSelect={() => {
                      onModelChange(model.id);
                      setOpen(false);
                    }}
                    onToggleFavorite={() =>
                      toggleFavoriteMutation.mutate(model.id)
                    }
                    showCost={preferences?.showCostPerMessage}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="standard" className="m-0 p-1">
              {standardModels.map((model) => (
                <ModelOption
                  key={model.id}
                  model={model}
                  isSelected={selectedModel === model.id}
                  isFavorite={preferences?.favoriteModels?.includes(model.id)}
                  onSelect={() => {
                    onModelChange(model.id);
                    setOpen(false);
                  }}
                  onToggleFavorite={() =>
                    toggleFavoriteMutation.mutate(model.id)
                  }
                  showCost={preferences?.showCostPerMessage}
                />
              ))}
            </TabsContent>

            <TabsContent value="novel" className="m-0 p-1">
              {novelModels.map((model) => (
                <ModelOption
                  key={model.id}
                  model={model}
                  isSelected={selectedModel === model.id}
                  isFavorite={preferences?.favoriteModels?.includes(model.id)}
                  onSelect={() => {
                    onModelChange(model.id);
                    setOpen(false);
                  }}
                  onToggleFavorite={() =>
                    toggleFavoriteMutation.mutate(model.id)
                  }
                  showCost={preferences?.showCostPerMessage}
                />
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Settings Footer */}
        <div className="border-t p-2 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span>Prices per 1M tokens</span>
          </div>
          <Button variant="ghost" size="sm" className="text-xs">
            <Settings2 className="h-3 w-3 mr-1" />
            Preferences
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ModelOption({
  model,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
  showCost,
}: {
  model: Model | null;
  isSelected: boolean;
  isFavorite?: boolean;
  onSelect: () => void;
  onToggleFavorite?: () => void;
  showCost?: boolean;
}) {
  if (model === null) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent',
          isSelected && 'bg-accent'
        )}
        onClick={onSelect}
      >
        <Brain className="h-5 w-5 text-purple-500" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">Auto</span>
            <Badge variant="secondary" className="text-xs">
              RADIANT Brain
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Intelligently selects the best model for your task
          </div>
        </div>
        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent group',
        isSelected && 'bg-accent'
      )}
      onClick={onSelect}
    >
      <div className="flex-shrink-0">
        {model.isNovel ? (
          <Sparkles className="h-5 w-5 text-amber-500" />
        ) : (
          <Zap className="h-5 w-5 text-blue-500" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{model.displayName}</span>
          {model.isNovel && (
            <Badge
              variant="outline"
              className="text-xs text-amber-600 border-amber-300"
            >
              Novel
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{model.providerName}</span>
          <span>•</span>
          <span>{(model.contextWindow / 1000).toFixed(0)}K context</span>
          {showCost && (
            <>
              <span>•</span>
              <span className="text-green-600">
                $
                {((model.userInputPrice + model.userOutputPrice) / 2).toFixed(
                  2
                )}
                /1M
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {onToggleFavorite && (
          <button
            className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
          >
            {isFavorite ? (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            ) : (
              <StarOff className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </div>
    </div>
  );
}
