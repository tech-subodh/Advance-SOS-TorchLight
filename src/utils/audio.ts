/**
 * Synthesizer using Web Audio API for tactile feedback, Morse code beeps, and emergency sounds.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a solid mechanical flashlight switch click sound
 */
export function playSwitchClick(isOn: boolean): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const now = ctx.currentTime;

    if (isOn) {
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else {
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.035);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    }
  } catch {
    // Ignore audio failures
  }
}

export type SystemAudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record';

interface NavigatorWithAudioSession extends Navigator {
  audioSession?: {
    type: SystemAudioSessionType;
    state?: string;
  };
}

interface NativeVolumeBridge {
  getNotificationVolume?: () => number;
  getSystemVolume?: () => number;
}

let activeMorseOsc: OscillatorNode | null = null;
let activeMorseGain: GainNode | null = null;
let morseCompressor: DynamicsCompressorNode | null = null;

function getMorseCompressor(ctx: AudioContext): DynamicsCompressorNode {
  if (!morseCompressor || morseCompressor.context !== ctx) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-10, ctx.currentTime);
    comp.knee.setValueAtTime(12, ctx.currentTime);
    comp.ratio.setValueAtTime(6, ctx.currentTime);
    comp.attack.setValueAtTime(0.003, ctx.currentTime);
    comp.release.setValueAtTime(0.08, ctx.currentTime);
    comp.connect(ctx.destination);
    morseCompressor = comp;
  }
  return morseCompressor;
}

/**
 * Checks whether the browser supports the Web Audio Session API (which routes
 * Web Audio through the OS notification/ringer volume channel via 'ambient' / 'transient').
 */
export function isAudioSessionSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as NavigatorWithAudioSession;
  return Boolean(nav.audioSession && typeof nav.audioSession === 'object');
}

/**
 * Synchronize the browser audio session channel with the OS notification/alert volume.
 * - syncWithSystem = true -> 'ambient' (follows hardware notification/ringer volume & silent switch)
 * - syncWithSystem = false -> 'playback' (independent app-controlled playback volume)
 */
export function applySystemNotificationAudioSession(syncWithSystem: boolean): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as NavigatorWithAudioSession;
  if (!nav.audioSession) return false;
  try {
    nav.audioSession.type = syncWithSystem ? 'ambient' : 'playback';
    return true;
  } catch {
    try {
      nav.audioSession.type = syncWithSystem ? 'transient' : 'playback';
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Reads the device notification volume if exposed by an embedded WebView/OS bridge,
 * otherwise returns null so the browser's hardware volume + calibrated gain applies.
 */
export function readNativeNotificationVolume(): number | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    Android?: NativeVolumeBridge;
    webkit?: { messageHandlers?: unknown };
  };
  try {
    const raw = w.Android?.getNotificationVolume?.() ?? w.Android?.getSystemVolume?.();
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const normalized = raw > 1 ? raw / 100 : raw;
      return Math.min(1, Math.max(0, Number(normalized.toFixed(2))));
    }
  } catch {
    // ignore bridge read errors
  }
  return null;
}

/**
 * Listens for hardware/system volume key events (AudioVolumeUp, AudioVolumeDown, AudioVolumeMute)
 * and native volume-change events to keep the SOS Morse volume synchronized in real time.
 */
