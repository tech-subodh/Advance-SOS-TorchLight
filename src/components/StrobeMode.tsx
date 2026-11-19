import React from 'react';
import { Zap, AlertTriangle, Activity, ChevronDown } from 'lucide-react';
import { Language, StrobePattern, UiTheme } from '../types';
import { translations } from '../utils/translations';
import { PowerButton } from './PowerButton';

interface StrobeModeProps {
  isActive: boolean;
  onToggle: () => void;
  frequency: number; // in Hz (1 to 25)
  onChangeFrequency: (freq: number) => void;
  pattern: StrobePattern;
  onChangePattern: (pattern: StrobePattern) => void;
  language: Language;
  flashTick: boolean;
  hapticEnabled?: boolean;
  uiTheme?: UiTheme;
}

const PATTERN_OPTIONS: StrobePattern[] = [
  'constant',
  'flicker',
  'pulse',
  'heartbeat',
];

const PatternWaveformGlyph: React.FC<{ pattern: StrobePattern }> = ({ pattern }) => {
  switch (pattern) {
    case 'constant':
      return (
        <svg width="36" height="14" viewBox="0 0 36 14" fill="none" aria-hidden="true">
          <path
            d="M1 11 H6 V3 H13 V11 H20 V3 H27 V11 H35"
            stroke="#fbbf24"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'flicker':
      return (
        <svg width="36" height="14" viewBox="0 0 36 14" fill="none" aria-hidden="true">
          <path
            d="M1 11 H4 V3 H7 V11 H9 V4 H11 V11 H17 V2 H21 V11 H24 V5 H26 V11 H30 V3 H33 V11 H35"
            stroke="#fbbf24"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'pulse':
      return (
        <svg width="36" height="14" viewBox="0 0 36 14" fill="none" aria-hidden="true">
          <path
            d="M1 11 H7 V2.5 H10 V11 H23 V2.5 H26 V11 H35"
            stroke="#fbbf24"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'heartbeat':
      return (
        <svg width="36" height="14" viewBox="0 0 36 14" fill="none" aria-hidden="true">
          <path
            d="M1 9 H7 L9.5 3 L12 11.5 L14.5 5.5 L17 9 H24 L26.5 3 L29 11.5 L31.5 5.5 L34 9 H35"
            stroke="#fbbf24"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};

export const StrobeMode: React.FC<StrobeModeProps> = ({
  isActive,
  onToggle,
  frequency,
  onChangeFrequency,
  pattern,
  onChangePattern,
  language,
  flashTick,
  hapticEnabled = true,
  uiTheme = 'standard',
}) => {
  const t = translations[language];
  const activePatternInfo = t.strobeMode.patterns[pattern];

  const presets = [
    { label: t.strobeMode.slow, hz: 2 },
    { label: t.strobeMode.medium, hz: 6 },
    { label: t.strobeMode.fast, hz: 12 },
    { label: t.strobeMode.ultra, hz: 20 },
  ];

  return (
    <div className="flex flex-col items-center justify-between w-full max-w-md mx-auto px-4 py-3 min-h-[calc(100vh-140px)] select-none">
      {/* Header Info */}
      <div className="text-center w-full">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full glass-pill border-amber-400/35 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-1">
          <Activity className="w-3.5 h-3.5" />
          {t.strobeMode.title}
        </div>
        <p className="text-xs text-neutral-300/80">{t.strobeMode.subtitle}</p>
      </div>

      {/* Main Switch Area with Dynamic Visual Strobe Indicator */}
      <div className="flex flex-col items-center my-auto relative">
        {/* Flashing Aura Indicator */}
        <div
          className={`absolute -inset-10 rounded-full transition-opacity pointer-events-none ${
            isActive && flashTick
              ? 'opacity-80 bg-white/30 blur-2xl'
              : 'opacity-0'
          }`}
        />

        <PowerButton
          isOn={isActive}
          onToggle={onToggle}
          label={isActive ? t.strobeMode.strobeActive : t.strobeMode.strobeStopped}
          size="large"
          accentColor={
            uiTheme === 'red-night'
              ? '#DC2626'
              : uiTheme === 'sepia-night'
                ? '#D97706'
                : '#F59E0B'
          }
          hapticEnabled={hapticEnabled}
        />

        {/* Live Frequency & Pattern Display */}
        <div className="mt-3 flex items-center gap-2 glass-pill px-4 py-1.5 rounded-full">
          <span
            className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"
            style={{ display: isActive ? 'inline-block' : 'none' }}
          />
          <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-white tracking-wide">
            {frequency}{' '}
            <span className="text-xs font-sans text-neutral-300 font-normal">
              Hz · {activePatternInfo.label}
            </span>
          </span>
        </div>
      </div>

      {/* Bottom Strobe Controls */}
      <div className="w-full glass-panel rounded-2xl p-4 space-y-4 mt-4">
        {/* Pulse Pattern Dropdown */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="strobe-pattern-select"
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-200"
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              {t.strobeMode.patternLabel}
            </label>
            <PatternWaveformGlyph pattern={pattern} />
          </div>

          <div className="relative">
            <select
              id="strobe-pattern-select"
              value={pattern}
              onChange={(e) => onChangePattern(e.target.value as StrobePattern)}
              className="w-full min-h-[44px] appearance-none rounded-xl glass-input hover:border-amber-400/50 focus:border-amber-400 focus:outline-none px-3.5 pr-10 py-2.5 text-xs sm:text-sm font-semibold text-white cursor-pointer transition-colors"
            >
              {PATTERN_OPTIONS.map((opt) => (
                <option
                  key={opt}
                  value={opt}
                  className="bg-neutral-950 text-white"
                >
                  {t.strobeMode.patterns[opt].label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-4 h-4 text-amber-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
          </div>

          <p className="text-[11px] text-neutral-400 leading-snug">
            {activePatternInfo.desc}
          </p>
        </div>

        {/* Frequency Slider */}
        <div className="space-y-2 pt-1 border-t border-neutral-800/70">
          <div className="flex justify-between items-center text-xs font-medium text-neutral-300">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              {t.strobeMode.frequency}
            </span>
            <span className="font-mono tabular-nums text-amber-400 font-semibold">
              {frequency} Hz
            </span>
          </div>

          <input
            id="strobe-frequency-slider"
            type="range"
            min="1"
            max="25"
            step="1"
            value={frequency}
            onChange={(e) => onChangeFrequency(Number(e.target.value))}
            className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
          />

          <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
            <span>1 Hz (धीमा / Slow)</span>
            <span>12 Hz</span>
            <span>25 Hz (अल्ट्रा / Fast)</span>
          </div>
        </div>

        {/* Presets */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
            {t.strobeMode.presets}
          </span>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((preset) => (
              <button
                id={`strobe-preset-${preset.hz}`}
                key={preset.hz}
                type="button"
                onClick={() => onChangeFrequency(preset.hz)}
                className={`py-2 px-1 rounded-xl text-xs font-medium border transition-all text-center active:scale-95 ${
                  frequency === preset.hz
                    ? 'bg-amber-500/90 text-neutral-950 border-amber-300/75 font-bold shadow-[0_4px_14px_rgba(245,158,11,0.3),inset_0_1px_0_rgba(255,255,255,0.4)]'
                    : 'glass-surface text-neutral-200 hover:text-white'
                }`}
              >
                <div>{preset.label}</div>
                <div className="text-[10px] opacity-75 font-mono">{preset.hz} Hz</div>
              </button>
            ))}
          </div>
        </div>

        {/* Photosensitive warning note */}
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-[11px] leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{t.strobeMode.warning}</span>
        </div>
      </div>
    </div>
  );
};
