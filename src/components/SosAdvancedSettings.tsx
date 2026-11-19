import React, { useState } from 'react';
import {
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Language, SosPresetId, SosPulseType, SosSettings } from '../types';
import { translations } from '../utils/translations';
import { HAPTIC_PATTERNS, triggerHaptic } from '../utils/audio';
import {
  DEFAULT_SOS_SETTINGS,
  MAX_SOS_STEPS,
  SOS_LIMITS,
  SOS_PRESETS,
  calculateCycleDurationMs,
  cloneSosSettings,
  createSosStep,
  encodeTextToSosSteps,
} from '../utils/sosPatterns';

interface SosAdvancedSettingsProps {
  settings: SosSettings;
  onChangeSettings: (next: SosSettings) => void;
  language: Language;
  hapticEnabled?: boolean;
  isActive: boolean;
  currentStepIndex: number;
  isEmitting: boolean;
}

const PRESET_LIST: Array<{
  id: Exclude<SosPresetId, 'custom'>;
  glyph: string;
}> = [
  { id: 'standard-sos', glyph: '• • • — — — • • •' },
  { id: 'alpine-distress', glyph: '• • • • • •' },
  { id: 'rapid-beacon', glyph: '• — • —' },
  { id: 'double-pulse', glyph: '• •' },
];

