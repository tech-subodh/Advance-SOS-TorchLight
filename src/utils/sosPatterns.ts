import type { SosPresetId, SosPulseStep, SosPulseType, SosSettings } from '../types';

export const MAX_SOS_STEPS = 16;
export const MAX_MESSAGE_STEPS = 160;
export const MAX_MESSAGE_CHARS = 40;

export const SOS_LIMITS = {
  dot: { min: 80, max: 600, step: 20 },
  dash: { min: 200, max: 1500, step: 20 },
  gap: { min: 80, max: 800, step: 20 },
  repeat: { min: 400, max: 4000, step: 100 },
} as const;

let stepCounter = 0;
export function createSosStep(
  type: SosPulseType,
  group?: string,
  gapUnits?: number,
): SosPulseStep {
  stepCounter += 1;
  return {
    id: `sos-step-${Date.now()}-${stepCounter}`,
    type,
    ...(group ? { group } : {}),
    ...(gapUnits ? { gapUnits } : {}),
  };
}

export const SOS_PRESETS: Record<Exclude<SosPresetId, 'custom'>, SosSettings> = {
  'standard-sos': {
    presetId: 'standard-sos',
    steps: [
      { id: 'std-0', type: 'dot', group: 'S' },
      { id: 'std-1', type: 'dot', group: 'S' },
      { id: 'std-2', type: 'dot', group: 'S', gapUnits: 3 },
      { id: 'std-3', type: 'dash', group: 'O' },
      { id: 'std-4', type: 'dash', group: 'O' },
      { id: 'std-5', type: 'dash', group: 'O', gapUnits: 3 },
      { id: 'std-6', type: 'dot', group: 'S' },
      { id: 'std-7', type: 'dot', group: 'S' },
      { id: 'std-8', type: 'dot', group: 'S' },
    ],
    dotDurationMs: 180,
    dashDurationMs: 540,
    pulseGapMs: 180,
    repeatPauseMs: 1260,
  },
  'alpine-distress': {
    presetId: 'alpine-distress',
    steps: [
      { id: 'alp-0', type: 'dot' },
      { id: 'alp-1', type: 'dot' },
      { id: 'alp-2', type: 'dot' },
      { id: 'alp-3', type: 'dot' },
      { id: 'alp-4', type: 'dot' },
      { id: 'alp-5', type: 'dot' },
    ],
    dotDurationMs: 260,
    dashDurationMs: 780,
    pulseGapMs: 360,
    repeatPauseMs: 2400,
  },
  'rapid-beacon': {
    presetId: 'rapid-beacon',
    steps: [
      { id: 'rap-0', type: 'dot' },
      { id: 'rap-1', type: 'dash' },
      { id: 'rap-2', type: 'dot' },
      { id: 'rap-3', type: 'dash' },
    ],
    dotDurationMs: 120,
    dashDurationMs: 360,
    pulseGapMs: 140,
    repeatPauseMs: 700,
  },
  'double-pulse': {
    presetId: 'double-pulse',
    steps: [
      { id: 'dbl-0', type: 'dot' },
      { id: 'dbl-1', type: 'dot' },
    ],
    dotDurationMs: 140,
    dashDurationMs: 420,
    pulseGapMs: 140,
    repeatPauseMs: 1000,
  },
};

export const DEFAULT_SOS_SETTINGS: SosSettings = cloneSosSettings(
  SOS_PRESETS['standard-sos'],
);

export function cloneSosSettings(settings: SosSettings): SosSettings {
  return {
    ...settings,
    steps: settings.steps.map((s) => ({ ...s })),
  };
}

