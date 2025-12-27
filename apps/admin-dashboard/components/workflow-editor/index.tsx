'use client';

import React, { useState, useRef, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Play,
  Save,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Settings,
  Trash2,
  Copy,
  Loader2,
  MoreVertical,
  Search,
  XCircle,
  Layers,
  Link2,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react';

// ============================================================================
// Shared Types
// ============================================================================

export interface BaseNode {
  id: string;
  x: number;
  y: number;
  label?: string;
}

export interface BaseConnection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  condition?: string;
}

// Model execution modes
export type ModelMode = 
  | 'standard'
  | 'thinking'        // Extended reasoning (o1, Claude thinking)
  | 'deep_research'   // In-depth research mode
  | 'fast'            // Speed-optimized
  | 'creative'        // Higher temperature
  | 'precise'         // Low temperature, factual
  | 'code'            // Code-specialized
  | 'vision'          // Multimodal with vision
  | 'long_context';   // Extended context

export interface ParallelExecutionConfig {
  enabled: boolean;
  mode: 'all' | 'race' | 'quorum';
  models: string[];
  quorumThreshold?: number;
  synthesizeResults?: boolean;
  synthesisStrategy?: 'best_of' | 'merge' | 'vote' | 'weighted';
  weightByConfidence?: boolean;
  timeoutMs?: number;
  failureStrategy?: 'fail_fast' | 'continue' | 'fallback';
  // AGI Dynamic Model Selection
  agiModelSelection?: boolean;
  minModels?: number;
  maxModels?: number;
  domainHints?: string[];
  // Model mode preferences
  preferredModes?: ModelMode[];
}

export interface PaletteItem {
  type: string;
  label: string;
  icon: ReactNode;
  color: string;
  description: string;
}

// ============================================================================
// Canvas Controls Component
// ============================================================================

export function CanvasControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
      <Button variant="outline" size="icon" onClick={onZoomOut}>
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="text-sm font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
      <Button variant="outline" size="icon" onClick={onZoomIn}>
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={onReset}>
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// Connection Mode Indicator
// ============================================================================

