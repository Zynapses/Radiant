'use client';

/**
 * Voice Input Component
 * 
 * Uses the app's localization settings for speech recognition language.
 * Falls back to Whisper API for browsers without native speech support.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Loader2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import {
  createAudioRecorder,
  transcribeWithWhisper,
  getLanguageName,
} from '@/lib/services/speech-recognition';

interface VoiceInputProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscript: (text: string) => void;
}

type RecordingState = 'idle' | 'listening' | 'processing' | 'error';


export function VoiceInput({ isOpen, onClose, onTranscript }: VoiceInputProps) {
  // Use app's localization language setting
  const { language: appLanguage } = useLanguage();
  
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(appLanguage);
  
  const recorderRef = useRef<ReturnType<typeof createAudioRecorder> | null>(null);
  
  // Sync with app language when it changes
  useEffect(() => {
    setSelectedLanguage(appLanguage);
  }, [appLanguage]);

  const stopListening = useCallback(async () => {
    if (!recorderRef.current) return;
    
    setRecordingState('processing');
    try {
      const audioBlob = await recorderRef.current.stop();
      const result = await transcribeWithWhisper(audioBlob, selectedLanguage);
      setTranscript(result.transcript);
      setRecordingState('idle');
    } catch (error) {
      console.error('Whisper transcription failed:', error);
      setErrorMessage('Transcription failed. Please try again.');
      setRecordingState('error');
    }
  }, [selectedLanguage]);

  const startListening = useCallback(async () => {
    setTranscript('');
    setErrorMessage('');
    
    try {
      // Always use Whisper API - records audio locally, transcribes on server
      // This provides consistent cross-browser behavior and better accuracy
      const recorder = createAudioRecorder(setAudioLevel);
      recorderRef.current = recorder;
      await recorder.start();
      setRecordingState('listening');
    } catch (error) {
      console.error('Failed to start voice input:', error);
      setErrorMessage('Failed to access microphone. Please check permissions.');
      setRecordingState('error');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startListening();
    } else {
      stopListening();
      setTranscript('');
      setErrorMessage('');
    }
    
    return () => {
      stopListening();
    };
  }, [isOpen, startListening, stopListening]);

  const handleSubmit = () => {
    if (transcript.trim()) {
      onTranscript(transcript.trim());
      onClose();
    }
  };

  const handleCancel = () => {
    stopListening();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
        onClick={handleCancel}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative"
          onClick={(e) => e.stopPropagation()}
        >
          <GlassPanel blur="lg" className="p-8 rounded-2xl text-center min-w-[320px]">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCancel}
              className="absolute top-3 right-3 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Microphone Visualization */}
            <div className="relative mx-auto w-24 h-24 mb-6">
              {/* Pulse rings */}
              {recordingState === 'listening' && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full bg-violet-500/20"
                    animate={{ scale: [1, 1.3 + audioLevel * 0.5], opacity: [0.5, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full bg-violet-500/20"
                    animate={{ scale: [1, 1.5 + audioLevel * 0.5], opacity: [0.3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </>
              )}
              
              {/* Main circle */}
              <motion.div
                className={cn(
                  'absolute inset-0 rounded-full flex items-center justify-center',
                  recordingState === 'listening' 
                    ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500' 
                    : recordingState === 'error'
                    ? 'bg-red-500/50'
                    : 'bg-slate-700'
                )}
                animate={recordingState === 'listening' ? {
                  scale: [1, 1 + audioLevel * 0.1],
                } : {}}
                transition={{ duration: 0.1 }}
              >
                {recordingState === 'processing' ? (
                  <Loader2 className="h-10 w-10 text-white animate-spin" />
                ) : recordingState === 'error' ? (
                  <MicOff className="h-10 w-10 text-white" />
                ) : (
                  <Mic className="h-10 w-10 text-white" />
                )}
              </motion.div>
            </div>

            {/* Status Text */}
            <h3 className="text-lg font-medium text-white mb-2">
              {recordingState === 'listening' && 'Listening...'}
              {recordingState === 'processing' && 'Processing...'}
              {recordingState === 'error' && 'Error'}
              {recordingState === 'idle' && 'Starting...'}
            </h3>
            
            {/* Selected Language */}
            {selectedLanguage && recordingState === 'listening' && (
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <Globe className="h-3 w-3 text-violet-400" />
                <span className="text-xs text-slate-400">
                  {getLanguageName(selectedLanguage)}
                </span>
              </div>
            )}
            
            {/* Transcript */}
            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/[0.05] rounded-lg p-3 mb-4 max-h-32 overflow-y-auto"
              >
                <p className="text-sm text-slate-300">{transcript}</p>
              </motion.div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <p className="text-sm text-red-400 mb-4">{errorMessage}</p>
            )}

            {/* Actions */}
            <div className="flex justify-center gap-3 mt-4">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              {transcript && (
                <Button 
                  onClick={handleSubmit}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  Use Text
                </Button>
              )}
            </div>

            {/* Hint */}
            <p className="text-xs text-slate-500 mt-4">
              {getLanguageName(selectedLanguage)} • Powered by Whisper AI
            </p>
          </GlassPanel>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}
