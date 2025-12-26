// RADIANT v4.18.0 - Voice & Video Service
// Handles audio input/output integration for Think Tank platform

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { withRetry, isRetryableHttpStatus } from '../utils/retry';
import { logger } from '../logger';
import { getPoolClient } from '../db/centralized-pool';
const s3 = new S3Client({});
const AUDIO_BUCKET = process.env.AUDIO_BUCKET || process.env.MEDIA_BUCKET || 'radiant-media';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

export interface VoiceConfig {
  voiceId: string;
  speed: number;
  pitch: number;
  language: string;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  segments: TranscriptionSegment[];
  duration: number;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  confidence: number;
}

export interface SpeechGenerationRequest {
  text: string;
  voiceId: string;
  options?: {
    speed?: number;
    pitch?: number;
    format?: 'mp3' | 'wav' | 'ogg';
  };
}

export interface SpeechGenerationResult {
  audioUrl: string;
  duration: number;
  format: string;
  expiresAt: Date;
}

export class VoiceVideoService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    options: {
      language?: string;
      model?: string;
      timestamps?: boolean;
    } = {}
  ): Promise<TranscriptionResult> {
    const client = await getPoolClient();
    const model = options.model || 'whisper-1';
    const language = options.language || 'en';

    try {
      if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured for transcription');
      }

      const formData = new FormData();
      formData.append('file', new Blob([new Uint8Array(audioBuffer)]), 'audio.wav');
      formData.append('model', model);
      if (language) formData.append('language', language);
      if (options.timestamps) formData.append('response_format', 'verbose_json');

      const response = await withRetry(
        async () => {
          const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: formData,
          });

          if (!res.ok) {
            const errorText = await res.text();
            const error = new Error(`Transcription failed: ${res.status} - ${errorText}`);
            if (!isRetryableHttpStatus(res.status)) throw error;
            throw error;
          }
          return res;
        },
        { maxAttempts: 3, retryCondition: (e) => e instanceof Error && e.message.includes('5') }
      );

      const data = await response.json() as {
        text: string;
        language?: string;
        duration?: number;
        segments?: Array<{ start: number; end: number; text: string; confidence?: number }>;
      };

      const result: TranscriptionResult = {
        text: data.text,
        confidence: 0.95,
        language: data.language || language,
        segments: (data.segments || []).map(s => ({
          start: s.start,
          end: s.end,
          text: s.text,
          confidence: s.confidence || 0.95,
        })),
        duration: data.duration || 0,
      };

      await client.query(
        `INSERT INTO usage_events (tenant_id, event_type, model_id, metadata)
         VALUES ($1, 'voice_transcription', $2, $3)`,
        [
          this.tenantId,
          model,
          JSON.stringify({
            audioSize: audioBuffer.length,
            language,
            duration: result.duration,
            timestamp: new Date().toISOString(),
          }),
        ]
      );

      return result;
    } finally {
      client.release();
    }
  }

  async generateSpeech(
    request: SpeechGenerationRequest
  ): Promise<SpeechGenerationResult> {
    const client = await getPoolClient();
    const { text, voiceId, options = {} } = request;
    const format = options.format || 'mp3';

    try {
      let audioBuffer: Buffer;
      let provider = 'openai';

      if (ELEVENLABS_API_KEY && ['rachel', 'domi', 'bella', 'antoni', 'elli', 'josh', 'arnold', 'adam', 'sam'].includes(voiceId)) {
        provider = 'elevenlabs';
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Accept': `audio/${format}`,
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`ElevenLabs TTS failed: ${response.status}`);
        }

        audioBuffer = Buffer.from(await response.arrayBuffer());
      } else if (OPENAI_API_KEY) {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: text,
            voice: voiceId || 'alloy',
            response_format: format,
            speed: options.speed || 1.0,
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI TTS failed: ${response.status}`);
        }

        audioBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        throw new Error('No TTS API key configured');
      }

      const audioKey = `audio/${this.tenantId}/${Date.now()}.${format}`;
      await s3.send(new PutObjectCommand({
        Bucket: AUDIO_BUCKET,
        Key: audioKey,
        Body: audioBuffer,
        ContentType: `audio/${format}`,
      }));

      const signedUrl = await getSignedUrl(s3, new GetObjectCommand({
        Bucket: AUDIO_BUCKET,
        Key: audioKey,
      }), { expiresIn: 86400 });

      const estimatedDuration = Math.ceil(text.length / 15);

      await client.query(
        `INSERT INTO usage_events (tenant_id, event_type, model_id, metadata)
         VALUES ($1, 'voice_synthesis', $2, $3)`,
        [
          this.tenantId,
          `tts-${provider}-${voiceId}`,
          JSON.stringify({
            textLength: text.length,
            voiceId,
            format,
            provider,
            timestamp: new Date().toISOString(),
          }),
        ]
      );

      return {
        audioUrl: signedUrl,
        duration: estimatedDuration,
        format,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    } finally {
      client.release();
    }
  }

  async getAvailableVoices(): Promise<VoiceConfig[]> {
    // Return available TTS voices
    return [
      { voiceId: 'alloy', speed: 1.0, pitch: 1.0, language: 'en' },
      { voiceId: 'echo', speed: 1.0, pitch: 1.0, language: 'en' },
      { voiceId: 'fable', speed: 1.0, pitch: 1.0, language: 'en' },
      { voiceId: 'onyx', speed: 1.0, pitch: 0.9, language: 'en' },
      { voiceId: 'nova', speed: 1.0, pitch: 1.1, language: 'en' },
      { voiceId: 'shimmer', speed: 1.0, pitch: 1.0, language: 'en' },
    ];
  }

  async saveUserVoicePreference(
    userId: string,
    voiceConfig: VoiceConfig
  ): Promise<void> {
    const client = await getPoolClient();

    try {
      await client.query(
        `INSERT INTO user_preferences (user_id, tenant_id, preference_key, preference_value)
         VALUES ($1, $2, 'voice_config', $3)
         ON CONFLICT (user_id, preference_key) DO UPDATE SET
           preference_value = $3,
           updated_at = NOW()`,
        [userId, this.tenantId, JSON.stringify(voiceConfig)]
      );
    } finally {
      client.release();
    }
  }

  async getUserVoicePreference(userId: string): Promise<VoiceConfig | null> {
    const client = await getPoolClient();

    try {
      const result = await client.query(
        `SELECT preference_value FROM user_preferences
         WHERE user_id = $1 AND tenant_id = $2 AND preference_key = 'voice_config'`,
        [userId, this.tenantId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].preference_value as VoiceConfig;
    } finally {
      client.release();
    }
  }
}

export const createVoiceVideoService = (tenantId: string) =>
  new VoiceVideoService(tenantId);