export const SosAdvancedSettings: React.FC<SosAdvancedSettingsProps> = ({
  settings,
  onChangeSettings,
  language,
  hapticEnabled = true,
  isActive,
  currentStepIndex,
  isEmitting,
}) => {
  const t = translations[language].sosMode;
  const prefersReducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [morseInput, setMorseInput] = useState<string>('');

  const cycleSeconds = (calculateCycleDurationMs(settings) / 1000).toFixed(1);
  const activePresetLabel = t.presets[settings.presetId];

  const handleSelectPreset = (presetId: Exclude<SosPresetId, 'custom'>) => {
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    onChangeSettings(cloneSosSettings(SOS_PRESETS[presetId]));
  };

  const handleToggleStepType = (index: number) => {
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    const nextSteps = settings.steps.map((step, idx) =>
      idx === index
        ? {
            ...step,
            type: (step.type === 'dot' ? 'dash' : 'dot') as SosPulseType,
            group: undefined,
          }
        : step,
    );
    onChangeSettings({
      ...settings,
      presetId: 'custom',
      customMessage: undefined,
      steps: nextSteps,
    });
  };

  const handleAppendStep = (type: SosPulseType) => {
    if (settings.steps.length >= MAX_SOS_STEPS) return;
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    onChangeSettings({
      ...settings,
      presetId: 'custom',
      customMessage: undefined,
      steps: [...settings.steps, createSosStep(type)],
    });
  };

  const handleRemoveLast = () => {
    if (settings.steps.length <= 1) return;
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    onChangeSettings({
      ...settings,
      presetId: 'custom',
      customMessage: undefined,
      steps: settings.steps.slice(0, -1),
    });
  };

  const handleReset = () => {
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
    setMorseInput('');
    onChangeSettings(cloneSosSettings(DEFAULT_SOS_SETTINGS));
  };

  const handleApplyMorseText = (e: React.FormEvent) => {
    e.preventDefault();
    const encoded = encodeTextToSosSteps(morseInput);
    if (encoded.length === 0) return;
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
    onChangeSettings({
      ...settings,
      presetId: 'custom',
      steps: encoded,
    });
  };

  const handleDurationChange = (
    field: 'dotDurationMs' | 'dashDurationMs' | 'pulseGapMs' | 'repeatPauseMs',
    value: number,
  ) => {
    onChangeSettings({
      ...settings,
      presetId: 'custom',
      [field]: value,
    });
  };

  const formatMs = (ms: number): string =>
    ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;

  return (
    <div
      id="sos-advanced-settings-card"
      className="w-full glass-panel rounded-2xl overflow-hidden"
    >
      {/* Collapsible Header */}
      <button
        id="sos-advanced-settings-toggle"
        type="button"
        aria-expanded={isOpen}
        onClick={() => {
          if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
          setIsOpen((prev) => !prev);
        }}
        className="w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 glass-surface text-rose-400">
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-semibold text-white leading-tight truncate">
              {t.advancedTitle}
            </div>
            <div className="text-[11px] text-neutral-300/80 leading-snug mt-0.5 truncate font-mono tabular-nums">
              {activePresetLabel} · {settings.steps.length} {t.pulsesUnit} · {cycleSeconds}s
            </div>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-neutral-300 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-rose-400' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Expandable Customization Panel */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="sos-advanced-body"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="px-4 pb-4 pt-2 border-t border-white/10 space-y-4"
          >
          {/* 1. Emergency Pattern Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {t.presetLabel}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-neutral-500">
                {t.cycleSummary}: {cycleSeconds}s
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PRESET_LIST.map((preset) => {
                const selected = settings.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    id={`sos-preset-${preset.id}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`min-h-[52px] px-3 py-2 rounded-xl border text-left transition-all active:scale-95 ${
                      selected
                        ? 'bg-rose-500/20 border-rose-400/65 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                        : 'glass-surface text-neutral-200'
                    }`}
                  >
                    <div className="text-xs font-semibold leading-tight truncate">
                      {t.presets[preset.id]}
                    </div>
                    <div
                      className={`text-[11px] font-mono mt-1 truncate ${
                        selected ? 'text-rose-300' : 'text-neutral-500'
                      }`}
                    >
                      {preset.glyph}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Custom Blink Sequence Editor */}
          <div className="space-y-2.5 pt-2 border-t border-neutral-800/70">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {t.sequenceLabel}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-neutral-500">
                {settings.steps.length}/{MAX_SOS_STEPS}
              </span>
            </div>

            <p className="text-[11px] text-neutral-400 leading-snug">
              {t.sequenceHint}
            </p>

            {/* Interactive Pulse Timeline */}
            <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl glass-input min-h-[48px]">
              {settings.steps.map((step, index) => {
                const isLiveStep =
                  isActive && currentStepIndex === index && isEmitting;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleToggleStepType(index)}
                    aria-label={`Pulse ${index + 1}: ${step.type}`}
                    title={step.group ? `${step.group} (${step.type})` : step.type}
                    className={`h-7 flex items-center justify-center rounded-lg border font-bold transition-all ${
                      step.type === 'dash' ? 'w-10 text-xs' : 'w-7 text-xs'
                    } ${
                      isLiveStep
                        ? 'bg-rose-500 text-white border-rose-300 shadow-[0_0_10px_#f43f5e] scale-105'
                        : step.type === 'dash'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25'
                          : 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:bg-neutral-700'
                    }`}
                  >
                    {step.type === 'dash' ? '—' : '•'}
                  </button>
                );
              })}
            </div>

            {/* Sequence Builder Buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                id="sos-add-dot"
                type="button"
                disabled={settings.steps.length >= MAX_SOS_STEPS}
                onClick={() => handleAppendStep('dot')}
                className="min-h-[38px] px-2 py-1.5 rounded-xl bg-neutral-800/90 hover:bg-neutral-800 border border-neutral-700/70 text-white text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {t.addDot}
              </button>
              <button
                id="sos-add-dash"
                type="button"
                disabled={settings.steps.length >= MAX_SOS_STEPS}
                onClick={() => handleAppendStep('dash')}
                className="min-h-[38px] px-2 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-200 text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {t.addDash}
              </button>
              <button
                id="sos-remove-last"
                type="button"
                disabled={settings.steps.length <= 1}
                onClick={handleRemoveLast}
                className="min-h-[38px] px-2 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.removeLast}</span>
              </button>
              <button
                id="sos-reset-default"
                type="button"
                onClick={handleReset}
                className="min-h-[38px] px-2 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.resetDefault}</span>
              </button>
            </div>

            {/* Quick Text-to-Morse Converter */}
            <form onSubmit={handleApplyMorseText} className="flex items-center gap-2">
              <input
                id="sos-morse-text-input"
                type="text"
                maxLength={8}
                value={morseInput}
                onChange={(e) => setMorseInput(e.target.value)}
                placeholder={t.morseTextPlaceholder}
                className="flex-1 min-w-0 min-h-[38px] px-3 py-1.5 rounded-xl glass-input text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-rose-400/60 select-text"
              />
              <button
                id="sos-morse-text-apply"
                type="submit"
                disabled={encodeTextToSosSteps(morseInput).length === 0}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {t.applyMorseText}
              </button>
            </form>
          </div>

          {/* 3. Flash Duration & Timing Sliders */}
          <div className="space-y-3 pt-2 border-t border-neutral-800/70">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              {t.timingLabel}
            </span>

            {/* Dot Duration */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="sos-dot-duration" className="text-neutral-300 font-medium">
                  {t.dotDuration}
                </label>
                <span className="font-mono tabular-nums text-rose-400 font-semibold">
                  {formatMs(settings.dotDurationMs)}
                </span>
              </div>
              <input
                id="sos-dot-duration"
                type="range"
                min={SOS_LIMITS.dot.min}
                max={SOS_LIMITS.dot.max}
                step={SOS_LIMITS.dot.step}
                value={settings.dotDurationMs}
                onChange={(e) =>
                  handleDurationChange('dotDurationMs', Number(e.target.value))
                }
                className="w-full h-2 rounded-lg bg-neutral-800 cursor-pointer accent-rose-500"
              />
            </div>

            {/* Dash Duration */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="sos-dash-duration" className="text-neutral-300 font-medium">
                  {t.dashDuration}
                </label>
                <span className="font-mono tabular-nums text-rose-400 font-semibold">
                  {formatMs(settings.dashDurationMs)}
                </span>
              </div>
              <input
                id="sos-dash-duration"
                type="range"
                min={SOS_LIMITS.dash.min}
                max={SOS_LIMITS.dash.max}
                step={SOS_LIMITS.dash.step}
                value={settings.dashDurationMs}
                onChange={(e) =>
                  handleDurationChange('dashDurationMs', Number(e.target.value))
                }
                className="w-full h-2 rounded-lg bg-neutral-800 cursor-pointer accent-rose-500"
              />
            </div>

            {/* Gap Between Pulses */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="sos-pulse-gap" className="text-neutral-300 font-medium">
                  {t.pulseGap}
                </label>
                <span className="font-mono tabular-nums text-rose-400 font-semibold">
                  {formatMs(settings.pulseGapMs)}
                </span>
              </div>
              <input
                id="sos-pulse-gap"
                type="range"
                min={SOS_LIMITS.gap.min}
                max={SOS_LIMITS.gap.max}
                step={SOS_LIMITS.gap.step}
                value={settings.pulseGapMs}
                onChange={(e) =>
                  handleDurationChange('pulseGapMs', Number(e.target.value))
                }
                className="w-full h-2 rounded-lg bg-neutral-800 cursor-pointer accent-rose-500"
              />
            </div>

            {/* Repeat Cycle Pause */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="sos-repeat-pause" className="text-neutral-300 font-medium">
                  {t.repeatPause}
                </label>
                <span className="font-mono tabular-nums text-rose-400 font-semibold">
                  {formatMs(settings.repeatPauseMs)}
                </span>
              </div>
              <input
                id="sos-repeat-pause"
                type="range"
                min={SOS_LIMITS.repeat.min}
                max={SOS_LIMITS.repeat.max}
                step={SOS_LIMITS.repeat.step}
                value={settings.repeatPauseMs}
                onChange={(e) =>
                  handleDurationChange('repeatPauseMs', Number(e.target.value))
                }
                className="w-full h-2 rounded-lg bg-neutral-800 cursor-pointer accent-rose-500"
              />
            </div>
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
