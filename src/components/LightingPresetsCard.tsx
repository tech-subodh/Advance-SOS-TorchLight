import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Check, Plus, Trash2, X } from 'lucide-react';
import { Language, TorchLightingPreset } from '../types';
import { translations } from '../utils/translations';
import { HAPTIC_PATTERNS, triggerHaptic } from '../utils/audio';

interface LightingPresetsCardProps {
  language: Language;
  currentIntensity: number;
  onSelectIntensity: (intensity: number) => void;
  customPresets: TorchLightingPreset[];
  onSavePreset: (name: string, intensity: number) => void;
  onDeletePreset: (presetId: string) => void;
  disabled?: boolean;
  hapticEnabled?: boolean;
}

export const LightingPresetsCard: React.FC<LightingPresetsCardProps> = ({
  language,
  currentIntensity,
  onSelectIntensity,
  customPresets,
  onSavePreset,
  onDeletePreset,
  disabled = false,
  hapticEnabled = true,
}) => {
  const t = translations[language].torchMode;

  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [presetName, setPresetName] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const builtInPresets = useMemo<TorchLightingPreset[]>(
    () => [
      {
        id: 'builtin-soft',
        name: t.presetsBuiltInSoft,
        intensity: 0.2,
        isBuiltIn: true,
      },
      {
        id: 'builtin-reading',
        name: t.presetsBuiltInReading,
        intensity: 0.45,
        isBuiltIn: true,
      },
      {
        id: 'builtin-outdoor',
        name: t.presetsBuiltInOutdoor,
        intensity: 1.0,
        isBuiltIn: true,
      },
    ],
    [t.presetsBuiltInSoft, t.presetsBuiltInReading, t.presetsBuiltInOutdoor],
  );

  const allPresets = useMemo(
    () => [...builtInPresets, ...customPresets],
    [builtInPresets, customPresets],
  );

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const showFeedback = (message: string) => {
    setFeedback(message);
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
    }, 2400);
  };

  const currentPercent = Math.round(currentIntensity * 100);

  const handleLoadPreset = (preset: TorchLightingPreset) => {
    if (disabled) return;
    onSelectIntensity(preset.intensity);
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    showFeedback(
      `${t.presetsLoadedFeedback} ${preset.name} (${Math.round(preset.intensity * 100)}%)`,
    );
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const trimmed = presetName.trim().slice(0, 24);
    if (!trimmed) return;

    const normalized = Math.min(1, Math.max(0.1, Number(currentIntensity.toFixed(2))));
    onSavePreset(trimmed, normalized);

    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
    setPresetName('');
    setIsAdding(false);
    showFeedback(`${t.presetsSavedFeedback} ${trimmed} (${currentPercent}%)`);
  };

  const handleDeleteCustomPreset = (
    e: React.MouseEvent,
    presetId: string,
  ) => {
    e.stopPropagation();
    if (disabled) return;
    onDeletePreset(presetId);
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
  };

  return (
    <div
      id="torch-lighting-presets-card"
      className={`w-full glass-panel rounded-2xl p-3.5 space-y-3 ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 glass-surface text-amber-400">
            <Bookmark className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white leading-tight truncate">
              {t.presetsTitle}
            </div>
            <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
              {t.presetsSubtitle}
            </div>
          </div>
        </div>

        <button
          id="torch-preset-add-toggle"
          type="button"
          disabled={disabled}
          onClick={() => {
            if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
            setIsAdding((prev) => !prev);
          }}
          className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors disabled:cursor-not-allowed ${
            isAdding
              ? 'bg-neutral-800 border-neutral-700 text-neutral-300'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
          }`}
        >
          {isAdding ? (
            <>
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.presetsCancel}</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {t.presetsSaveBtn} {currentPercent}%
              </span>
            </>
          )}
        </button>
      </div>

      {/* Inline Save Current Intensity Form */}
      {isAdding && !disabled && (
        <form
          onSubmit={handleSavePreset}
          className="flex items-center gap-2 pt-1"
        >
          <input
            ref={inputRef}
            id="torch-preset-name-input"
            type="text"
            maxLength={24}
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder={t.presetsNamePlaceholder}
            className="flex-1 min-w-0 min-h-[38px] px-3 py-1.5 rounded-xl glass-input text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-400/60 select-text"
          />
          <button
            id="torch-preset-save-submit"
            type="submit"
            disabled={!presetName.trim()}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t.presetsConfirmSave}</span>
          </button>
        </form>
      )}

      {/* Named Presets Grid */}
      <div className="grid grid-cols-3 gap-2">
        {allPresets.map((preset) => {
          const pct = Math.round(preset.intensity * 100);
          const isActive = !disabled && Math.abs(currentIntensity - preset.intensity) < 0.015;
          return (
            <div
              key={preset.id}
              className="relative group"
            >
              <button
                id={`lighting-preset-${preset.id}`}
                type="button"
                disabled={disabled}
                aria-pressed={isActive}
                onClick={() => handleLoadPreset(preset)}
                className={`w-full min-h-[60px] p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all disabled:cursor-not-allowed active:scale-95 ${
                  isActive
                    ? 'bg-amber-500/18 border-amber-400/65 text-white shadow-[0_4px_16px_rgba(245,158,11,0.2),inset_0_1px_0_rgba(255,255,255,0.22)]'
                    : 'glass-surface text-neutral-200'
                }`}
              >
                <div className="flex items-start justify-between gap-1 w-full pr-3">
                  <span className="text-xs font-semibold leading-tight truncate">
                    {preset.name}
                  </span>
                </div>

                <div className="mt-2 space-y-1.5 w-full">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono tabular-nums text-[11px] font-bold leading-none ${
                        isActive ? 'text-amber-300' : 'text-neutral-400'
                      }`}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isActive ? 'bg-amber-400' : 'bg-amber-500/50'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </button>

              {!preset.isBuiltIn && !disabled && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteCustomPreset(e, preset.id)}
                  aria-label={`${t.presetsDeleteLabel} ${preset.name}`}
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center text-neutral-500 hover:text-rose-400 hover:bg-neutral-800/90 transition-colors"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline Saved/Loaded Confirmation */}
      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className="text-[11px] font-medium text-emerald-400 leading-snug"
        >
          {feedback}
        </p>
      )}
    </div>
  );
};
