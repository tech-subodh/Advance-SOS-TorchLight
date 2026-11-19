import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Megaphone,
  BellRing,
  MessageSquareText,
  Send,
  RotateCcw,
  Volume2,
  VolumeX,
  Sliders,
  AudioLines,
} from 'lucide-react';
import { Language, SosSettings } from '../types';
import { translations } from '../utils/translations';
import { PowerButton } from './PowerButton';
import { SosAdvancedSettings } from './SosAdvancedSettings';
import {
  DEFAULT_SOS_SETTINGS,
  MAX_MESSAGE_CHARS,
  calculateCycleDurationMs,
  cloneSosSettings,
  encodeMessageToSosSteps,
} from '../utils/sosPatterns';
import {
  playWhistle,
  playMorseTone,
  isAudioSessionSupported,
  emergencySiren,
  triggerHaptic,
  HAPTIC_PATTERNS,
} from '../utils/audio';

interface SosModeProps {
  isActive: boolean;
  onToggle: () => void;
  language: Language;
  currentStepIndex: number;
  isEmitting: boolean;
  soundEnabled: boolean;
  sosToneMuted: boolean;
  onToggleSosMute: () => void;
  sosSyncSystemVolume: boolean;
  onToggleSosSyncSystemVolume: () => void;
  sosToneVolume: number;
  onChangeSosToneVolume: (volume: number) => void;
  hapticEnabled?: boolean;
  sosSettings: SosSettings;
  onChangeSosSettings: (next: SosSettings) => void;
  onTransmitCustomMessage: (next: SosSettings) => void;
}

const QUICK_MESSAGES = ['SOS', 'HELP', 'NEED WATER', 'ALL OK'] as const;