export function subscribeSystemVolumeChanges(callbacks: {
  onVolumeDelta: (delta: number) => void;
  onMuteToggle: () => void;
  onExactVolume?: (volume: number) => void;
}): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'AudioVolumeUp' || e.code === 'AudioVolumeUp') {
      callbacks.onVolumeDelta(0.08);
    } else if (e.key === 'AudioVolumeDown' || e.code === 'AudioVolumeDown') {
      callbacks.onVolumeDelta(-0.08);
    } else if (e.key === 'AudioVolumeMute' || e.code === 'AudioVolumeMute') {
      callbacks.onMuteToggle();
    }
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      const nativeVol = readNativeNotificationVolume();
      if (nativeVol !== null && callbacks.onExactVolume) {
        callbacks.onExactVolume(nativeVol);
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

/**
 * Immediately silences any currently playing SOS Morse tone (e.g. when user taps Mute mid-dash).
 */
export function stopActiveMorseTone(): void {
  try {
    const ctx = audioCtx;
    if (activeMorseGain && ctx) {
      const now = ctx.currentTime;
      activeMorseGain.gain.cancelScheduledValues(now);
      activeMorseGain.gain.setValueAtTime(Math.max(0.0001, activeMorseGain.gain.value), now);
      activeMorseGain.gain.linearRampToValueAtTime(0.0001, now + 0.012);
    }
    if (activeMorseOsc) {
      const oscToStop = activeMorseOsc;
      activeMorseOsc = null;
      activeMorseGain = null;
      setTimeout(() => {
        try {
          oscToStop.stop();
          oscToStop.disconnect();
        } catch {
          // already stopped
        }
      }, 18);
    }
  } catch {
    activeMorseOsc = null;
    activeMorseGain = null;
  }
}

export interface MorseToneOptions {
  /** Normalized output gain level from 0.0 (silent) to 1.0 (full notification volume). */
  volume?: number;
  /** Route audio through the OS notification/ambient audio session when supported. */
  syncSystemVolume?: boolean;
}

/**
 * Play a Morse code tone with volume synced to the system notification channel (or manual level).
 */
export function playMorseTone(
  durationMs: number,
  freq = 800,
  options: MorseToneOptions = {},
): void {
  try {
    const { volume = 0.85, syncSystemVolume = true } = options;
    const clampedVolume = Math.min(1, Math.max(0, volume));
    if (clampedVolume <= 0.001) return;

    applySystemNotificationAudioSession(syncSystemVolume);

    const ctx = getAudioContext();
    if (!ctx) return;

    // Ensure no stale tone overlaps
    stopActiveMorseTone();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const output = getMorseCompressor(ctx);

    const now = ctx.currentTime;
    const durSec = Math.max(0.04, durationMs / 1000);
    const fadeSec = Math.min(0.015, durSec / 4);

    // Perceptual exponential curve scaled to full system-referenced notification gain (up to 0.85)
    const targetGain = Math.max(0.001, Math.pow(clampedVolume, 1.35) * 0.85);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Smooth click-free envelope
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(targetGain, now + fadeSec);
    gain.gain.setValueAtTime(targetGain, now + durSec - fadeSec);
    gain.gain.linearRampToValueAtTime(0.0001, now + durSec);

    osc.connect(gain);
    gain.connect(output);

    activeMorseOsc = osc;
    activeMorseGain = gain;

    osc.onended = () => {
      if (activeMorseOsc === osc) {
        activeMorseOsc = null;
        activeMorseGain = null;
      }
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // ignore disconnect errors
      }
    };

    osc.start(now);
    osc.stop(now + durSec + 0.005);
  } catch {
    // Ignore
  }
}

/**
 * Siren generator that can be started and stopped
 */
class SirenController {
  private osc: OscillatorNode | null = null;
  private lfo: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private isPlaying = false;

  start(): void {
    if (this.isPlaying) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      this.osc = ctx.createOscillator();
      this.lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      this.gain = ctx.createGain();

      const now = ctx.currentTime;

      // High-frequency emergency rescue siren carrier (sweeps 1300Hz - 2400Hz)
      this.osc.type = 'sawtooth';
      this.osc.frequency.setValueAtTime(1850, now);

      // LFO for rapid high-frequency modulation (2.2 Hz urgent siren wail)
      this.lfo.type = 'sine';
      this.lfo.frequency.setValueAtTime(2.2, now);
      lfoGain.gain.setValueAtTime(550, now);

      this.lfo.connect(lfoGain);
      lfoGain.connect(this.osc.frequency);

      // Smooth fade-in to avoid harsh pop on toggle
      this.gain.gain.setValueAtTime(0.001, now);
      this.gain.gain.linearRampToValueAtTime(0.22, now + 0.04);

      this.osc.connect(this.gain);
      this.gain.connect(ctx.destination);

      this.lfo.start(now);
      this.osc.start(now);
      this.isPlaying = true;
    } catch {
      // Ignore
    }
  }

  stop(): void {
    if (!this.isPlaying) return;
    try {
      if (this.lfo) {
        this.lfo.stop();
        this.lfo.disconnect();
        this.lfo = null;
      }
      if (this.osc) {
        this.osc.stop();
        this.osc.disconnect();
        this.osc = null;
      }
      if (this.gain) {
        this.gain.disconnect();
        this.gain = null;
      }
    } catch {
      // Ignore
    }
    this.isPlaying = false;
  }

  active(): boolean {
    return this.isPlaying;
  }
}

