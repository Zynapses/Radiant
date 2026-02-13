/**
 * AudioWorklet processor — captures raw PCM from microphone
 * and posts Int16 chunks to the main thread for WebSocket streaming.
 *
 * Registered as 'pcm-processor' via audioContext.audioWorklet.addModule().
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 4096; // ~256ms at 16kHz after downsampling
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const float32 = input[0]; // channel 0, Float32 [-1, 1]

    // Downsample from 48kHz (default AudioContext) to 16kHz
    // Factor = sampleRate / 16000
    const factor = Math.round(sampleRate / 16000);
    for (let i = 0; i < float32.length; i += factor) {
      // Convert float32 to int16
      const s = Math.max(-1, Math.min(1, float32[i]));
      this._buffer.push(s < 0 ? s * 0x8000 : s * 0x7FFF);
    }

    if (this._buffer.length >= this._bufferSize) {
      const int16 = new Int16Array(this._buffer.splice(0, this._bufferSize));
      this.port.postMessage({ pcm: int16.buffer }, [int16.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
