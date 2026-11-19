import React from 'react';
import {
  Volume2,
  VolumeX,
  Smartphone,
  Globe,
  Flashlight,
  Zap,
  AlertTriangle,
  Mic,
  Eye,
  LayoutGrid,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Language, UiTheme } from '../types';
import { translations } from '../utils/translations';
import { BatteryStatus, LOW_BATTERY_THRESHOLD } from '../hooks/useBatteryStatus';
import { PWAInstallState } from '../hooks/usePWAInstall';

interface HeaderProps {
  language: Language;
  onToggleLanguage: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  hapticEnabled: boolean;
  onToggleHaptic: () => void;
  wakeLockActive: boolean;
  hasHardwareTorch: boolean;
  battery: BatteryStatus;
  voiceListening: boolean;
  onToggleVoice: () => void;
  uiTheme: UiTheme;
  onCycleUiTheme: () => void;
  onOpenWidgetMode: () => void;
  pwaInstall: PWAInstallState;
}

interface AnimatedBatteryIconProps {
  level: number | null;
  charging: boolean;
  supported: boolean;
}

const AnimatedBatteryIcon: React.FC<AnimatedBatteryIconProps> = ({
  level,
  charging,
  supported,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const safeLevel = supported && level !== null ? Math.max(0, Math.min(100, level)) : 0;
  const fillRatio = safeLevel / 100;
  const isCritical =
    supported && level !== null && !charging && level < LOW_BATTERY_THRESHOLD;
  const isLow =
    supported &&
    level !== null &&
    !charging &&
    level >= LOW_BATTERY_THRESHOLD &&
    level <= 35;

  const fillColor = !supported || level === null
    ? '#525252'
    : charging
    ? '#34d399'
    : isCritical
    ? '#f43f5e'
    : isLow
    ? '#fbbf24'
    : '#34d399';

  const frameColor = !supported || level === null
    ? '#525252'
    : charging
    ? '#34d399'
    : isCritical
    ? '#fb7185'
    : '#a3a3a3';

  return (
    <svg
      width="24"
      height="13"
      viewBox="0 0 26 14"
      fill="none"
      className="shrink-0 overflow-visible"
      aria-hidden="true"
    >
      {/* Battery Outer Casing */}
      <rect
        x="1"
        y="1.5"
        width="21"
        height="11"
        rx="2.5"
        stroke={frameColor}
        strokeWidth="1.4"
      />

      {/* Positive Terminal Nub */}
      <rect
        x="23.2"
        y="4.5"
        width="1.8"
        height="5"
        rx="0.9"
        fill={frameColor}
      />

      {/* Dynamic Animated Fill Level */}
      {supported && level !== null && (
        <motion.rect
          x="3"
          y="3.5"
          width="17"
          height="7"
          rx="1.2"
          fill={fillColor}
          style={{ transformOrigin: '3px 7px' }}
          initial={{ scaleX: 0, opacity: 0.7 }}
          animate={{
            scaleX: Math.max(0.06, fillRatio),
            opacity: prefersReducedMotion
              ? 1
              : isCritical
              ? [1, 0.35, 1]
              : charging
              ? [0.75, 1, 0.75]
              : 1,
          }}
          transition={{
            scaleX: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
            opacity:
              isCritical || charging
                ? {
                    duration: isCritical ? 1.1 : 1.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
                : { duration: 0.2 },
          }}
        />
      )}
    </svg>
  );
};

export const Header: React.FC<HeaderProps> = ({
  language,
  onToggleLanguage,
  soundEnabled,
  onToggleSound,
  hapticEnabled,
  onToggleHaptic,
  wakeLockActive,
  hasHardwareTorch,
  battery,
  voiceListening,
  onToggleVoice,
  uiTheme,
  onCycleUiTheme,
  onOpenWidgetMode,
  pwaInstall,
}) => {
  const t = translations[language];
  const prefersReducedMotion = useReducedMotion();

  const batteryTextClass = !battery.supported || battery.level === null
    ? 'text-neutral-500'
    : battery.charging
    ? 'text-emerald-300'
    : battery.isLowBattery
    ? 'text-rose-300 font-semibold'
    : battery.level <= 35
    ? 'text-amber-300'
    : 'text-neutral-100';

  const batteryTitle =
    battery.supported && battery.level !== null
      ? `${t.common.battery}: ${battery.level}%${
          battery.charging
            ? ` · ${t.common.batteryCharging}`
            : battery.isLowBattery
            ? ` · ${t.common.batteryLow}`
            : ''
        }`
      : t.common.batteryUnavailable;

  return (
    <header className="w-full glass-chrome border-b px-4 py-2.5 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_12px_rgba(245,158,11,0.18)] flex items-center justify-center text-amber-400 shrink-0 backdrop-blur-md">
            <Flashlight className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate leading-tight">
              {t.appTitle}
            </h1>
            <p className="text-[11px] text-neutral-300/80 leading-none truncate mt-0.5">
              {hasHardwareTorch
                ? language === 'hi'
                  ? 'LED फ्लैश तैयार'
                  : 'Hardware Torch'
                : language === 'hi'
                ? 'स्मार्ट स्क्रीन लाइट'
                : 'Screen Light'}
              {wakeLockActive && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="text-emerald-400">{t.screenMode.wakeLockActive}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Dynamic Battery Status & Utility Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div
            id="header-battery-indicator"
            role="status"
            aria-live="polite"
            aria-label={batteryTitle}
            title={batteryTitle}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono tabular-nums whitespace-nowrap shrink-0 backdrop-blur-md transition-colors ${
              battery.supported && battery.charging
                ? 'bg-emerald-500/12 border-emerald-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                : battery.isLowBattery
                ? 'bg-rose-500/18 border-rose-400/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                : 'glass-surface'
            }`}
          >
            <AnimatedBatteryIcon
              level={battery.level}
              charging={battery.charging}
              supported={battery.supported}
            />
            <span className={batteryTextClass}>
              {battery.supported && battery.level !== null ? `${battery.level}%` : '--%'}
            </span>
            <AnimatePresence initial={false}>
              {battery.supported && battery.charging && (
                <motion.span
                  id="header-battery-charging-bolt"
                  key="charging-bolt"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={
                    prefersReducedMotion
                      ? { opacity: 1, scale: 1 }
                      : { opacity: [0.75, 1, 0.75], scale: 1 }
                  }
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{
                    opacity: prefersReducedMotion
                      ? { duration: 0.15 }
                      : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
                    scale: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
                  }}
                  className="inline-flex items-center justify-center shrink-0"
                  aria-label={t.common.batteryCharging}
                  title={t.common.batteryCharging}
                >
                  <Zap
                    className="w-3 h-3 text-emerald-400 fill-emerald-400"
                    aria-hidden="true"
                  />
                </motion.span>
              )}
              {battery.isLowBattery && (
                <motion.span
                  id="header-low-battery-warning-icon"
                  key="low-battery-warning"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={
                    prefersReducedMotion
                      ? { opacity: 1, scale: 1 }
                      : { opacity: [1, 0.45, 1], scale: 1 }
                  }
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{
                    opacity: prefersReducedMotion
                      ? { duration: 0.15 }
                      : { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
                    scale: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
                  }}
                  className="inline-flex items-center justify-center shrink-0"
                  aria-label={t.common.batteryLow}
                  title={t.common.batteryLow}
                >
                  <AlertTriangle
                    className="w-3 h-3 text-rose-400"
                    aria-hidden="true"
                  />
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <button
            id="header-widget-mode-btn"
            type="button"
            onClick={onOpenWidgetMode}
            className="min-w-[36px] min-h-[36px] p-2 rounded-xl transition-all border flex items-center justify-center backdrop-blur-md active:scale-95 bg-amber-500/14 text-amber-300 border-amber-400/35 hover:border-amber-400/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
            title={t.widget.widgetButtonHint}
            aria-label={t.widget.widgetButtonHint}
          >
            <LayoutGrid className="w-4 h-4" aria-hidden="true" />
          </button>

          {pwaInstall.isInstallable && !pwaInstall.isInstalled && (
            <button
              id="header-pwa-install-btn"
              type="button"
              onClick={() => void pwaInstall.install()}
              className="min-w-[36px] min-h-[36px] p-2 rounded-xl transition-all border flex items-center justify-center backdrop-blur-md active:scale-95 bg-amber-500/90 text-neutral-950 border-amber-300/80 shadow-[0_0_14px_rgba(245,158,11,0.35)]"
              title={t.widget.installApp}
              aria-label={t.widget.installApp}
            >
              <Download className="w-4 h-4" aria-hidden="true" />
            </button>
          )}

          <button
            id="night-mode-toggle-btn"
            type="button"
            aria-pressed={uiTheme !== 'standard'}
            onClick={onCycleUiTheme}
            className={`min-w-[36px] min-h-[36px] p-2 rounded-xl transition-all border flex items-center justify-center backdrop-blur-md active:scale-95 ${
              uiTheme === 'red-night'
                ? 'bg-red-500/20 text-red-300 border-red-400/55 shadow-[0_0_14px_rgba(220,38,38,0.28),inset_0_1px_0_rgba(255,255,255,0.16)]'
                : uiTheme === 'sepia-night'
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/55 shadow-[0_0_14px_rgba(217,119,6,0.25),inset_0_1px_0_rgba(255,255,255,0.16)]'
                  : 'glass-surface text-neutral-300 hover:text-white'
            }`}
            title={`${t.common.nightModeToggleHint} (${
              uiTheme === 'red-night'
                ? t.common.themeRedNight
                : uiTheme === 'sepia-night'
                  ? t.common.themeSepiaNight
                  : t.common.themeStandard
            })`}
            aria-label={t.common.nightModeToggleHint}
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            id="voice-control-toggle-btn"
            type="button"
            aria-pressed={voiceListening}
            onClick={onToggleVoice}
            className={`min-w-[36px] min-h-[36px] p-2 rounded-xl transition-all border flex items-center justify-center relative backdrop-blur-md active:scale-95 ${
              voiceListening
                ? 'bg-amber-500/22 text-amber-300 border-amber-400/60 shadow-[0_0_16px_rgba(245,158,11,0.32),inset_0_1px_0_rgba(255,255,255,0.22)]'
                : 'glass-surface text-neutral-300 hover:text-white'
            }`}
            title={voiceListening ? t.common.voiceStopHint : t.common.voiceStartHint}
            aria-label={voiceListening ? t.common.voiceStopHint : t.common.voiceStartHint}
          >
            <Mic
              className={`w-4 h-4 ${voiceListening ? 'animate-pulse text-amber-300' : ''}`}
              aria-hidden="true"
            />
          </button>

          <button
            id="sound-toggle-btn"
            type="button"
            onClick={onToggleSound}
            className={`min-w-[36px] min-h-[36px] p-2 rounded-xl transition-all border flex items-center justify-center backdrop-blur-md active:scale-95 ${
              soundEnabled
                ? 'bg-amber-500/14 text-amber-300 border-amber-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]'
                : 'glass-surface text-neutral-400 hover:text-neutral-200'
            }`}
            title={soundEnabled ? t.sosMode.soundOn : t.sosMode.soundOff}
            aria-label={soundEnabled ? t.sosMode.soundOn : t.sosMode.soundOff}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            id="haptic-toggle-btn"
            type="button"
            onClick={onToggleHaptic}
            className={`min-w-[36px] min-h-[36px] p-2 rounded-xl transition-all border flex items-center justify-center backdrop-blur-md active:scale-95 ${
              hapticEnabled
                ? 'bg-amber-500/14 text-amber-300 border-amber-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]'
                : 'glass-surface text-neutral-400 hover:text-neutral-200'
            }`}
            title={t.common.haptic}
            aria-label={t.common.haptic}
          >
            <Smartphone className="w-4 h-4" />
          </button>

          <button
            id="language-toggle-btn"
            type="button"
            onClick={onToggleLanguage}
            className="min-h-[36px] flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-surface text-neutral-100 text-xs font-medium active:scale-95 whitespace-nowrap shrink-0"
            title="Change language"
            aria-label="Change language"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400/90" />
            <span>{t.common.language}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
