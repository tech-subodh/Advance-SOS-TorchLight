export const LIVE_INPUT_SAMPLE_RATE = 16000;
export const LIVE_OUTPUT_SAMPLE_RATE = 24000;

/**
 * Linearly resamples mono Float32 PCM audio to 16kHz if the browser's
 * AudioContext runs at a different hardware sample rate (e.g., 44.1kHz or 48kHz).
 */
export function downsampleTo16kHz(
  input: Float32Array,
  inputSampleRate: number,
): Float32Array {
  if (inputSampleRate === LIVE_INPUT_SAMPLE_RATE || input.length === 0) {
    return input;
  }

  const ratio = inputSampleRate / LIVE_INPUT_SAMPLE_RATE;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, input.length - 1);
    const weight = srcIndex - low;
    output[i] = input[low] * (1 - weight) + input[high] * weight;
  }

  return output;
}

/**
 * Encodes a mono Float32 PCM buffer into 16kHz 16-bit signed little-endian PCM
 * formatted as Base64 for the Gemini Live API.
 */
export function float32ToBase64Pcm16(
  input: Float32Array,
  inputSampleRate: number,
): string {
  const resampled = downsampleTo16kHz(input, inputSampleRate);
  const byteLength = resampled.length * 2;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);

  for (let i = 0; i < resampled.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, resampled[i]));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(i * 2, Math.round(int16), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

/**
 * Manually decodes raw 24kHz 16-bit signed little-endian PCM Base64 audio
 * from Gemini Live API into a Web Audio AudioBuffer (never uses decodeAudioData).
 */
export function decodeBase64Pcm24kToAudioBuffer(
  base64: string,
  audioCtx: AudioContext,
): AudioBuffer | null {
  if (!base64) return null;

  const binary = atob(base64);
  const byteLength = binary.length;
  const sampleCount = Math.floor(byteLength / 2);
  if (sampleCount === 0) return null;

  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const audioBuffer = audioCtx.createBuffer(
    1,
    sampleCount,
    LIVE_OUTPUT_SAMPLE_RATE,
  );
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < sampleCount; i += 1) {
    const int16 = view.getInt16(i * 2, true);
    channelData[i] = int16 / 32768;
  }

  return audioBuffer;
}

/**
 * Computes a normalized 0..1 RMS audio energy level for visual waveforms.
 */
export function computeRmsLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i];
    sumSquares += v * v;
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  return Math.min(1, rms * 4.2);
}
