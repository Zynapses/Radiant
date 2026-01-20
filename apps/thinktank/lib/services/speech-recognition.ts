/**
 * Speech Recognition Service
 * 
 * Uses Whisper API for consistent speech-to-text across all browsers.
 * Records audio locally and sends to server for transcription.
 * 
 * Benefits over browser Web Speech API:
 * - Consistent behavior across all browsers
 * - Better accuracy and language detection
 * - Supports 99+ languages
 * - Works offline (audio recorded, transcribed when online)
 */

import { api } from '@/lib/api/client';
// Language codes from app's i18n system

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  detectedLanguage?: string;
}


/**
 * Map app language codes to speech recognition language codes
 * Different speech APIs may use different formats
 */
const LANGUAGE_MAP: Record<string, string> = {
  'en': 'en-US',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'pt': 'pt-BR',
  'it': 'it-IT',
  'nl': 'nl-NL',
  'pl': 'pl-PL',
  'ru': 'ru-RU',
  'tr': 'tr-TR',
  'ja': 'ja-JP',
  'ko': 'ko-KR',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'ar': 'ar-SA',
  'hi': 'hi-IN',
  'th': 'th-TH',
  'vi': 'vi-VN',
};

/**
 * Get the speech recognition language code from app language
 */
export function getSpeechLanguageCode(appLanguage: string): string {
  return LANGUAGE_MAP[appLanguage] || LANGUAGE_MAP['en'];
}

/**
 * Get human-readable language name
 */
export function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    'en': 'English',
    'en-US': 'English (US)',
    'es': 'Spanish',
    'es-ES': 'Spanish',
    'fr': 'French',
    'fr-FR': 'French',
    'de': 'German',
    'de-DE': 'German',
    'pt': 'Portuguese',
    'pt-BR': 'Portuguese',
    'it': 'Italian',
    'it-IT': 'Italian',
    'nl': 'Dutch',
    'nl-NL': 'Dutch',
    'pl': 'Polish',
    'pl-PL': 'Polish',
    'ru': 'Russian',
    'ru-RU': 'Russian',
    'tr': 'Turkish',
    'tr-TR': 'Turkish',
    'ja': 'Japanese',
    'ja-JP': 'Japanese',
    'ko': 'Korean',
    'ko-KR': 'Korean',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'ar': 'Arabic',
    'ar-SA': 'Arabic',
    'hi': 'Hindi',
    'hi-IN': 'Hindi',
    'th': 'Thai',
    'th-TH': 'Thai',
    'vi': 'Vietnamese',
    'vi-VN': 'Vietnamese',
  };
  return names[code] || code;
}

/**
 * Transcribe audio using Whisper API (server-side)
 * This provides consistent cross-browser support and better language detection
 */
export async function transcribeWithWhisper(
  audioBlob: Blob,
  language?: string
): Promise<SpeechRecognitionResult> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  
  if (language) {
    formData.append('language', language);
  }

  const response = await api.post<{
    text: string;
    language: string;
    confidence: number;
  }>('/api/thinktank/speech/transcribe', formData);

  return {
    transcript: response.text,
    confidence: response.confidence,
    isFinal: true,
    detectedLanguage: response.language,
  };
}

/**
 * Create an audio recorder for Whisper transcription
 */
export function createAudioRecorder(onAudioLevel?: (level: number) => void): {
  start: () => Promise<void>;
  stop: () => Promise<Blob>;
  abort: () => void;
} {
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let animationFrame: number | null = null;

  const updateLevel = () => {
    if (analyser && onAudioLevel) {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      onAudioLevel(average / 255);
    }
    animationFrame = requestAnimationFrame(updateLevel);
  };

  return {
    start: async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup audio level monitoring
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      updateLevel();

      // Setup recording
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
    },

    stop: async () => {
      return new Promise((resolve) => {
        if (!mediaRecorder) {
          resolve(new Blob([]));
          return;
        }

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
          resolve(audioBlob);
        };

        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        
        if (animationFrame) cancelAnimationFrame(animationFrame);
        if (audioContext) audioContext.close();
      });
    },

    abort: () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (audioContext) audioContext.close();
    },
  };
}

