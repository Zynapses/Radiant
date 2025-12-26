/**
 * Audio/Speech Providers - RADIANT v4.18.0
 * OpenAI TTS/Whisper, ElevenLabs, Deepgram, AssemblyAI
 */

import { ExternalProvider, ExternalModel } from './index';

const MARKUP = 1.40;

// ============================================================================
// OPENAI AUDIO MODELS
// ============================================================================

const OPENAI_AUDIO_MODELS: ExternalModel[] = [
  {
    id: 'openai-tts-1',
    modelId: 'tts-1',
    litellmId: 'tts-1',
    name: 'tts-1',
    displayName: 'OpenAI TTS',
    description: 'Fast text-to-speech',
    category: 'text_to_speech',
    capabilities: ['text_to_speech', 'multiple_voices'],
    inputModalities: ['text'],
    outputModalities: ['audio'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.015,
      markup: MARKUP,
      billedInputPer1k: 0.015 * MARKUP,
    },
  },
  {
    id: 'openai-tts-1-hd',
    modelId: 'tts-1-hd',
    litellmId: 'tts-1-hd',
    name: 'tts-1-hd',
    displayName: 'OpenAI TTS HD',
    description: 'High-quality text-to-speech',
    category: 'text_to_speech',
    capabilities: ['text_to_speech', 'multiple_voices', 'hd'],
    inputModalities: ['text'],
    outputModalities: ['audio'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.030,
      markup: MARKUP,
      billedInputPer1k: 0.030 * MARKUP,
    },
  },
  {
    id: 'openai-whisper-1',
    modelId: 'whisper-1',
    litellmId: 'whisper-1',
    name: 'whisper-1',
    displayName: 'OpenAI Whisper',
    description: 'Speech-to-text transcription',
    category: 'speech_to_text',
    capabilities: ['speech_to_text', 'translation', 'timestamps'],
    inputModalities: ['audio'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_minute',
      costPerMinute: 0.006,
      markup: MARKUP,
    },
  },
];

const OPENAI_AUDIO_PROVIDER: ExternalProvider = {
  id: 'openai-audio',
  name: 'openai-audio',
  displayName: 'OpenAI Audio',
  category: 'audio_generation',
  description: 'OpenAI TTS and Whisper',
  website: 'https://openai.com',
  apiBaseUrl: 'https://api.openai.com/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/openai',
  enabled: true,
  regions: ['us'],
  models: OPENAI_AUDIO_MODELS,
  rateLimit: { requestsPerMinute: 50 },
  features: ['text_to_speech', 'speech_to_text', 'translation'],
  compliance: ['SOC2', 'GDPR'],
};

// ============================================================================
// ELEVENLABS MODELS
// ============================================================================

const ELEVENLABS_MODELS: ExternalModel[] = [
  {
    id: 'elevenlabs-multilingual-v2',
    modelId: 'eleven_multilingual_v2',
    litellmId: 'elevenlabs/eleven_multilingual_v2',
    name: 'multilingual-v2',
    displayName: 'ElevenLabs Multilingual V2',
    description: 'High-quality multilingual voice synthesis',
    category: 'text_to_speech',
    capabilities: ['text_to_speech', 'multilingual', 'voice_cloning'],
    inputModalities: ['text'],
    outputModalities: ['audio'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.30,
      markup: MARKUP,
      billedInputPer1k: 0.30 * MARKUP,
    },
  },
  {
    id: 'elevenlabs-turbo-v2-5',
    modelId: 'eleven_turbo_v2_5',
    litellmId: 'elevenlabs/eleven_turbo_v2_5',
    name: 'turbo-v2.5',
    displayName: 'ElevenLabs Turbo V2.5',
    description: 'Low-latency voice synthesis',
    category: 'text_to_speech',
    capabilities: ['text_to_speech', 'low_latency', 'streaming'],
    inputModalities: ['text'],
    outputModalities: ['audio'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.18,
      markup: MARKUP,
      billedInputPer1k: 0.18 * MARKUP,
    },
  },
];

