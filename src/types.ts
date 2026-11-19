export type AppMode = 'torch' | 'strobe' | 'sos' | 'screen' | 'scanner' | 'studio';

export type ScannerPatternType = 'qr' | 'barcode';

export type Language = 'hi' | 'en';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ColorPreset {
  id: string;
  nameHi: string;
  nameEn: string;
  hex: string;
  descriptionHi: string;
  descriptionEn: string;
  isStrobe?: boolean;
}

export type TorchIntensityConstraintKey =
  | 'torchStrength'
  | 'torchLevel'
  | 'torchBrightness'
  | 'torch';

export interface TorchIntensityCapability {
  supported: boolean;
  min: number;
  max: number;
  step: number;
  constraintKey: TorchIntensityConstraintKey | null;
}

export interface TorchCapabilities {
  supported: boolean;
  active: boolean;
  hasHardwareTorch: boolean;
  intensity: TorchIntensityCapability;
  error?: string | null;
}

export type TimerDuration = 0 | 60 | 300 | 600 | 900 | 1800; // in seconds, 0 = off

export type ShakeSensitivity = 'low' | 'medium' | 'high';

export type TorchHapticPattern = 'subtle' | 'standard' | 'intense';

export type ProximityTriggerReason = 'proximity' | 'facedown';

export type ProximitySensorMode =
  | 'hardware-proximity'
  | 'facedown-orientation'
  | 'unsupported';

export type SosPulseType = 'dot' | 'dash';

export interface SosPulseStep {
  id: string;
  type: SosPulseType;
  group?: string;
  gapUnits?: number;
}

export type SosPresetId =
  | 'standard-sos'
  | 'alpine-distress'
  | 'rapid-beacon'
  | 'double-pulse'
  | 'custom';

export interface SosSettings {
  presetId: SosPresetId;
  steps: SosPulseStep[];
  dotDurationMs: number;
  dashDurationMs: number;
  pulseGapMs: number;
  repeatPauseMs: number;
  customMessage?: string;
}

export interface TorchLightingPreset {
  id: string;
  name: string;
  intensity: number;
  isBuiltIn?: boolean;
}

export type StrobePattern = 'constant' | 'flicker' | 'pulse' | 'heartbeat';

export type AmbientLightCategory = 'dark' | 'dim' | 'bright';

export type UiTheme = 'standard' | 'red-night' | 'sepia-night';

export interface TorchUsageEntry {
  id: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  intensityPercent: number;
}

export interface ScannerConfig {
  patternType: ScannerPatternType;
  payload: string;
  brightness: number;
  verticalBarcode: boolean;
  showHumanText: boolean;
}

export type WidgetLayoutVariant = 'compact-2x1' | 'controls-2x2' | 'dock-4x1';

export interface AppPreferences {
  language: Language;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  uiTheme: UiTheme;
  torchIntensity: number;
  activeTimer: TimerDuration;
  shakeSensitivity: ShakeSensitivity;
  proximityAutoOffEnabled: boolean;
  strobeFrequency: number;
  strobePattern: StrobePattern;
  screenColor: string;
  screenBrightness: number;
  widgetLayout: WidgetLayoutVariant;
  widgetAutoStart: boolean;
  sosToneMuted: boolean;
  sosSyncSystemVolume: boolean;
  sosToneVolume: number;
  torchHapticPattern: TorchHapticPattern;
}

export interface UsageHistoryState {
  accumulatedMs: number;
  entries: TorchUsageEntry[];
}

export interface BootstrapPayload {
  preferences: AppPreferences;
  lightingPresets: TorchLightingPreset[];
  sosSettings: SosSettings;
  usageHistory: UsageHistoryState;
  scanner: ScannerConfig;
  chatHistory: ChatMessage[];
}