export function ConnectionModeIndicator({
  isConnecting,
  onCancel,
}: {
  isConnecting: boolean;
  onCancel: () => void;
}) {
  if (!isConnecting) return null;

  return (
    <div className="absolute top-4 left-4 z-20 bg-primary text-primary-foreground px-3 py-2 rounded-lg flex items-center gap-2 shadow-lg">
      <Link2 className="h-4 w-4" />
      <span className="text-sm">Click a step to connect</span>
      <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

// ============================================================================
// Canvas Background
// ============================================================================

export function CanvasBackground({
  zoom,
  panOffset,
  children,
  onClick,
}: {
  zoom: number;
  panOffset: { x: number; y: number };
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className="flex-1 relative overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:20px_20px]">
      <div
        className="absolute inset-0"
        style={{
          transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
          transformOrigin: 'center center',
        }}
        onClick={onClick}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Empty Canvas State
// ============================================================================

export function EmptyCanvasState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center">
        <div className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50">{icon}</div>
        <h3 className="text-lg font-medium text-muted-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground/70">{description}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Connection Line Component (SVG)
// ============================================================================

export function ConnectionLine({
  sourceX,
  sourceY,
  targetX,
  targetY,
  isSelected,
  label,
  onClick,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  isSelected?: boolean;
  label?: string;
  onClick?: () => void;
}) {
  const midY = (sourceY + targetY) / 2;
  const path = `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;

  return (
    <g onClick={onClick} className="cursor-pointer">
      <path
        d={path}
        fill="none"
        stroke={isSelected ? '#3b82f6' : '#94a3b8'}
        strokeWidth={isSelected ? 3 : 2}
        className="transition-all"
      />
      <circle cx={targetX} cy={targetY} r={4} fill={isSelected ? '#3b82f6' : '#94a3b8'} />
      {label && (
        <text
          x={(sourceX + targetX) / 2}
          y={(sourceY + targetY) / 2 - 10}
          textAnchor="middle"
          className="text-xs fill-muted-foreground"
        >
          {label}
        </text>
      )}
    </g>
  );
}

// ============================================================================
// Node Actions Dropdown
// ============================================================================

export function NodeActionsDropdown({
  onDuplicate,
  onDelete,
}: {
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="secondary" className="h-6 w-6 rounded-full shadow-md">
            <MoreVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================================================
// Editor Header/Toolbar
// ============================================================================

export function EditorHeader({
  title,
  subtitle,
  badge,
  badgeVariant = 'secondary',
  onBack,
  onSettings,
  onRun,
  onSave,
  isRunning,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
  onBack?: () => void;
  onSettings?: () => void;
  onRun?: () => void;
  onSave?: () => void;
  isRunning?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
      <div className="flex items-center gap-4">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{title}</span>
            {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" disabled>
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" disabled>
                <Redo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Separator orientation="vertical" className="h-6" />
        {onSettings && (
          <Button variant="outline" onClick={onSettings}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        )}
        {onRun && (
          <Button
            variant={isRunning ? 'destructive' : 'default'}
            onClick={onRun}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Test
              </>
            )}
          </Button>
        )}
        {onSave && (
          <Button onClick={onSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Palette Sidebar
// ============================================================================

export function PaletteSidebar<T extends PaletteItem>({
  title,
  items,
  searchValue,
  onSearchChange,
  onItemClick,
  renderItem,
}: {
  title: string;
  items: T[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onItemClick: (item: T) => void;
  renderItem?: (item: T) => ReactNode;
}) {
  const filteredItems = items.filter(
    (item) =>
      item.label.toLowerCase().includes(searchValue.toLowerCase()) ||
      item.description.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className="w-64 border-r bg-muted/30 p-4">
      <div className="mb-4">
        <h3 className="font-semibold mb-2">{title}</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${title.toLowerCase()}...`}
            className="pl-9"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-18rem)]">
        <div className="space-y-2">
          {filteredItems.map((item) =>
            renderItem ? (
              <div key={item.type} onClick={() => onItemClick(item)}>
                {renderItem(item)}
              </div>
            ) : (
              <button
                key={item.type}
                onClick={() => onItemClick(item)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted transition-colors text-left"
              >
                <div className={cn('p-2 rounded-lg text-white', item.color)}>{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                </div>
              </button>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Config Panel Header
// ============================================================================

export function ConfigPanelHeader({
  icon,
  iconColor,
  title,
  subtitle,
  onClose,
}: {
  icon: ReactNode;
  iconColor: string;
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg text-white', iconColor)}>{icon}</div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <XCircle className="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
  );
}

// ============================================================================
// Parallel Execution Config Panel
// ============================================================================

export function ParallelExecutionPanel({
  config,
  onUpdate,
  availableModels = ['claude-3-5-sonnet', 'gpt-4o', 'gpt-4-turbo', 'o1', 'deepseek-chat', 'gemini-2.0-flash'],
}: {
  config?: ParallelExecutionConfig;
  onUpdate: (config: ParallelExecutionConfig) => void;
  availableModels?: string[];
}) {
  const currentConfig: ParallelExecutionConfig = config || {
    enabled: false,
    mode: 'all',
    models: [],
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
          Parallel AI Execution
        </h4>
        <p className="text-xs text-blue-600 dark:text-blue-300">
          Call multiple AI providers simultaneously. Results can be synthesized using various
          strategies.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Enable Parallel Execution</Label>
          <p className="text-xs text-muted-foreground">Call multiple AI models at once</p>
        </div>
        <Switch
          checked={currentConfig.enabled}
          onCheckedChange={(v) =>
            onUpdate({
              ...currentConfig,
              enabled: v,
              models: currentConfig.models.length ? currentConfig.models : ['claude-3-5-sonnet', 'gpt-4o'],
            })
          }
        />
      </div>

      {currentConfig.enabled && (
        <>
          {/* AGI Dynamic Model Selection */}
          <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3 border border-violet-200 dark:border-violet-800">
            <div className="flex items-center justify-between mb-2">
              <div className="space-y-0.5">
                <Label className="text-violet-800 dark:text-violet-200">🧠 AGI Model Selection</Label>
                <p className="text-xs text-violet-600 dark:text-violet-300">
                  Let AGI dynamically select optimal models based on prompt and domain
                </p>
              </div>
              <Switch
                checked={currentConfig.agiModelSelection || false}
                onCheckedChange={(v) => onUpdate({ ...currentConfig, agiModelSelection: v })}
              />
            </div>
            
            {currentConfig.agiModelSelection && (
              <div className="mt-3 pt-3 border-t border-violet-200 dark:border-violet-700 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Min Models</Label>
                    <Input
                      type="number"
                      value={currentConfig.minModels || 2}
                      onChange={(e) => onUpdate({ ...currentConfig, minModels: Number(e.target.value) })}
                      min={1}
                      max={5}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max Models</Label>
                    <Input
                      type="number"
                      value={currentConfig.maxModels || 5}
                      onChange={(e) => onUpdate({ ...currentConfig, maxModels: Number(e.target.value) })}
                      min={2}
                      max={10}
                      className="h-8"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Domain Hints (optional)</Label>
                  <Input
                    value={currentConfig.domainHints?.join(', ') || ''}
                    onChange={(e) => onUpdate({ 
                      ...currentConfig, 
                      domainHints: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., coding, math, creative"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preferred Modes</Label>
                  <div className="grid grid-cols-2 gap-1">
                    {(['thinking', 'deep_research', 'fast', 'creative', 'precise', 'code'] as const).map((mode) => (
                      <label key={mode} className="flex items-center gap-1.5 p-1.5 text-xs border rounded hover:bg-muted/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentConfig.preferredModes?.includes(mode) || false}
                          onChange={(e) => {
                            const current = currentConfig.preferredModes || [];
                            const newModes = e.target.checked
                              ? [...current, mode]
                              : current.filter(m => m !== mode);
                            onUpdate({ ...currentConfig, preferredModes: newModes });
                          }}
                          className="rounded h-3 w-3"
                        />
                        <span className="capitalize">{mode.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Modes AGI can assign: 🧠 Thinking, 🔬 Deep Research, ⚡ Fast, 🎨 Creative, 🎯 Precise, 💻 Code
                  </p>
                </div>
                <p className="text-xs text-violet-500 dark:text-violet-400 italic">
                  AGI analyzes prompt &amp; domain to select optimal models with appropriate modes
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Execution Mode</Label>
            <Select
              value={currentConfig.mode}
              onValueChange={(v) => onUpdate({ ...currentConfig, mode: v as 'all' | 'race' | 'quorum' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (wait for all models)</SelectItem>
                <SelectItem value="race">Race (first success wins)</SelectItem>
                <SelectItem value="quorum">Quorum (majority threshold)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Manual model selection - only show if AGI selection is disabled */}
          {!currentConfig.agiModelSelection && (
            <div className="space-y-2">
              <Label>AI Models ({currentConfig.models.length} selected)</Label>
              <div className="grid grid-cols-1 gap-2">
                {availableModels.map((model) => (
                  <label
                    key={model}
                    className="flex items-center gap-2 p-2 border rounded-lg hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={currentConfig.models.includes(model)}
                      onChange={(e) => {
                        const newModels = e.target.checked
                          ? [...currentConfig.models, model]
                          : currentConfig.models.filter((m) => m !== model);
                        onUpdate({ ...currentConfig, models: newModels });
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{model}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {currentConfig.mode === 'quorum' && (
            <div className="space-y-2">
              <Label>Quorum Threshold</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[currentConfig.quorumThreshold || 0.5]}
                  onValueChange={([v]) => onUpdate({ ...currentConfig, quorumThreshold: v })}
                  min={0.1}
                  max={1}
                  step={0.1}
                  className="flex-1"
                />
                <span className="text-sm w-12">
                  {((currentConfig.quorumThreshold || 0.5) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Synthesize Results</Label>
              <p className="text-xs text-muted-foreground">Combine outputs from all models</p>
            </div>
            <Switch
              checked={currentConfig.synthesizeResults || false}
              onCheckedChange={(v) => onUpdate({ ...currentConfig, synthesizeResults: v })}
            />
          </div>

          {currentConfig.synthesizeResults && (
            <div className="space-y-2">
              <Label>Synthesis Strategy</Label>
              <Select
                value={currentConfig.synthesisStrategy || 'best_of'}
                onValueChange={(v) =>
                  onUpdate({
                    ...currentConfig,
                    synthesisStrategy: v as 'best_of' | 'merge' | 'vote' | 'weighted',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="best_of">Best Of (highest confidence)</SelectItem>
                  <SelectItem value="vote">Vote (most common answer)</SelectItem>
                  <SelectItem value="weighted">Weighted (confidence + speed)</SelectItem>
                  <SelectItem value="merge">Merge (combine all insights)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Timeout (ms)</Label>
            <Input
              type="number"
              value={currentConfig.timeoutMs || 30000}
              onChange={(e) => onUpdate({ ...currentConfig, timeoutMs: Number(e.target.value) })}
              min={1000}
              max={120000}
            />
          </div>

          <div className="space-y-2">
            <Label>Failure Strategy</Label>
            <Select
              value={currentConfig.failureStrategy || 'continue'}
              onValueChange={(v) =>
                onUpdate({
                  ...currentConfig,
                  failureStrategy: v as 'fail_fast' | 'continue' | 'fallback',
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="continue">Continue (use successful results)</SelectItem>
                <SelectItem value="fail_fast">Fail Fast (error if any fails)</SelectItem>
                <SelectItem value="fallback">Fallback (use backup model)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Settings Dialog
// ============================================================================

export function SettingsDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  onSave?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave || (() => onOpenChange(false))}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Connection Config Panel
// ============================================================================

export function ConnectionConfigPanel({
  onDelete,
  onClose,
}: {
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="w-80 border-l p-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Connection</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Condition (optional)</Label>
            <Input placeholder="e.g., confidence > 0.8" />
          </div>
          <Button variant="destructive" className="w-full" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Connection
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// useWorkflowEditor Hook
// ============================================================================

export function useWorkflowEditor<T extends BaseNode>() {
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom((z) => Math.min(2, z + 0.1));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, z - 0.1));
  const handleResetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 3000);
  };

  return {
    zoom,
    panOffset,
    isConnecting,
    setIsConnecting,
    showSettings,
    setShowSettings,
    isRunning,
    searchTerm,
    setSearchTerm,
    canvasRef,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleRun,
  };
}

// Re-export commonly used components
export { Card, CardContent, CardDescription, CardHeader, CardTitle };
export { Button };
export { Input };
export { Label };
export { Badge };
export { Textarea };
export { Switch };
export { ScrollArea };
export { Slider };
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
export { Tabs, TabsContent, TabsList, TabsTrigger };
export { cn };