const ELEVENLABS_PROVIDER: ExternalProvider = {
  id: 'elevenlabs',
  name: 'elevenlabs',
  displayName: 'ElevenLabs',
  category: 'text_to_speech',
  description: 'ElevenLabs voice AI',
  website: 'https://elevenlabs.io',
  apiBaseUrl: 'https://api.elevenlabs.io/v1',
  authType: 'api_key',
  secretName: 'radiant/providers/elevenlabs',
  enabled: true,
  regions: ['us', 'eu'],
  models: ELEVENLABS_MODELS,
  rateLimit: { requestsPerMinute: 100 },
  features: ['text_to_speech', 'voice_cloning', 'multilingual', 'streaming'],
};

// ============================================================================
// DEEPGRAM MODELS
// ============================================================================

const DEEPGRAM_MODELS: ExternalModel[] = [
  {
    id: 'deepgram-nova-2',
    modelId: 'nova-2',
    litellmId: 'deepgram/nova-2',
    name: 'nova-2',
    displayName: 'Deepgram Nova-2',
    description: 'Most accurate speech recognition',
    category: 'speech_to_text',
    capabilities: ['speech_to_text', 'diarization', 'punctuation', 'streaming'],
    inputModalities: ['audio'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_minute',
      costPerMinute: 0.0043,
      markup: MARKUP,
    },
  },
];

const DEEPGRAM_PROVIDER: ExternalProvider = {
  id: 'deepgram',
  name: 'deepgram',
  displayName: 'Deepgram',
  category: 'speech_to_text',
  description: 'Deepgram speech recognition',
  website: 'https://deepgram.com',
  apiBaseUrl: 'https://api.deepgram.com/v1',
  authType: 'api_key',
  secretName: 'radiant/providers/deepgram',
  enabled: true,
  regions: ['us', 'eu'],
  models: DEEPGRAM_MODELS,
  rateLimit: { requestsPerMinute: 1000 },
  features: ['speech_to_text', 'streaming', 'diarization', 'real_time'],
  compliance: ['SOC2', 'HIPAA'],
};

// ============================================================================
// ASSEMBLYAI MODELS
// ============================================================================

const ASSEMBLYAI_MODELS: ExternalModel[] = [
  {
    id: 'assemblyai-best',
    modelId: 'best',
    litellmId: 'assemblyai/best',
    name: 'best',
    displayName: 'AssemblyAI Best',
    description: 'Highest accuracy transcription',
    category: 'speech_to_text',
    capabilities: ['speech_to_text', 'diarization', 'sentiment', 'summarization'],
    inputModalities: ['audio'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_minute',
      costPerMinute: 0.0062,
      markup: MARKUP,
    },
  },
];

const ASSEMBLYAI_PROVIDER: ExternalProvider = {
  id: 'assemblyai',
  name: 'assemblyai',
  displayName: 'AssemblyAI',
  category: 'speech_to_text',
  description: 'AssemblyAI transcription and audio intelligence',
  website: 'https://assemblyai.com',
  apiBaseUrl: 'https://api.assemblyai.com/v2',
  authType: 'api_key',
  secretName: 'radiant/providers/assemblyai',
  enabled: true,
  regions: ['us'],
  models: ASSEMBLYAI_MODELS,
  rateLimit: { requestsPerMinute: 100 },
  features: ['speech_to_text', 'diarization', 'sentiment', 'summarization'],
  compliance: ['SOC2', 'HIPAA'],
};

// ============================================================================
// EXPORTS
// ============================================================================

export const AUDIO_PROVIDERS: ExternalProvider[] = [
  OPENAI_AUDIO_PROVIDER,
  ELEVENLABS_PROVIDER,
  DEEPGRAM_PROVIDER,
  ASSEMBLYAI_PROVIDER,
];
