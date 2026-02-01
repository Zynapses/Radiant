'use client';

/**
 * Multimedia Sidecar Panel
 * RADIANT v5.53.0
 * 
 * UI for displaying cognitive sidecars attached to multimedia content:
 * - Transcription viewer with timestamps
 * - Frame sample gallery
 * - Embedding visualization
 * - Description levels
 * - Cross-modal bridge status
 * 
 * Uses glass UI design system.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { GlassCard } from '@/components/ui/glass-card';
import {
  FileText,
  Image,
  Video,
  FileAudio,
  FileType,
  Sparkles,
  Wand2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  Eye,
  Brain,
  Link2,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export type MediaType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'binary';
export type SidecarStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'partial';

export interface CognitiveSidecar {
  sidecarId: string;
  status: SidecarStatus;
  generatedAt: string;
  transcription?: {
    text: string;
    language: string;
    confidence: number;
    segments?: Array<{ start: number; end: number; text: string }>;
  };
  frameSamples?: Array<{
    timestampMs: number;
    signedUrl: string;
    description?: string;
  }>;
  embedding?: {
    model: string;
    dimensions: number;
    vector: number[];
  };
  description?: {
    short: string;
    medium: string;
    detailed: string;
    modelUsed: string;
  };
  documentContent?: {
    extractedText: string;
    pageCount?: number;
    structure?: { headings: string[]; tables: number; images: number };
  };
  metadata?: {
    duration?: number;
    width?: number;
    height?: number;
    mimeType?: string;
    fileSizeBytes?: number;
  };
  errors?: Array<{ component: string; message: string; recoverable: boolean }>;
}

export interface MultimediaStream {
  streamId: string;
  mediaType: MediaType;
  sourceUri: string;
  originalFilename?: string;
  sidecar: CognitiveSidecar;
}

// =============================================================================
// Media Type Icons
// =============================================================================

const MediaIcon = ({ type, className }: { type: MediaType; className?: string }) => {
  const icons = {
    text: FileText,
    image: Image,
    video: Video,
    audio: FileAudio,
    document: FileType,
    binary: FileType,
  };
  const Icon = icons[type];
  return <Icon className={className} />;
};

// =============================================================================
// Status Badge
// =============================================================================

function SidecarStatusBadge({ status }: { status: SidecarStatus }) {
  const statusConfig = {
    pending: { icon: Clock, label: 'Pending', variant: 'secondary' as const },
    processing: { icon: Loader2, label: 'Processing', variant: 'secondary' as const },
    complete: { icon: CheckCircle2, label: 'Complete', variant: 'default' as const },
    failed: { icon: AlertCircle, label: 'Failed', variant: 'destructive' as const },
    partial: { icon: AlertCircle, label: 'Partial', variant: 'outline' as const },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className={cn('w-3 h-3', status === 'processing' && 'animate-spin')} />
      {config.label}
    </Badge>
  );
}

// =============================================================================
// Transcription Viewer
// =============================================================================

function TranscriptionViewer({
  transcription,
}: {
  transcription: CognitiveSidecar['transcription'];
}) {
  const [activeSegment, setActiveSegment] = useState<number | null>(null);

  if (!transcription) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileAudio className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No transcription available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{transcription.language.toUpperCase()}</Badge>
          <span className="text-xs text-muted-foreground">
            {(transcription.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
      </div>

      {transcription.segments ? (
        <ScrollArea className="h-64 rounded-lg border border-white/10 p-3">
          <div className="space-y-2">
            {transcription.segments.map((segment, idx) => (
              <motion.div
                key={idx}
                className={cn(
                  'p-2 rounded-lg cursor-pointer transition-colors',
                  activeSegment === idx 
                    ? 'bg-violet-500/20 border border-violet-500/30' 
                    : 'hover:bg-white/5'
                )}
                onClick={() => setActiveSegment(idx)}
              >
                <div className="flex items-start gap-3">
                  <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                    {formatTime(segment.start)}
                  </span>
                  <p className="text-sm flex-1">{segment.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
          <p className="text-sm whitespace-pre-wrap">{transcription.text}</p>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================================
// Frame Samples Gallery
// =============================================================================

function FrameSamplesGallery({
  frames,
}: {
  frames: CognitiveSidecar['frameSamples'];
}) {
  const [selectedFrame, setSelectedFrame] = useState<number>(0);

  if (!frames || frames.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Video className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No frame samples available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="aspect-video rounded-lg overflow-hidden bg-black/50 border border-white/10">
        <img
          src={frames[selectedFrame].signedUrl}
          alt={`Frame at ${formatTime(frames[selectedFrame].timestampMs / 1000)}`}
          className="w-full h-full object-contain"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {frames.map((frame, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedFrame(idx)}
            className={cn(
              'flex-shrink-0 w-20 h-12 rounded overflow-hidden border-2 transition-all',
              selectedFrame === idx
                ? 'border-violet-500 ring-2 ring-violet-500/30'
                : 'border-white/10 hover:border-white/30'
            )}
          >
            <img
              src={frame.signedUrl}
              alt={`Thumbnail ${idx + 1}`}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {frames[selectedFrame].description && (
        <p className="text-sm text-muted-foreground">
          {frames[selectedFrame].description}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Description Levels
// =============================================================================

function DescriptionViewer({
  description,
}: {
  description: CognitiveSidecar['description'];
}) {
  const [level, setLevel] = useState<'short' | 'medium' | 'detailed'>('medium');

  if (!description) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No description available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Detail level:</span>
        <div className="flex gap-1">
          {(['short', 'medium', 'detailed'] as const).map((l) => (
            <Button
              key={l}
              size="sm"
              variant={level === l ? 'default' : 'ghost'}
              onClick={() => setLevel(l)}
              className="h-7 text-xs capitalize"
            >
              {l}
            </Button>
          ))}
        </div>
      </div>

      <motion.div
        key={level}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-lg bg-white/5 border border-white/10"
      >
        <p className="text-sm">{description[level]}</p>
      </motion.div>

      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Brain className="w-3 h-3" />
        Generated by {description.modelUsed}
      </div>
    </div>
  );
}

// =============================================================================
// Embedding Visualization
// =============================================================================

function EmbeddingViewer({
  embedding,
}: {
  embedding: CognitiveSidecar['embedding'];
}) {
  if (!embedding) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No embedding available</p>
      </div>
    );
  }

  // Visualize first 64 dimensions as a heatmap
  const visibleDims = embedding.vector.slice(0, 64);
  const maxVal = Math.max(...visibleDims.map(Math.abs));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline">{embedding.model}</Badge>
        <span className="text-xs text-muted-foreground">
          {embedding.dimensions} dimensions
        </span>
      </div>

      <div className="grid grid-cols-8 gap-1">
        {visibleDims.map((val, idx) => {
          const normalized = val / maxVal;
          const hue = normalized > 0 ? 270 : 180; // Purple for positive, cyan for negative
          const lightness = 30 + Math.abs(normalized) * 40;
          return (
            <div
              key={idx}
              className="aspect-square rounded-sm"
              style={{
                backgroundColor: `hsl(${hue}, 70%, ${lightness}%)`,
              }}
              title={`dim[${idx}]: ${val.toFixed(4)}`}
            />
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Showing first 64 of {embedding.dimensions} dimensions
      </p>
    </div>
  );
}

// =============================================================================
// Cross-Modal Bridge Status
// =============================================================================

function BridgeStatus({
  stream,
  targetModality,
}: {
  stream: MultimediaStream;
  targetModality: 'text' | 'embedding';
}) {
  const sidecar = stream.sidecar;
  const canBridge = targetModality === 'text'
    ? !!(sidecar.transcription || sidecar.description || sidecar.documentContent)
    : !!sidecar.embedding;

  const bridgeMethod = targetModality === 'text'
    ? sidecar.transcription ? 'transcription' : sidecar.description ? 'description' : 'document'
    : 'embedding';

  return (
    <GlassCard variant="inset" padding="sm" className="flex items-center gap-3">
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center',
        canBridge ? 'bg-emerald-500/20' : 'bg-zinc-500/20'
      )}>
        <Link2 className={cn('w-4 h-4', canBridge ? 'text-emerald-400' : 'text-zinc-400')} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium flex items-center gap-2">
          {stream.mediaType}
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          {targetModality}
        </div>
        <div className="text-xs text-muted-foreground">
          {canBridge 
            ? `Bridge via ${bridgeMethod}` 
            : 'No bridge available'
          }
        </div>
      </div>
      <Badge variant={canBridge ? 'default' : 'secondary'}>
        {canBridge ? 'Ready' : 'N/A'}
      </Badge>
    </GlassCard>
  );
}

// =============================================================================
// Main Panel Component
// =============================================================================

export function MultimediaSidecarPanel({
  stream,
  onRegenerate,
  className,
}: {
  stream: MultimediaStream;
  onRegenerate?: () => void;
  className?: string;
}) {
  const { sidecar } = stream;

  return (
    <GlassCard className={cn('p-4', className)} variant="elevated">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <MediaIcon type={stream.mediaType} className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-medium text-sm truncate max-w-[200px]">
              {stream.originalFilename || 'Media File'}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{stream.mediaType}</span>
              {sidecar.metadata?.fileSizeBytes && (
                <>
                  <span>•</span>
                  <span>{formatBytes(sidecar.metadata.fileSizeBytes)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <SidecarStatusBadge status={sidecar.status} />
      </div>

      {/* Tabs for different sidecar components */}
      <Tabs defaultValue="description" className="w-full">
        <TabsList className="w-full grid grid-cols-4 mb-4">
          <TabsTrigger value="description" className="text-xs">
            <Eye className="w-3 h-3 mr-1" />
            Description
          </TabsTrigger>
          <TabsTrigger value="transcription" className="text-xs">
            <FileText className="w-3 h-3 mr-1" />
            Transcript
          </TabsTrigger>
          <TabsTrigger value="frames" className="text-xs">
            <Video className="w-3 h-3 mr-1" />
            Frames
          </TabsTrigger>
          <TabsTrigger value="embedding" className="text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            Embedding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="description">
          <DescriptionViewer description={sidecar.description} />
        </TabsContent>

        <TabsContent value="transcription">
          <TranscriptionViewer transcription={sidecar.transcription} />
        </TabsContent>

        <TabsContent value="frames">
          <FrameSamplesGallery frames={sidecar.frameSamples} />
        </TabsContent>

        <TabsContent value="embedding">
          <EmbeddingViewer embedding={sidecar.embedding} />
        </TabsContent>
      </Tabs>

      {/* Bridge Status */}
      <div className="mt-4 space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Cross-Modal Bridges
        </h4>
        <BridgeStatus stream={stream} targetModality="text" />
      </div>

      {/* Errors */}
      {sidecar.errors && sidecar.errors.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <h4 className="text-xs font-medium text-red-400 mb-2">Errors</h4>
          {sidecar.errors.map((error, idx) => (
            <div key={idx} className="text-xs text-red-300">
              <span className="font-medium">{error.component}:</span> {error.message}
            </div>
          ))}
        </div>
      )}

      {/* Regenerate Button */}
      {onRegenerate && sidecar.status !== 'processing' && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          className="w-full mt-4"
        >
          <Wand2 className="w-3 h-3 mr-2" />
          Regenerate Sidecar
        </Button>
      )}
    </GlassCard>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default MultimediaSidecarPanel;