export const emergencySiren = new SirenController();

/**
 * Play a high-pitch piercing rescue whistle blast
 */
export function playWhistle(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    const now = ctx.currentTime;
    const durSec = 0.55;

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(2600, now);
    osc1.frequency.linearRampToValueAtTime(2850, now + 0.3);
    osc1.frequency.linearRampToValueAtTime(2500, now + durSec);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(2650, now);
    osc2.frequency.linearRampToValueAtTime(2900, now + 0.3);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durSec);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durSec);
    osc2.stop(now + durSec);
  } catch {
    // Ignore
  }
}

export type LightHapticMode = 'torch' | 'strobe' | 'sos' | 'screen';

export type TorchHapticPatternId = 'subtle' | 'standard' | 'intense';

export const TORCH_HAPTIC_PATTERNS: Record<
  TorchHapticPatternId,
  { on: number[]; off: number[]; summary: string }
> = {
  subtle: {
    on: [14],
    off: [10],
    summary: '14ms',
  },
  standard: {
    on: [28, 35, 55],
    off: [22],
    summary: '28·55ms',
  },
  intense: {
    on: [65, 35, 95],
    off: [45, 25, 45],
    summary: '65·95ms',
  },
};

/**
 * Distinct tactile vibration patterns (in ms) so users can confirm light state
 * by feel alone in dark environments.
 */
export const HAPTIC_PATTERNS = {
  // Crisp double-tap confirms light switched ON
  torchOn: TORCH_HAPTIC_PATTERNS.standard.on,
  // Short single pulse confirms light switched OFF
  torchOff: TORCH_HAPTIC_PATTERNS.standard.off,
  // Rhythmic triple-tick confirms strobe started
  strobeOn: [20, 25, 20, 25, 42] as number[],
  strobeOff: [24] as number[],
  // Urgent short-short-long confirms SOS distress activated
  sosOn: [35, 35, 35, 35, 75] as number[],
  sosOff: [28] as number[],
  // Fullscreen screen lamp enter / exit
  screenOn: [24, 30, 45] as number[],
  screenOff: [20] as number[],
  // Gentle double-tap when auto-off timer turns off the light
  timerExpired: [30, 40, 30] as number[],
  // Subtle tap for UI controls / enabling haptics
  confirm: [18, 28, 32] as number[],
  tap: 15,
};

export function isHapticSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  );
}

/**
 * Trigger tactile vibration if device supports navigator.vibrate.
 * Returns true if the vibration request was dispatched.
 */
export function triggerHaptic(pattern: number | number[] = 30): boolean {
  try {
    if (isHapticSupported()) {
      navigator.vibrate(0);
      return navigator.vibrate(pattern);
    }
  } catch {
    // Ignore vibration permission/platform failures
  }
  return false;
}

/**
 * Play a sample pulse of the chosen Torch toggle haptic pattern.
 */
export function previewTorchHapticPattern(
  pattern: TorchHapticPatternId,
): boolean {
  const preset = TORCH_HAPTIC_PATTERNS[pattern] ?? TORCH_HAPTIC_PATTERNS.standard;
  return triggerHaptic(preset.on);
}

/**
 * Trigger a distinct brief haptic feedback pattern when toggling any light mode.
 */
export function triggerLightToggleHaptic(
  mode: LightHapticMode,
  isTurningOn: boolean,
  torchPattern: TorchHapticPatternId = 'standard',
): boolean {
  switch (mode) {
    case 'torch': {
      const preset =
        TORCH_HAPTIC_PATTERNS[torchPattern] ?? TORCH_HAPTIC_PATTERNS.standard;
      return triggerHaptic(isTurningOn ? preset.on : preset.off);
    }
    case 'strobe':
      return triggerHaptic(
        isTurningOn ? HAPTIC_PATTERNS.strobeOn : HAPTIC_PATTERNS.strobeOff,
      );
    case 'sos':
      return triggerHaptic(
        isTurningOn ? HAPTIC_PATTERNS.sosOn : HAPTIC_PATTERNS.sosOff,
      );
    case 'screen':
      return triggerHaptic(
        isTurningOn ? HAPTIC_PATTERNS.screenOn : HAPTIC_PATTERNS.screenOff,
      );
  }
}

