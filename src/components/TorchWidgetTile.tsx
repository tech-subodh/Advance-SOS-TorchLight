import React from 'react';
import {
  Flashlight,
  Power,
  ShieldAlert,
  Sun,
  Battery,
  Zap,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Language, UiTheme, WidgetLayoutVariant } from '../types';
import { BatteryStatus } from '../hooks/useBatteryStatus';
import { translations } from '../utils/translations';

interface TorchWidgetTileProps {
  layout: WidgetLayoutVariant;
  isTorchOn: boolean;
  onToggleTorch: () => void;
  torchIntensity: number;
  onChangeIntensity: (value: number) => void;
  canAdjustIntensity: boolean;
  hasHardwareTorch: boolean;
  battery: BatteryStatus;
  language: Language;
  uiTheme: UiTheme;
  onQuickSos?: () => void;
  onQuickScreenLight?: () => void;
  onExpandFullApp?: () => void;
  isPreview?: boolean;
}

const QUICK_LEVELS = [0.25, 0.5, 1.0];

export const TorchWidgetTile: React.FC<TorchWidgetTileProps> = ({
  layout,
  isTorchOn,
  onToggleTorch,
  torchIntensity,
  onChangeIntensity,
  canAdjustIntensity,
  hasHardwareTorch,
  battery,
  language,
  uiTheme,
  onQuickSos,
  onQuickScreenLight,
  onExpandFullApp,
  isPreview = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const t = translations[language];
  const intensityPercent = Math.round(torchIntensity * 100);

  const accentHex =
    uiTheme === 'red-night'
      ? '#DC2626'
      : uiTheme === 'sepia-night'
        ? '#D97706'
        : '#F59E0B';

  const activeRingStyle = isTorchOn
    ? {
        boxShadow: `0 0 28px ${accentHex}55, inset 0 1px 0 rgba(255,255,255,0.35)`,
        borderColor: `${accentHex}99`,
      }
    : undefined;

  const cycleIntensity = () => {
    if (!canAdjustIntensity) return;
    const next =
      intensityPercent < 40 ? 0.5 : intensityPercent < 85 ? 1.0 : 0.25;
    onChangeIntensity(next);
  };

  const batteryLabel =
    battery.supported && battery.level !== null ? `${battery.level}%` : '--%';

  // 1) Compact 2x1 Instant Pill Widget
  if (layout === 'compact-2x1') {
    return (
      <div
        id={isPreview ? 'widget-preview-compact-2x1' : 'homescreen-widget-compact-2x1'}
        className="w-full max-w-[300px] mx-auto rounded-[28px] glass-panel p-3.5 transition-all duration-300 relative overflow-hidden"
        style={activeRingStyle}
      >
        {/* Subtle liquid glow when active */}
        {isTorchOn && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-4 opacity-25 blur-2xl transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at 25% 50%, ${accentHex}, transparent 70%)`,
            }}
          />
        )}

        <div className="relative z-10 flex items-center justify-between gap-3">
          <motion.button
            id={isPreview ? 'widget-preview-torch-btn' : 'widget-torch-toggle-btn'}
            type="button"
            aria-pressed={isTorchOn}
            aria-label={isTorchOn ? t.torchMode.turnOff : t.torchMode.turnOn}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
            onClick={onToggleTorch}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-200 ${
              isTorchOn
                ? 'bg-amber-400 text-neutral-950 border-amber-200 shadow-[0_0_24px_rgba(245,158,11,0.6),inset_0_1px_0_rgba(255,255,255,0.7)]'
                : 'glass-surface text-amber-300 border-white/15 hover:border-amber-400/40'
            }`}
          >
            <Power className="w-7 h-7 stroke-[2.4]" aria-hidden="true" />
          </motion.button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-sm font-bold text-white truncate">
                {t.appTitle}
              </span>
              {onExpandFullApp && (
                <button
                  type="button"
                  onClick={onExpandFullApp}
                  className="p-1.5 rounded-lg glass-surface text-neutral-300 hover:text-white active:scale-95"
                  title={t.widget.openFullApp}
                  aria-label={t.widget.openFullApp}
                >
                  <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <div
              className={`text-xs font-semibold mt-0.5 ${
                isTorchOn ? 'text-amber-300' : 'text-neutral-400'
              }`}
            >
              {isTorchOn ? t.torchMode.statusOn : t.torchMode.statusOff}
            </div>

            <div className="mt-2 flex items-center gap-2 text-[11px] font-mono tabular-nums text-neutral-300">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg glass-pill">
                <Sun className="w-3 h-3 text-amber-400" aria-hidden="true" />
                {intensityPercent}%
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg glass-pill">
                {battery.charging ? (
                  <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" aria-hidden="true" />
                ) : (
                  <Battery className="w-3 h-3 text-neutral-300" aria-hidden="true" />
                )}
                {batteryLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2) Dock 4x1 Full-Width Utility Bar Widget
  if (layout === 'dock-4x1') {
    return (
      <div
        id={isPreview ? 'widget-preview-dock-4x1' : 'homescreen-widget-dock-4x1'}
        className="w-full max-w-md mx-auto rounded-[24px] glass-panel px-3 py-2.5 transition-all duration-300 relative overflow-hidden"
        style={activeRingStyle}
      >
        {isTorchOn && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-20 blur-xl"
            style={{
              background: `linear-gradient(90deg, ${accentHex}, transparent 65%)`,
            }}
          />
        )}

        <div className="relative z-10 flex items-center justify-between gap-2">
          {/* Primary Instant Torch Pill */}
          <motion.button
            id={isPreview ? 'widget-preview-torch-btn' : 'widget-torch-toggle-btn'}
            type="button"
            aria-pressed={isTorchOn}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
            onClick={onToggleTorch}
            className={`flex-1 min-h-[48px] px-3.5 py-2 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
              isTorchOn
                ? 'bg-amber-400 text-neutral-950 border-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                : 'glass-surface text-white border-white/15 hover:border-amber-400/40'
            }`}
          >
            <Flashlight className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {isTorchOn ? t.torchMode.turnOff : t.torchMode.turnOn}
            </span>
          </motion.button>

          {/* Brightness Cycler */}
          <button
            type="button"
            disabled={!canAdjustIntensity}
            onClick={cycleIntensity}
            className="min-h-[48px] min-w-[58px] px-2.5 rounded-2xl glass-surface border border-white/12 flex flex-col items-center justify-center text-[11px] font-mono tabular-nums text-amber-300 active:scale-95 disabled:opacity-45"
            title={t.torchMode.intensityTitle}
            aria-label={`${t.torchMode.intensityTitle}: ${intensityPercent}%`}
          >
            <Sun className="w-3.5 h-3.5 mb-0.5" aria-hidden="true" />
            <span>{intensityPercent}%</span>
          </button>

          {/* Quick Screen Light */}
          {onQuickScreenLight && (
            <button
              type="button"
              onClick={onQuickScreenLight}
              className="min-h-[48px] min-w-[48px] px-2.5 rounded-2xl glass-surface border border-white/12 flex flex-col items-center justify-center text-[10px] font-medium text-sky-300 active:scale-95"
              title={t.modes.screen}
              aria-label={t.modes.screen}
            >
              <Sparkles className="w-3.5 h-3.5 mb-0.5" aria-hidden="true" />
              <span>{t.modes.screen}</span>
            </button>
          )}

          {/* Quick SOS */}
          {onQuickSos && (
            <button
              type="button"
              onClick={onQuickSos}
              className="min-h-[48px] min-w-[48px] px-2.5 rounded-2xl bg-rose-500/18 border border-rose-400/40 flex flex-col items-center justify-center text-[10px] font-bold text-rose-300 active:scale-95"
              title={t.modes.sos}
              aria-label={t.modes.sos}
            >
              <ShieldAlert className="w-3.5 h-3.5 mb-0.5" aria-hidden="true" />
              <span>SOS</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 3) Controls 2x2 Square Dashboard Widget (default)
  return (
    <div
      id={isPreview ? 'widget-preview-controls-2x2' : 'homescreen-widget-controls-2x2'}
      className="w-full max-w-[300px] mx-auto rounded-[30px] glass-panel p-4 transition-all duration-300 relative overflow-hidden space-y-3.5"
      style={activeRingStyle}
    >
      {isTorchOn && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-56 h-36 rounded-full opacity-30 blur-3xl"
          style={{ backgroundColor: accentHex }}
        />
      )}

      {/* Top Metadata Strip */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all ${
              isTorchOn
                ? 'bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)]'
                : 'bg-neutral-600'
            }`}
          />
          <span className="text-xs font-bold tracking-tight text-white truncate">
            {t.appTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg glass-pill text-[11px] font-mono tabular-nums text-neutral-200">
            {battery.charging ? (
              <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" aria-hidden="true" />
            ) : (
              <Battery className="w-3 h-3 text-neutral-300" aria-hidden="true" />
            )}
            {batteryLabel}
          </span>

          {onExpandFullApp && (
            <button
              type="button"
              onClick={onExpandFullApp}
              className="p-1.5 rounded-lg glass-surface text-neutral-300 hover:text-white active:scale-95"
              title={t.widget.openFullApp}
              aria-label={t.widget.openFullApp}
            >
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Main Big Instant Torch Button */}
      <motion.button
        id={isPreview ? 'widget-preview-torch-btn' : 'widget-torch-toggle-btn'}
        type="button"
        aria-pressed={isTorchOn}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
        onClick={onToggleTorch}
        className={`relative z-10 w-full min-h-[84px] rounded-2xl border flex items-center justify-between px-4 py-3 transition-all duration-200 ${
          isTorchOn
            ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-neutral-950 border-amber-200 shadow-[0_10px_28px_rgba(245,158,11,0.45),inset_0_1px_0_rgba(255,255,255,0.65)]'
            : 'glass-surface text-white border-white/15 hover:border-amber-400/40'
        }`}
      >
        <div className="text-left min-w-0">
          <div className="text-base font-extrabold tracking-tight leading-tight">
            {isTorchOn ? t.torchMode.statusOn : t.torchMode.turnOn}
          </div>
          <div
            className={`text-[11px] mt-1 font-medium truncate ${
              isTorchOn ? 'text-neutral-900/80' : 'text-neutral-400'
            }`}
          >
            {hasHardwareTorch
              ? language === 'hi'
                ? 'LED फ्लैश'
                : 'Hardware LED'
              : language === 'hi'
                ? 'स्क्रीन टॉर्च'
                : 'Screen Torch'}
            {' · '}
            {intensityPercent}%
          </div>
        </div>

        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
            isTorchOn
              ? 'bg-neutral-950/15 border-neutral-950/20 text-neutral-950'
              : 'bg-amber-500/15 border-amber-400/35 text-amber-300'
          }`}
        >
          <Power className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
        </div>
      </motion.button>

      {/* Bottom Quick Brightness Presets & SOS Trigger */}
      <div className="relative z-10 flex items-center gap-1.5">
        <div className="flex-1 grid grid-cols-3 gap-1.5">
          {QUICK_LEVELS.map((lvl) => {
            const pct = Math.round(lvl * 100);
            const selected = Math.abs(torchIntensity - lvl) < 0.06;
            return (
              <button
                key={pct}
                type="button"
                disabled={!canAdjustIntensity}
                aria-pressed={selected}
                onClick={() => onChangeIntensity(lvl)}
                className={`min-h-[38px] rounded-xl text-[11px] font-mono tabular-nums font-semibold border transition-all active:scale-95 disabled:opacity-45 ${
                  selected
                    ? 'bg-amber-500/90 text-neutral-950 border-amber-300/75 shadow-sm'
                    : 'glass-surface text-neutral-200 hover:text-white'
                }`}
              >
                {pct}%
              </button>
            );
          })}
        </div>

        {onQuickSos && (
          <button
            type="button"
            onClick={onQuickSos}
            className="min-h-[38px] px-3 rounded-xl bg-rose-500/18 border border-rose-400/45 text-rose-300 text-[11px] font-bold flex items-center gap-1 active:scale-95 shrink-0"
            title={t.modes.sos}
            aria-label={t.modes.sos}
          >
            <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
            <span>SOS</span>
          </button>
        )}
      </div>
    </div>
  );
};
