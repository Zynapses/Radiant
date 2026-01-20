'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Play, Pause, SkipBack, SkipForward, Rewind, FastForward, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

interface PlaybackPanelProps {
  session: any;
}

export function PlaybackPanel({ session }: PlaybackPanelProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedRecording, setSelectedRecording] = useState<any>(null);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full flex flex-col"
    >
      <div className="p-4 border-b">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Time-Shifted Playback
        </h3>
        <p className="text-sm text-muted-foreground">Catch up on what you missed asynchronously</p>
      </div>

      <ScrollArea className="flex-1 p-4">
        {session.recordings?.length > 0 ? (
          <div className="space-y-3">
            {session.recordings.map((recording: any) => (
              <Card
                key={recording.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  selectedRecording?.id === recording.id && 'border-primary'
                )}
                onClick={() => setSelectedRecording(recording)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">
                        {recording.title || `Recording from ${new Date(recording.startTime).toLocaleDateString()}`}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {recording.durationSeconds
                          ? `${Math.floor(recording.durationSeconds / 60)}m ${recording.durationSeconds % 60}s`
                          : 'In progress'}
                        {' • '}
                        {recording.events?.length || 0} events
                      </p>
                    </div>
                    <Badge variant="outline">{recording.recordingType}</Badge>
                  </div>

                  {recording.aiKeyMoments?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {recording.aiKeyMoments.slice(0, 3).map((moment: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{moment.title}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No recordings yet</p>
            <p className="text-sm mt-1">Start recording to enable async playback</p>
            <Button className="mt-4" variant="outline">
              <Play className="h-4 w-4 mr-2" />
              Start Recording
            </Button>
          </div>
        )}
      </ScrollArea>

      {selectedRecording && (
        <div className="p-4 border-t bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">{selectedRecording.title || 'Session Recording'}</span>
            <span className="text-xs text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(selectedRecording.durationSeconds || 0)}
            </span>
          </div>

          <Slider
            value={[currentTime]}
            max={selectedRecording.durationSeconds || 100}
            step={1}
            onValueChange={([v]) => setCurrentTime(v)}
            className="mb-3"
          />

          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Rewind className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={() => setIsPlaying(!isPlaying)} className="h-10 w-10">
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon">
              <FastForward className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <SkipForward className="h-4 w-4" />
            </Button>

            <div className="ml-4 flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Select value={playbackSpeed.toString()} onValueChange={(v) => setPlaybackSpeed(parseFloat(v))}>
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5x</SelectItem>
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="1.5">1.5x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