export function clampSosSettings(candidate: Partial<SosSettings> | null): SosSettings {
  if (!candidate || !Array.isArray(candidate.steps) || candidate.steps.length === 0) {
    return cloneSosSettings(DEFAULT_SOS_SETTINGS);
  }

  const validSteps: SosPulseStep[] = candidate.steps
    .slice(0, MAX_MESSAGE_STEPS)
    .filter((s): s is SosPulseStep => s && (s.type === 'dot' || s.type === 'dash'))
    .map((s, idx) => ({
      id: typeof s.id === 'string' && s.id ? s.id : `restored-${idx}`,
      type: s.type,
      ...(typeof s.group === 'string' ? { group: s.group } : {}),
      ...(typeof s.gapUnits === 'number' && s.gapUnits >= 1 && s.gapUnits <= 7
        ? { gapUnits: s.gapUnits }
        : {}),
    }));

  if (validSteps.length === 0) {
    return cloneSosSettings(DEFAULT_SOS_SETTINGS);
  }

  const clampNum = (val: unknown, min: number, max: number, fallback: number) => {
    if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
    return Math.min(max, Math.max(min, Math.round(val)));
  };

  const presetId: SosPresetId =
    candidate.presetId === 'standard-sos' ||
    candidate.presetId === 'alpine-distress' ||
    candidate.presetId === 'rapid-beacon' ||
    candidate.presetId === 'double-pulse' ||
    candidate.presetId === 'custom'
      ? candidate.presetId
      : 'custom';

  const customMessage =
    typeof candidate.customMessage === 'string' && candidate.customMessage.trim()
      ? candidate.customMessage.trim().slice(0, MAX_MESSAGE_CHARS)
      : undefined;

  return {
    presetId,
    steps: validSteps,
    dotDurationMs: clampNum(
      candidate.dotDurationMs,
      SOS_LIMITS.dot.min,
      SOS_LIMITS.dot.max,
      DEFAULT_SOS_SETTINGS.dotDurationMs,
    ),
    dashDurationMs: clampNum(
      candidate.dashDurationMs,
      SOS_LIMITS.dash.min,
      SOS_LIMITS.dash.max,
      DEFAULT_SOS_SETTINGS.dashDurationMs,
    ),
    pulseGapMs: clampNum(
      candidate.pulseGapMs,
      SOS_LIMITS.gap.min,
      SOS_LIMITS.gap.max,
      DEFAULT_SOS_SETTINGS.pulseGapMs,
    ),
    repeatPauseMs: clampNum(
      candidate.repeatPauseMs,
      SOS_LIMITS.repeat.min,
      SOS_LIMITS.repeat.max,
      DEFAULT_SOS_SETTINGS.repeatPauseMs,
    ),
    ...(customMessage ? { customMessage } : {}),
  };
}

/**
 * Calculates total duration (ms) of one complete SOS blink cycle.
 */
export function calculateCycleDurationMs(settings: SosSettings): number {
  return settings.steps.reduce((total, step, index) => {
    const pulseMs =
      step.type === 'dash' ? settings.dashDurationMs : settings.dotDurationMs;
    const isLast = index === settings.steps.length - 1;
    const pauseMs = isLast
      ? settings.repeatPauseMs
      : settings.pulseGapMs * (step.gapUnits ?? 1);
    return total + pulseMs + pauseMs;
  }, 0);
}

const MORSE_TABLE: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  '!': '-.-.--',
  '-': '-....-',
  '/': '-..-.',
  ':': '---...',
  '@': '.--.-.',
};

export interface MorsePreviewToken {
  char: string;
  code: string;
  isSpace: boolean;
  startIndex: number;
  endIndex: number;
}

export interface EncodedMorseMessage {
  normalizedText: string;
  steps: SosPulseStep[];
  tokens: MorsePreviewToken[];
  displayString: string;
}

/**
 * Translates an arbitrary multi-word message (up to MAX_MESSAGE_CHARS) into
 * International Morse Code steps with accurate 3-unit letter gaps and 7-unit word gaps.
 */
export function encodeMessageToSosSteps(rawText: string): EncodedMorseMessage {
  const normalizedText = rawText
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE_CHARS);

  const steps: SosPulseStep[] = [];
  const tokens: MorsePreviewToken[] = [];
  const displayParts: string[] = [];

  for (let i = 0; i < normalizedText.length; i += 1) {
    const ch = normalizedText[i];

    if (ch === ' ') {
      if (steps.length > 0) {
        steps[steps.length - 1] = {
          ...steps[steps.length - 1],
          gapUnits: 7,
        };
        tokens.push({
          char: ' ',
          code: '/',
          isSpace: true,
          startIndex: -1,
          endIndex: -1,
        });
        displayParts.push('/');
      }
      continue;
    }

    const code = MORSE_TABLE[ch];
    if (!code) continue;

    if (steps.length + code.length > MAX_MESSAGE_STEPS) {
      break;
    }

    const startIndex = steps.length;
    for (let j = 0; j < code.length; j += 1) {
      const isLastInChar = j === code.length - 1;
      steps.push(
        createSosStep(
          code[j] === '-' ? 'dash' : 'dot',
          ch,
          isLastInChar ? 3 : undefined,
        ),
      );
    }
    const endIndex = steps.length - 1;

    tokens.push({
      char: ch,
      code,
      isSpace: false,
      startIndex,
      endIndex,
    });
    displayParts.push(code.replace(/\./g, '•').replace(/-/g, '—'));
  }

  // Clear trailing letter gap on the final pulse (repeatPauseMs handles end-of-cycle pause)
  if (steps.length > 0 && steps[steps.length - 1].gapUnits) {
    const last = { ...steps[steps.length - 1] };
    delete last.gapUnits;
    steps[steps.length - 1] = last;
  }

  return {
    normalizedText,
    steps,
    tokens,
    displayString: displayParts.join(' '),
  };
}

/**
 * Compact encoder used by the Advanced SOS panel's short sequence builder (capped at MAX_SOS_STEPS).
 */
export function encodeTextToSosSteps(text: string): SosPulseStep[] {
  const encoded = encodeMessageToSosSteps(text);
  return encoded.steps.slice(0, MAX_SOS_STEPS);
}
