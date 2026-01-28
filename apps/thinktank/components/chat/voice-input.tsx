'use client';

/**
 * Voice Input Component for Think Tank Consumer App
 * Uses Whisper API for consistent cross-browser speech recognition
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2, X, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
  className?: string;
  disabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'error';

export function VoiceInput({
  onTranscript,
  onError,
  language = 'en',
  className,
  disabled = false,
}: VoiceInputProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', language);

      const response = await fetch('/api/thinktank/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      
      if (data.text) {
        onTranscript(data.text);
        setState('idle');
      } else {
        throw new Error('No transcription returned');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setErrorMessage('Failed to transcribe audio');
      setState('error');
      onError?.('Failed to transcribe audio');
      
      // Reset after 3 seconds
      setTimeout(() => {
        setState('idle');
        setErrorMessage(null);
      }, 3000);
    }
  }, [language, onTranscript, onError]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio analyser for level visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start level monitoring
      const updateLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
        }
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop level monitoring
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Process audio
        setState('processing');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      
      setState('recording');
      setDuration(0);
      setErrorMessage(null);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording:', err);
      setErrorMessage('Microphone access denied');
      setState('error');
      onError?.('Microphone access denied');
    }
  }, [onError, processAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }
  }, [state]);


  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
      audioChunksRef.current = [];
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    setState('idle');
    setAudioLevel(0);
    setDuration(0);
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('relative', className)}>
      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.button
            key="idle"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={startRecording}
            disabled={disabled}
            className={cn(
              'p-3 rounded-full transition-all',
              'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700',
              'text-zinc-600 dark:text-zinc-400',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Start voice input"
          >
            <Mic className="w-5 h-5" />
          </motion.button>
        )}

        {state === 'recording' && (
          <motion.div
            key="recording"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="flex items-center gap-3 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30"
          >
            {/* Audio level visualization */}
            <div className="flex items-center gap-0.5 h-6">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-red-500 rounded-full"
                  animate={{
                    height: Math.max(4, audioLevel * 24 * (1 - Math.abs(i - 2) * 0.2)),
                  }}
                  transition={{ duration: 0.05 }}
                />
              ))}
            </div>

            {/* Duration */}
            <span className="text-sm font-mono text-red-500 min-w-[40px]">
              {formatDuration(duration)}
            </span>

            {/* Stop button */}
            <button
              onClick={stopRecording}
              className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
              aria-label="Stop recording"
            >
              <MicOff className="w-4 h-4" />
            </button>

            {/* Cancel button */}
            <button
              onClick={cancelRecording}
              className="p-1 rounded-full hover:bg-red-500/20 transition-colors"
              aria-label="Cancel recording"
            >
              <X className="w-4 h-4 text-red-500" />
            </button>
          </motion.div>
        )}

        {state === 'processing' && (
          <motion.div
            key="processing"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30"
          >
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            <span className="text-sm text-blue-500">Transcribing...</span>
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30"
          >
            <Volume2 className="w-5 h-5 text-red-500" />
            <span className="text-sm text-red-500">{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VoiceInput;