export const SosMode: React.FC<SosModeProps> = ({
  isActive,
  onToggle,
  language,
  currentStepIndex,
  isEmitting,
  soundEnabled,
  sosToneMuted,
  onToggleSosMute,
  sosSyncSystemVolume,
  onToggleSosSyncSystemVolume,
  sosToneVolume,
  onChangeSosToneVolume,
  hapticEnabled = true,
  sosSettings,
  onChangeSosSettings,
  onTransmitCustomMessage,
}) => {
  const t = translations[language];
  const [sirenOn, setSirenOn] = useState<boolean>(() => emergencySiren.active());
  const audioSessionSupported = useMemo(() => isAudioSessionSupported(), []);
  const isEffectivelyMuted = sosToneMuted || !soundEnabled || sosToneVolume <= 0.001;
  const volumePercent = Math.round(sosToneVolume * 100);
  const [messageDraft, setMessageDraft] = useState<string>(
    () => sosSettings.customMessage ?? '',
  );

  useEffect(() => {
    if (sosSettings.customMessage) {
      setMessageDraft(sosSettings.customMessage);
    }
  }, [sosSettings.customMessage]);

  useEffect(() => {
    return () => {
      emergencySiren.stop();
    };
  }, []);

  const toggleSiren = () => {
    if (sirenOn) {
      emergencySiren.stop();
      setSirenOn(false);
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.sosOff);
    } else {
      emergencySiren.start();
      setSirenOn(true);
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.sosOn);
    }
  };

  const handleWhistle = () => {
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
    playWhistle();
  };

  const handleTestMorseTone = () => {
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    if (isEffectivelyMuted) {
      onToggleSosMute();
    }
    const testVol = sosToneVolume <= 0.05 ? 0.5 : sosToneVolume;
    playMorseTone(180, 820, {
      volume: testVol,
      syncSystemVolume: sosSyncSystemVolume,
    });
  };

  // Live translation preview of the typed message draft
  const draftEncoded = useMemo(
    () => encodeMessageToSosSteps(messageDraft),
    [messageDraft],
  );

  // Active custom message tokens for character-by-character live visualizer
  const activeMessageEncoded = useMemo(() => {
    if (!sosSettings.customMessage) return null;
    const encoded = encodeMessageToSosSteps(sosSettings.customMessage);
    return encoded.steps.length === sosSettings.steps.length ? encoded : null;
  }, [sosSettings.customMessage, sosSettings.steps.length]);

  const draftCycleSec = useMemo(() => {
    if (draftEncoded.steps.length === 0) return null;
    const ms = calculateCycleDurationMs({
      ...sosSettings,
      steps: draftEncoded.steps,
    });
    return (ms / 1000).toFixed(1);
  }, [draftEncoded.steps, sosSettings]);

  const handleSubmitCustomMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (draftEncoded.steps.length === 0) return;

    const nextSettings: SosSettings = {
      ...sosSettings,
      presetId: 'custom',
      steps: draftEncoded.steps,
      customMessage: draftEncoded.normalizedText,
    };
    onTransmitCustomMessage(nextSettings);
  };

  const handleResetToStandardSos = () => {
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    setMessageDraft('');
    onChangeSosSettings(cloneSosSettings(DEFAULT_SOS_SETTINGS));
  };

  const isStandardSos =
    sosSettings.presetId === 'standard-sos' &&
    sosSettings.steps.length === 9 &&
    !sosSettings.customMessage;

  return (
    <div className="flex flex-col items-center justify-between w-full max-w-md mx-auto px-4 py-3 min-h-[calc(100vh-140px)] select-none">
      {/* Header Info */}
      <div className="text-center w-full">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full glass-pill border-rose-400/35 text-rose-300 text-xs font-semibold uppercase tracking-wider mb-1">
          <ShieldAlert className="w-3.5 h-3.5" />
          {t.sosMode.title}
        </div>
        <p className="text-xs text-neutral-300/80">{t.sosMode.subtitle}</p>
      </div>

      {/* Main Switch Area */}
      <div className="flex flex-col items-center my-auto relative py-2 w-full">
        {/* Red emergency pulse halo */}
        <div
          className={`absolute -inset-12 rounded-full transition-opacity pointer-events-none ${
            isActive && isEmitting
              ? 'opacity-85 bg-rose-600/35 blur-2xl animate-pulse'
              : 'opacity-0'
          }`}
        />

        <PowerButton
          isOn={isActive}
          onToggle={onToggle}
          label={isActive ? t.sosMode.sosRunning : t.sosMode.sosStopped}
          size="large"
          accentColor="#E11D48" // Rose-600
          hapticEnabled={hapticEnabled}
        />

        {/* Quick One-Tap SOS Morse Mute Pill */}
        <button
          id="sos-quick-mute-pill"
          type="button"
          aria-pressed={isEffectivelyMuted}
          onClick={onToggleSosMute}
          className={`mt-1 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 ${
            isEffectivelyMuted
              ? 'glass-pill border-neutral-600/60 text-neutral-300'
              : 'bg-rose-500/16 border-rose-400/50 text-rose-100 shadow-[0_0_16px_rgba(225,29,72,0.22),inset_0_1px_0_rgba(255,255,255,0.18)]'
          }`}
        >
          {isEffectivelyMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-neutral-400 shrink-0" aria-hidden="true" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />
          )}
          <span>
            {isEffectivelyMuted ? t.sosMode.morseMutedBadge : t.sosMode.morseActiveBadge}
          </span>
          {!isEffectivelyMuted && (
            <span className="font-mono tabular-nums text-[11px] text-rose-300 pl-1.5 border-l border-white/15">
              {volumePercent}%
            </span>
          )}
        </button>

        {/* Live Pattern Visualizer (Standard SOS, Custom Morse Message, or Custom Sequence) */}
        <div className="mt-3 glass-panel rounded-2xl p-3 w-full max-w-sm">
          {isStandardSos ? (
            <div className="flex justify-center items-center gap-2">
              {/* S */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-neutral-400 mb-1">S</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((idx) => {
                    const isCurrent = isActive && currentStepIndex === idx && isEmitting;
                    return (
                      <div
                        key={idx}
                        className={`w-4 h-4 rounded-full transition-all duration-150 flex items-center justify-center text-[10px] font-bold ${
                          isCurrent
                            ? 'bg-rose-500 text-white shadow-[0_0_10px_#f43f5e] scale-110'
                            : 'bg-neutral-800 text-neutral-500'
                        }`}
                      >
                        •
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-neutral-600 font-bold text-sm px-1">/</div>

              {/* O */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-neutral-400 mb-1">O</span>
                <div className="flex gap-1">
                  {[3, 4, 5].map((idx) => {
                    const isCurrent = isActive && currentStepIndex === idx && isEmitting;
                    return (
                      <div
                        key={idx}
                        className={`w-7 h-4 rounded-md transition-all duration-150 flex items-center justify-center text-xs font-bold ${
                          isCurrent
                            ? 'bg-rose-500 text-white shadow-[0_0_10px_#f43f5e] scale-105'
                            : 'bg-neutral-800 text-neutral-500'
                        }`}
                      >
                        —
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-neutral-600 font-bold text-sm px-1">/</div>

              {/* S */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-neutral-400 mb-1">S</span>
                <div className="flex gap-1">
                  {[6, 7, 8].map((idx) => {
                    const isCurrent = isActive && currentStepIndex === idx && isEmitting;
                    return (
                      <div
                        key={idx}
                        className={`w-4 h-4 rounded-full transition-all duration-150 flex items-center justify-center text-[10px] font-bold ${
                          isCurrent
                            ? 'bg-rose-500 text-white shadow-[0_0_10px_#f43f5e] scale-110'
                            : 'bg-neutral-800 text-neutral-500'
                        }`}
                      >
                        •
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : activeMessageEncoded ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px] px-0.5">
                <span className="font-semibold text-rose-300 truncate">
                  {t.sosMode.customMessageActiveTag}{' '}
                  <span className="font-mono text-white">
                    “{activeMessageEncoded.normalizedText}”
                  </span>
                </span>
                <span className="font-mono tabular-nums text-neutral-500 shrink-0">
                  {sosSettings.steps.length} {t.sosMode.pulsesUnit}
                </span>
              </div>

              <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-2 max-h-28 overflow-y-auto py-0.5">
                {activeMessageEncoded.tokens.map((token, tokenIdx) => {
                  if (token.isSpace) {
                    return (
                      <span
                        key={`space-${tokenIdx}`}
                        className="text-neutral-600 font-bold text-xs px-0.5"
                        aria-hidden="true"
                      >
                        /
                      </span>
                    );
                  }
                  const isTokenActive =
                    isActive &&
                    currentStepIndex >= token.startIndex &&
                    currentStepIndex <= token.endIndex;

                  return (
                    <div
                      key={`tok-${tokenIdx}`}
                      className={`flex flex-col items-center px-1.5 py-1 rounded-lg border transition-colors ${
                        isTokenActive
                          ? 'bg-rose-500/15 border-rose-500/50'
                          : 'bg-neutral-950/60 border-neutral-800/80'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-mono font-bold leading-none mb-1 ${
                          isTokenActive ? 'text-rose-300' : 'text-neutral-400'
                        }`}
                      >
                        {token.char}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {token.code.split('').map((sym, symIdx) => {
                          const globalIdx = token.startIndex + symIdx;
                          const isPulseLive =
                            isActive && currentStepIndex === globalIdx && isEmitting;
                          const isDash = sym === '-';
                          return (
                            <span
                              key={globalIdx}
                              className={`h-2.5 transition-all duration-100 ${
                                isDash ? 'w-4 rounded-sm' : 'w-2.5 rounded-full'
                              } ${
                                isPulseLive
                                  ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e] scale-110'
                                  : isTokenActive
                                    ? 'bg-rose-400/45'
                                    : 'bg-neutral-700'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] px-0.5">
                <span className="font-semibold text-rose-300 truncate">
                  {t.sosMode.presets[sosSettings.presetId]}
                </span>
                <span className="font-mono tabular-nums text-neutral-500 shrink-0">
                  {sosSettings.dotDurationMs}ms / {sosSettings.dashDurationMs}ms
                </span>
              </div>
              <div className="flex flex-wrap justify-center items-center gap-1.5">
                {sosSettings.steps.map((step, idx) => {
                  const isCurrent = isActive && currentStepIndex === idx && isEmitting;
                  return (
                    <div
                      key={step.id}
                      className={`h-4 transition-all duration-150 flex items-center justify-center font-bold ${
                        step.type === 'dash'
                          ? 'w-7 rounded-md text-xs'
                          : 'w-4 rounded-full text-[10px]'
                      } ${
                        isCurrent
                          ? 'bg-rose-500 text-white shadow-[0_0_10px_#f43f5e] scale-110'
                          : 'bg-neutral-800 text-neutral-500'
                      }`}
                    >
                      {step.type === 'dash' ? '—' : '•'}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Emergency Controls, Custom Morse Translator & Advanced Settings */}
      <div className="w-full space-y-3 mt-4">
        {/* Custom Morse Code Message Translator Card */}
        <div
          id="sos-custom-message-card"
          className="w-full glass-panel rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 glass-surface text-rose-400">
                <MessageSquareText className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-white leading-tight truncate">
                  {t.sosMode.customMessageTitle}
                </div>
                <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
                  {t.sosMode.customMessageSubtitle}
                </div>
              </div>
            </div>

            {sosSettings.customMessage && (
              <button
                id="sos-custom-message-reset-btn"
                type="button"
                onClick={handleResetToStandardSos}
                className="min-h-[30px] px-2 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-neutral-300 font-medium flex items-center gap-1 shrink-0 transition-colors"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>{t.sosMode.customMessageReset}</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSubmitCustomMessage} className="space-y-2.5">
            <div className="relative">
              <input
                id="sos-custom-message-input"
                type="text"
                maxLength={MAX_MESSAGE_CHARS}
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                placeholder={t.sosMode.customMessagePlaceholder}
                aria-label={t.sosMode.customMessageTitle}
                className="w-full min-h-[44px] px-3.5 pr-12 py-2 rounded-xl glass-input focus:border-rose-400/70 focus:outline-none text-xs sm:text-sm text-white placeholder:text-neutral-500 select-text"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono tabular-nums text-[10px] text-neutral-400">
                {messageDraft.length}/{MAX_MESSAGE_CHARS}
              </span>
            </div>

            {/* Quick Emergency Message Chips */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_MESSAGES.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => {
                    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
                    setMessageDraft(phrase);
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold transition-all active:scale-95 ${
                    messageDraft.trim().toUpperCase() === phrase
                      ? 'bg-rose-500/22 border-rose-400/60 text-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
                      : 'glass-surface text-neutral-300 hover:text-white'
                  }`}
                >
                  {phrase}
                </button>
              ))}
            </div>

            {/* Live Morse Code Translation Preview */}
            <div className="rounded-xl glass-input px-3 py-2.5 space-y-1">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-400">
                <span>{t.sosMode.customMessagePreviewLabel}</span>
                {draftEncoded.steps.length > 0 && draftCycleSec && (
                  <span className="font-mono tabular-nums text-rose-400">
                    {draftEncoded.steps.length} {t.sosMode.pulsesUnit} · {draftCycleSec}s
                  </span>
                )}
              </div>
              {draftEncoded.displayString ? (
                <p
                  id="sos-custom-morse-preview"
                  className="font-mono text-xs text-rose-300 tracking-wider leading-relaxed break-words select-text"
                >
                  {draftEncoded.displayString}
                </p>
              ) : (
                <p className="text-[11px] text-neutral-500">
                  {t.sosMode.customMessageEmptyHint}
                </p>
              )}
            </div>

            <button
              id="sos-custom-message-transmit-btn"
              type="submit"
              disabled={draftEncoded.steps.length === 0}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isActive
                  ? t.sosMode.customMessageUpdate
                  : t.sosMode.customMessageTransmit}
              </span>
            </button>
          </form>
        </div>

        {/* SOS Morse Audio Mute & System Notification Volume Sync Card */}
        <div
          id="sos-audio-sync-card"
          className="w-full glass-panel rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                  isEffectivelyMuted
                    ? 'glass-surface text-neutral-400'
                    : 'bg-rose-500/18 text-rose-300 border-rose-400/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                }`}
              >
                {isEffectivelyMuted ? (
                  <VolumeX className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-white leading-tight truncate">
                  {t.sosMode.morseAudioTitle}
                </div>
                <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
                  {t.sosMode.morseAudioSubtitle}
                </div>
              </div>
            </div>

            <button
              id="sos-mute-toggle-btn"
              type="button"
              aria-pressed={isEffectivelyMuted}
              onClick={onToggleSosMute}
              className={`min-h-[34px] px-3 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all active:scale-95 ${
                isEffectivelyMuted
                  ? 'bg-rose-600/90 text-white border-rose-400/70 shadow-sm'
                  : 'glass-surface text-neutral-200 hover:text-white'
              }`}
            >
              {isEffectivelyMuted ? (
                <>
                  <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t.sosMode.morseUnmuteBtn}</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
                  <span>{t.sosMode.morseMuteBtn}</span>
                </>
              )}
            </button>
          </div>

          {!soundEnabled && (
            <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-400/25 rounded-xl px-2.5 py-1.5">
              {t.sosMode.morseGlobalMutedNotice}
            </p>
          )}

          {/* System Notification Volume Sync Toggle */}
          <button
            id="sos-system-volume-sync-switch"
            type="button"
            role="switch"
            aria-checked={sosSyncSystemVolume}
            onClick={onToggleSosSyncSystemVolume}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl glass-surface flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sliders
                className={`w-3.5 h-3.5 shrink-0 ${
                  sosSyncSystemVolume ? 'text-rose-400' : 'text-neutral-500'
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-white truncate">
                  {t.sosMode.syncSystemVolumeTitle}
                </div>
                <div className="text-[10px] text-neutral-400 leading-snug">
                  {t.sosMode.syncSystemVolumeSubtitle}
                </div>
              </div>
            </div>

            <span
              aria-hidden="true"
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                sosSyncSystemVolume ? 'bg-rose-600' : 'bg-neutral-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-150 ${
                  sosSyncSystemVolume ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </span>
          </button>

          {/* Volume Level Slider + Test Beep */}
          <div className={`space-y-2 ${isEffectivelyMuted ? 'opacity-55' : ''}`}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-neutral-300">
                {sosSyncSystemVolume
                  ? t.sosMode.volumeTrimLabel
                  : t.sosMode.volumeLevelLabel}
              </span>
              <span className="font-mono tabular-nums font-bold text-rose-300">
                {isEffectivelyMuted ? '0%' : `${volumePercent}%`}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative flex-1 flex items-center h-8">
                <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden pointer-events-none">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-700 via-rose-500 to-rose-300 transition-[width] duration-75"
                    style={{ width: `${isEffectivelyMuted ? 0 : volumePercent}%` }}
                  />
                </div>
                <input
                  id="sos-morse-volume-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={isEffectivelyMuted ? 0 : volumePercent}
                  onChange={(e) => {
                    const nextVal = Math.min(1, Math.max(0, Number(e.target.value) / 100));
                    onChangeSosToneVolume(nextVal);
                  }}
                  aria-label={
                    sosSyncSystemVolume
                      ? t.sosMode.volumeTrimLabel
                      : t.sosMode.volumeLevelLabel
                  }
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-rose-300 border-2 border-neutral-950 shadow"
                  style={{ left: `${isEffectivelyMuted ? 0 : volumePercent}%` }}
                />
              </div>

              <button
                id="sos-test-tone-btn"
                type="button"
                onClick={handleTestMorseTone}
                className="min-h-[32px] px-2.5 py-1 rounded-xl glass-surface text-[11px] font-semibold text-rose-200 hover:text-white border border-rose-400/35 flex items-center gap-1 shrink-0 active:scale-95"
              >
                <AudioLines className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
                <span>{t.sosMode.testToneBtn}</span>
              </button>
            </div>

            <div className="text-[10px] text-neutral-400">
              {sosSyncSystemVolume
                ? audioSessionSupported
                  ? t.sosMode.syncStatusSession
                  : t.sosMode.syncStatusHardware
                : t.sosMode.syncStatusManual}
            </div>
          </div>
        </div>

        {/* Emergency Distress Tools */}
        <div className="w-full glass-panel rounded-2xl p-4 space-y-3">
          {/* Independent High-Frequency Emergency Siren Switch */}
          <button
            id="emergency-siren-toggle"
            type="button"
            role="switch"
            aria-checked={sirenOn}
            onClick={toggleSiren}
            className={`w-full min-h-[56px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
              sirenOn
                ? 'bg-rose-500/20 border-rose-400/60 text-white shadow-[0_6px_20px_rgba(225,29,72,0.22),inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'glass-surface text-neutral-200'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                  sirenOn
                    ? 'bg-rose-600 text-white border-rose-400'
                    : 'glass-surface text-rose-400'
                }`}
              >
                <BellRing className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold leading-tight text-white truncate">
                  {t.sosMode.sirenTitle}
                </div>
                <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
                  {t.sosMode.sirenSubtitle}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[11px] font-semibold tabular-nums ${
                  sirenOn ? 'text-rose-400' : 'text-neutral-500'
                }`}
              >
                {sirenOn ? t.sosMode.sirenActive : t.sosMode.sirenOff}
              </span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  sirenOn ? 'bg-rose-600' : 'bg-neutral-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
                    sirenOn ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </span>
            </div>
          </button>

          {/* Whistle Button */}
          <button
            id="emergency-whistle-button"
            type="button"
            onClick={handleWhistle}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold glass-surface text-amber-300 border-amber-400/35 active:scale-[0.98]"
          >
            <Megaphone className="w-4 h-4" aria-hidden="true" />
            <span>{t.sosMode.whistleSound}</span>
          </button>

          {/* Emergency Tip */}
          <p className="text-[11px] text-neutral-400 text-center leading-relaxed">
            {t.sosMode.emergencyTip}
          </p>
        </div>

        {/* Advanced SOS Settings Panel */}
        <SosAdvancedSettings
          settings={sosSettings}
          onChangeSettings={onChangeSosSettings}
          language={language}
          hapticEnabled={hapticEnabled}
          isActive={isActive}
          currentStepIndex={currentStepIndex}
          isEmitting={isEmitting}
        />
      </div>
    </div>
  );
};
