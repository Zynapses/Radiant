/**
 * @radiant/delight-ui - Web Audio API Sound Synthesis
 *
 * Generates UI sound effects using the Web Audio API.
 * No mp3/wav files needed — all sounds are synthesized in real-time.
 * Each sound is personality-aware: professional gets minimal clicks,
 * playful gets musical chimes, etc.
 */

import type { PersonalityMode } from './types';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioContext;
}

type SoundType = 'success' | 'error' | 'milestone' | 'subtle' | 'morph';

interface SoundProfile {
  frequencies: number[];
  durations: number[];
  gains: number[];
  type: OscillatorType;
  /** Delay between notes in seconds */
  noteGap: number;
}

const SOUND_PROFILES: Record<PersonalityMode, Record<SoundType, SoundProfile>> = {
  professional: {
    success: {
      frequencies: [880],
      durations: [0.08],
      gains: [0.08],
      type: 'sine',
      noteGap: 0,
    },
    error: {
      frequencies: [220],
      durations: [0.12],
      gains: [0.06],
      type: 'sine',
      noteGap: 0,
    },
    milestone: {
      frequencies: [660, 880],
      durations: [0.08, 0.1],
      gains: [0.06, 0.08],
      type: 'sine',
      noteGap: 0.06,
    },
    subtle: {
      frequencies: [1200],
      durations: [0.04],
      gains: [0.04],
      type: 'sine',
      noteGap: 0,
    },
    morph: {
      frequencies: [440, 660],
      durations: [0.06, 0.08],
      gains: [0.05, 0.06],
      type: 'sine',
      noteGap: 0.04,
    },
  },
  subtle: {
    success: {
      frequencies: [800],
      durations: [0.06],
      gains: [0.05],
      type: 'sine',
      noteGap: 0,
    },
    error: {
      frequencies: [200],
      durations: [0.1],
      gains: [0.04],
      type: 'sine',
      noteGap: 0,
    },
    milestone: {
      frequencies: [600, 800],
      durations: [0.06, 0.08],
      gains: [0.04, 0.05],
      type: 'sine',
      noteGap: 0.05,
    },
    subtle: {
      frequencies: [1000],
      durations: [0.03],
      gains: [0.03],
      type: 'sine',
      noteGap: 0,
    },
    morph: {
      frequencies: [500],
      durations: [0.06],
      gains: [0.04],
      type: 'sine',
      noteGap: 0,
    },
  },
  expressive: {
    success: {
      frequencies: [523, 659, 784],
      durations: [0.1, 0.1, 0.15],
      gains: [0.1, 0.12, 0.14],
      type: 'sine',
      noteGap: 0.08,
    },
    error: {
      frequencies: [330, 262],
      durations: [0.15, 0.2],
      gains: [0.08, 0.06],
      type: 'triangle',
      noteGap: 0.1,
    },
    milestone: {
      frequencies: [523, 659, 784, 1047],
      durations: [0.1, 0.1, 0.12, 0.2],
      gains: [0.1, 0.12, 0.14, 0.16],
      type: 'sine',
      noteGap: 0.08,
    },
    subtle: {
      frequencies: [880, 1047],
      durations: [0.06, 0.08],
      gains: [0.06, 0.07],
      type: 'sine',
      noteGap: 0.05,
    },
    morph: {
      frequencies: [392, 523, 659],
      durations: [0.08, 0.08, 0.12],
      gains: [0.08, 0.1, 0.12],
      type: 'sine',
      noteGap: 0.06,
    },
  },
  playful: {
    success: {
      frequencies: [523, 659, 784, 1047, 1319],
      durations: [0.08, 0.08, 0.08, 0.1, 0.2],
      gains: [0.1, 0.12, 0.14, 0.16, 0.14],
      type: 'sine',
      noteGap: 0.06,
    },
    error: {
      frequencies: [440, 415, 392],
      durations: [0.1, 0.12, 0.25],
      gains: [0.1, 0.08, 0.06],
      type: 'triangle',
      noteGap: 0.08,
    },
    milestone: {
      frequencies: [523, 659, 784, 1047, 1319, 1568],
      durations: [0.06, 0.06, 0.06, 0.08, 0.1, 0.25],
      gains: [0.1, 0.12, 0.14, 0.16, 0.16, 0.14],
      type: 'sine',
      noteGap: 0.05,
    },
    subtle: {
      frequencies: [1047, 1319],
      durations: [0.05, 0.08],
      gains: [0.08, 0.1],
      type: 'sine',
      noteGap: 0.04,
    },
    morph: {
      frequencies: [262, 330, 392, 523],
      durations: [0.06, 0.06, 0.06, 0.12],
      gains: [0.08, 0.1, 0.12, 0.14],
      type: 'sine',
      noteGap: 0.05,
    },
  },
  auto: {
    success: {
      frequencies: [523, 659, 784],
      durations: [0.1, 0.1, 0.15],
      gains: [0.1, 0.12, 0.14],
      type: 'sine',
      noteGap: 0.08,
    },
    error: {
      frequencies: [330, 262],
      durations: [0.15, 0.2],
      gains: [0.08, 0.06],
      type: 'triangle',
      noteGap: 0.1,
    },
    milestone: {
      frequencies: [523, 659, 784, 1047],
      durations: [0.1, 0.1, 0.12, 0.2],
      gains: [0.1, 0.12, 0.14, 0.16],
      type: 'sine',
      noteGap: 0.08,
    },
    subtle: {
      frequencies: [880, 1047],
      durations: [0.06, 0.08],
      gains: [0.06, 0.07],
      type: 'sine',
      noteGap: 0.05,
    },
    morph: {
      frequencies: [392, 523, 659],
      durations: [0.08, 0.08, 0.12],
      gains: [0.08, 0.1, 0.12],
      type: 'sine',
      noteGap: 0.06,
    },
  },
};

/**
 * Play a synthesized sound effect based on personality mode.
 * Uses Web Audio API — no audio files required.
 */
export function playSynthSound(
  mode: PersonalityMode,
  type: SoundType,
  volume = 1.0,
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const profile = SOUND_PROFILES[mode]?.[type] ?? SOUND_PROFILES.auto[type];
  if (!profile) return;

  let startTime = ctx.currentTime;

  for (let i = 0; i < profile.frequencies.length; i++) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = profile.type;
    oscillator.frequency.setValueAtTime(profile.frequencies[i], startTime);

    const noteGain = (profile.gains[i] ?? 0.1) * volume;
    const noteDuration = profile.durations[i] ?? 0.1;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(noteGain, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + noteDuration + 0.01);

    startTime += noteDuration + profile.noteGap;
  }
}
