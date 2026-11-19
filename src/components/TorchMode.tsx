import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  Lightbulb,
  CheckCircle2,
  Vibrate,
  AlertCircle,
  Compass,
  Sun,
  SunDim,
  ShieldCheck,
  SunMoon,
  Eye,
  Smartphone,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AmbientLightCategory,
  Language,
  ProximitySensorMode,
  ProximityTriggerReason,
  ShakeSensitivity,
  TimerDuration,
  TorchHapticPattern,
  TorchIntensityCapability,
  TorchLightingPreset,
  TorchUsageEntry,
  UiTheme,
  WidgetLayoutVariant,
} from '../types';
import { translations } from '../utils/translations';
import { PowerButton } from './PowerButton';
import { CompassOverlay } from './CompassOverlay';
import { LightingPresetsCard } from './LightingPresetsCard';
import { HomescreenWidgetCard } from './HomescreenWidgetCard';
import { UsageHistoryCard } from './UsageHistoryCard';
import { QuickActionsCard } from './QuickActionsCard';
import { BatteryStatus } from '../hooks/useBatteryStatus';
import { PWAInstallState } from '../hooks/usePWAInstall';
import {
  isOrientationSupported,
  requestOrientationPermission,
  startCompassListener,
} from '../utils/compass';
import {
  triggerHaptic,
  previewTorchHapticPattern,
  isHapticSupported,
  TORCH_HAPTIC_PATTERNS,
  HAPTIC_PATTERNS,
} from '../utils/audio';

interface TorchModeProps {
  isOn: boolean;
  onToggle: () => void;
  language: Language;
  hasHardwareTorch: boolean;
  torchIntensity: number;
  onChangeTorchIntensity: (intensity: number) => void;
  torchIntensityCapability: TorchIntensityCapability;
  hardwareStepInfo: { current: number; max: number } | null;
  torchError: string | null;
  onTimerChange?: (duration: TimerDuration) => void;
  timerRemaining: number | null;
  activeTimer: TimerDuration;
  hapticEnabled?: boolean;
  onEnableHaptic?: () => void;
  torchHapticPattern: TorchHapticPattern;
  onChangeTorchHapticPattern: (pattern: TorchHapticPattern) => void;
  shakeEnabled: boolean;
  onToggleShake: () => void;
  shakeSensitivity: ShakeSensitivity;
  onChangeShakeSensitivity: (sensitivity: ShakeSensitivity) => void;
  shakeError: string | null;
  shakeTriggeredRecently: boolean;
  proximityAutoOffEnabled: boolean;
  onToggleProximityAutoOff: () => void;
  proximitySensorMode: ProximitySensorMode;
  proximityError: string | null;
  proximityTriggeredReason: ProximityTriggerReason | null;
  ambientSensorEnabled: boolean;
  onToggleAmbientSensor: () => void;
  ambientLevel: number | null;
  ambientCategory: AmbientLightCategory | null;
  ambientSensorPaused: boolean;
  ambientError: string | null;
  uiTheme: UiTheme;
  onChangeUiTheme: (theme: UiTheme) => void;
  customLightingPresets: TorchLightingPreset[];
  onSaveLightingPreset: (name: string, intensity: number) => void;
  onDeleteLightingPreset: (presetId: string) => void;
  usageAccumulatedMs: number;
  usageActiveStartedAt: number | null;
  usageEntries: TorchUsageEntry[];
  onResetUsageHistory: () => void;
  battery: BatteryStatus;
  pwaInstall: PWAInstallState;
  widgetLayout: WidgetLayoutVariant;
  onChangeWidgetLayout: (layout: WidgetLayoutVariant) => void;
  widgetAutoStart: boolean;
  onToggleWidgetAutoStart: () => void;
  onEnterWidgetMode: () => void;
  onQuickSos: () => void;
  onQuickScreenLight: () => void;
}

export const TorchMode: React.FC<TorchModeProps> = ({
  isOn,
  onToggle,
  language,
  hasHardwareTorch,
  torchIntensity,
  onChangeTorchIntensity,
  torchIntensityCapability,
  hardwareStepInfo,
  torchError,
  onTimerChange,
  timerRemaining,
  activeTimer,
  hapticEnabled = true,
  onEnableHaptic,
  torchHapticPattern,
  onChangeTorchHapticPattern,
  shakeEnabled,
  onToggleShake,
  shakeSensitivity,
  onChangeShakeSensitivity,
  shakeError,
  shakeTriggeredRecently,
  proximityAutoOffEnabled,
  onToggleProximityAutoOff,
  proximitySensorMode,
  proximityError,
  proximityTriggeredReason,
  ambientSensorEnabled,
  onToggleAmbientSensor,
  ambientLevel,
  ambientCategory,
  ambientSensorPaused,
  ambientError,
  uiTheme,
  onChangeUiTheme,
  customLightingPresets,
  onSaveLightingPreset,
  onDeleteLightingPreset,
  usageAccumulatedMs,
  usageActiveStartedAt,
  usageEntries,
  onResetUsageHistory,
  battery,
  pwaInstall,
  widgetLayout,
  onChangeWidgetLayout,
  widgetAutoStart,
  onToggleWidgetAutoStart,
  onEnterWidgetMode,
  onQuickSos,
  onQuickScreenLight,
}) => {
  const t = translations[language];
  const prefersReducedMotion = useReducedMotion();

  const themeAccentHex =
    uiTheme === 'red-night'
      ? '#DC2626'
      : uiTheme === 'sepia-night'
        ? '#D97706'
        : '#F59E0B';
  const themeAccentRgb =
    uiTheme === 'red-night'
      ? '220, 38, 38'
      : uiTheme === 'sepia-night'
        ? '217, 119, 6'
        : '245, 158, 11';

  // Compass overlay state
  const [compassEnabled, setCompassEnabled] = useState<boolean>(false);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [compassUnavailable, setCompassUnavailable] = useState<boolean>(false);
  const [compassError, setCompassError] = useState<string | null>(null);

  const handleToggleCompass = useCallback(async () => {
    if (compassEnabled) {
      setCompassEnabled(false);
      setCompassHeading(null);
      setCompassUnavailable(false);
      setCompassError(null);
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
      return;
    }

    setCompassError(null);
    setCompassUnavailable(false);

    if (!isOrientationSupported()) {
      setCompassEnabled(true);
      setCompassUnavailable(true);
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
      return;
    }

    const perm = await requestOrientationPermission();
    if (perm === 'denied') {
      setCompassError(t.torchMode.compassPermissionDenied);
      setCompassEnabled(true);
      return;
    }

    setCompassEnabled(true);
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
  }, [compassEnabled, hapticEnabled, t.torchMode.compassPermissionDenied]);

  useEffect(() => {
    if (!compassEnabled || compassError) return;

    const stopCompass = startCompassListener({
      onHeading: (deg) => {
        setCompassUnavailable(false);
        setCompassHeading(deg);
      },
      onUnavailable: () => {
        setCompassUnavailable(true);
      },
    });

    return () => {
      stopCompass();
    };
  }, [compassEnabled, compassError]);

  // Timer presets (Off, 1, 5, 10, 15, and 30 minutes)
  const timerOptions: { duration: TimerDuration; label: string }[] = [
    { duration: 0, label: t.torchMode.timerOff },
    { duration: 60, label: `1 ${t.torchMode.min}` },
    { duration: 300, label: `5 ${t.torchMode.min}` },
    { duration: 600, label: `10 ${t.torchMode.min}` },
    { duration: 900, label: `15 ${t.torchMode.min}` },
    { duration: 1800, label: `30 ${t.torchMode.min}` },
  ];

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Variable luminosity capability: enabled on hardware with variable torch levels OR in screen-torch fallback
  const isHardwareVariable = hasHardwareTorch && torchIntensityCapability.supported;
  const isHardwareFixedOnly = hasHardwareTorch && !torchIntensityCapability.supported;
  const canAdjustIntensity = !isHardwareFixedOnly;
  const effectiveIntensity = isHardwareFixedOnly ? 1 : torchIntensity;
  const intensityPercent = Math.round(effectiveIntensity * 100);
  const sliderFillPercent = Math.max(0, Math.min(100, ((intensityPercent - 10) / 90) * 100));
  const lastStepRef = useRef<number | null>(hardwareStepInfo?.current ?? null);

  const intensityPresets = [
    { value: 0.25, label: '25%' },
    { value: 0.5, label: '50%' },
    { value: 0.75, label: '75%' },
    { value: 1.0, label: '100%' },
  ];

  // Soft 'breath' transition state when dragging or toggling LED intensity presets
  const [isSliderDragging, setIsSliderDragging] = useState<boolean>(false);
  const [isIntensityBreathing, setIsIntensityBreathing] = useState<boolean>(false);
  const [intensityBreathCycle, setIntensityBreathCycle] = useState<number>(0);
  const breathTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIntensityRef = useRef<number>(effectiveIntensity);

  const triggerIntensityBreath = useCallback(() => {
    setIsIntensityBreathing(true);
    setIntensityBreathCycle((c) => c + 1);
    if (breathTimerRef.current) clearTimeout(breathTimerRef.current);
    breathTimerRef.current = setTimeout(() => {
      setIsIntensityBreathing(false);
    }, 760);
  }, []);

  useEffect(() => {
    if (Math.abs(prevIntensityRef.current - effectiveIntensity) >= 0.005) {
      prevIntensityRef.current = effectiveIntensity;
      triggerIntensityBreath();
    }
  }, [effectiveIntensity, triggerIntensityBreath]);

  useEffect(() => {
    return () => {
      if (breathTimerRef.current) clearTimeout(breathTimerRef.current);
    };
  }, []);

  const handleSliderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canAdjustIntensity) return;
    const nextPercent = Number(e.target.value);
    const nextNormalized = Math.min(1, Math.max(0.1, nextPercent / 100));
    onChangeTorchIntensity(nextNormalized);

    if (hapticEnabled && hardwareStepInfo) {
      if (lastStepRef.current !== null && lastStepRef.current !== hardwareStepInfo.current) {
        triggerHaptic(HAPTIC_PATTERNS.tap);
      }
      lastStepRef.current = hardwareStepInfo.current;
    }
  };

  const handlePresetClick = (value: number) => {
    if (!canAdjustIntensity) return;
    triggerIntensityBreath();
    onChangeTorchIntensity(value);
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
  };

  return (
    <div className="flex flex-col items-center justify-between w-full max-w-md mx-auto px-4 py-3 min-h-[calc(100vh-140px)] select-none">
      {/* Top Area: Compass Overlay (when toggled ON) or Flashlight Beam Simulation */}
      <div className="relative w-full min-h-[8rem] flex flex-col items-center justify-start">
        <AnimatePresence mode="wait">
          {compassEnabled ? (
            <CompassOverlay
              key="compass-overlay"
              heading={compassHeading}
              sensorUnavailable={compassUnavailable}
              error={compassError}
              language={language}
              onClose={() => void handleToggleCompass()}
            />
          ) : (
            <div
              key="beam-simulation"
              className="relative w-full h-32 flex flex-col items-center justify-start overflow-hidden pointer-events-none"
            >
              {/* Flashlight head representation */}
              <div className="w-24 h-5 glass-pill rounded-t-xl border-b-0 flex items-center justify-center z-10">
                <motion.div
                  className={`w-12 h-1.5 rounded-full transition-colors duration-200 ${
                    isOn
                      ? uiTheme === 'red-night'
                        ? 'bg-red-400'
                        : 'bg-amber-300'
                      : 'bg-neutral-600'
                  }`}
                  animate={
                    isOn
                      ? prefersReducedMotion
                        ? { opacity: 0.45 + effectiveIntensity * 0.55 }
                        : {
                            opacity: [
                              0.42 + effectiveIntensity * 0.43,
                              0.55 + effectiveIntensity * 0.45,
                              0.42 + effectiveIntensity * 0.43,
                            ],
                            scaleX: [0.96, 1.05, 0.96],
                          }
                      : { opacity: 1, scaleX: 1 }
                  }
                  transition={
                    isOn && !prefersReducedMotion
                      ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.2 }
                  }
                  style={
                    isOn
                      ? {
                          boxShadow: `0 0 ${Math.round(8 + effectiveIntensity * 18)}px rgba(${themeAccentRgb}, ${(0.45 + effectiveIntensity * 0.55).toFixed(2)})`,
                        }
                      : undefined
                  }
                />
              </div>

              {/* Dynamic Light Beam Cone scaled by LED intensity */}
              <motion.div
                className="w-full h-full origin-top flex justify-center"
                animate={
                  isOn
                    ? prefersReducedMotion
                      ? { opacity: 0.24 + effectiveIntensity * 0.76 }
                      : {
                          opacity: [
                            0.18 + effectiveIntensity * 0.64,
                            0.28 + effectiveIntensity * 0.72,
                            0.18 + effectiveIntensity * 0.64,
                          ],
                        }
                    : { opacity: 0 }
                }
                transition={
                  isOn && !prefersReducedMotion
                    ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.25 }
                }
              >
                <div
                  className="w-full h-full blur-md"
                  style={{
                    background: `linear-gradient(to bottom, rgba(${themeAccentRgb}, 0.48), rgba(${themeAccentRgb}, 0.14) 52%, transparent 100%)`,
                    clipPath: 'polygon(35% 0%, 65% 0%, 95% 100%, 5% 100%)',
                  }}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Switch Area */}
      <div className="flex flex-col items-center my-auto">
        {/* Subtle CSS Glow Ring around Active Torch Button */}
        <div
          id="torch-button-glow-wrap"
          className="relative flex items-center justify-center"
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-4 w-48 h-48 sm:w-56 sm:h-56 rounded-full torch-btn-glow-ring ${
              isOn ? 'torch-btn-glow-ring--active' : ''
            }`}
            style={{
              background: isOn
                ? `radial-gradient(circle, rgba(${themeAccentRgb}, ${(0.14 + effectiveIntensity * 0.16).toFixed(2)}) 0%, rgba(${themeAccentRgb}, 0.05) 55%, transparent 75%)`
                : 'transparent',
            }}
          />
          <PowerButton
            isOn={isOn}
            onToggle={onToggle}
            label={isOn ? t.torchMode.statusOn : t.torchMode.statusOff}
            size="large"
            accentColor={themeAccentHex}
            hapticEnabled={hapticEnabled}
          />
        </div>

        {/* Animated Pulsing & Glowing Active Status Indicator */}
        <motion.div
          id="torch-active-status-indicator"
          role="status"
          aria-live="polite"
          animate={
            isOn
              ? prefersReducedMotion
                ? {
                    boxShadow: `0 0 22px rgba(${themeAccentRgb}, ${(0.28 + effectiveIntensity * 0.28).toFixed(2)}), inset 0 1px 0 rgba(255,255,255,0.22)`,
                  }
                : {
                    boxShadow: [
                      `0 0 14px rgba(${themeAccentRgb}, ${(0.22 + effectiveIntensity * 0.18).toFixed(2)}), inset 0 1px 0 rgba(255,255,255,0.18)`,
                      `0 0 30px rgba(${themeAccentRgb}, ${(0.42 + effectiveIntensity * 0.34).toFixed(2)}), inset 0 1px 0 rgba(255,255,255,0.34)`,
                      `0 0 14px rgba(${themeAccentRgb}, ${(0.22 + effectiveIntensity * 0.18).toFixed(2)}), inset 0 1px 0 rgba(255,255,255,0.18)`,
                    ],
                  }
              : {
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255,255,255,0.08)',
                }
          }
          transition={
            isOn && !prefersReducedMotion
              ? { duration: 1.9, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.28 }
          }
          className="mt-2.5 flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-medium glass-pill border transition-colors duration-300 relative overflow-hidden"
          style={{
            borderColor: isOn ? `rgba(${themeAccentRgb}, 0.65)` : 'rgba(255, 255, 255, 0.14)',
            backgroundColor: isOn ? `rgba(${themeAccentRgb}, 0.14)` : undefined,
          }}
        >
          {/* Soft internal shimmer sweep while flashlight is active */}
          {isOn && !prefersReducedMotion && (
            <motion.span
              aria-hidden="true"
              initial={{ x: '-120%' }}
              animate={{ x: '220%' }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }}
              className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12"
              style={{
                background: `linear-gradient(90deg, transparent, rgba(${themeAccentRgb}, 0.24), transparent)`,
              }}
            />
          )}

          {/* Dual-Ring Pulsing Beacon Dot */}
          <span className="relative flex h-3 w-3 items-center justify-center shrink-0">
            {isOn && !prefersReducedMotion && (
              <motion.span
                aria-hidden="true"
                initial={{ scale: 0.9, opacity: 0.85 }}
                animate={{ scale: 2.4, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: themeAccentHex }}
              />
            )}
            <motion.span
              aria-hidden="true"
              animate={
                isOn && !prefersReducedMotion
                  ? { scale: [1, 1.22, 1], opacity: [0.9, 1, 0.9] }
                  : { scale: 1, opacity: 1 }
              }
              transition={
                isOn && !prefersReducedMotion
                  ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 0.2 }
              }
              className="relative inline-flex h-2.5 w-2.5 rounded-full transition-colors duration-200"
              style={{
                backgroundColor: isOn ? themeAccentHex : '#52525b',
                boxShadow: isOn
                  ? `0 0 10px ${themeAccentHex}, 0 0 4px #ffffff`
                  : 'none',
              }}
            />
          </span>

          {/* Hardware / Screen Torch Icon + Live Text */}
          <span className="relative z-10 flex items-center gap-1.5">
            {hasHardwareTorch ? (
              <CheckCircle2
                className={`w-3.5 h-3.5 shrink-0 ${isOn ? 'text-emerald-300' : 'text-emerald-400/75'}`}
                aria-hidden="true"
              />
            ) : (
              <Lightbulb
                className={`w-3.5 h-3.5 shrink-0 ${isOn ? 'text-amber-300' : 'text-amber-400/70'}`}
                aria-hidden="true"
              />
            )}
            <span className={isOn ? 'text-white font-semibold' : 'text-neutral-300'}>
              {hasHardwareTorch
                ? t.torchMode.hardwareTorchActive
                : t.torchMode.screenTorchFallback}
            </span>
          </span>

          {/* Animated Luminous Output Meter when Active */}
          <AnimatePresence initial={false}>
            {isOn && (
              <motion.span
                key="active-output-pill"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.18 }}
                className="relative z-10 inline-flex items-center gap-1.5 pl-2 border-l border-white/15 font-mono tabular-nums text-[11px] font-bold"
                style={{ color: uiTheme === 'red-night' ? '#fca5a5' : '#fde68a' }}
              >
                <span className="inline-flex items-end gap-[2px] h-3" aria-hidden="true">
                  {[0.55, 1, 0.72].map((barPeak, idx) => (
                    <motion.span
                      key={idx}
                      className="w-[2.5px] rounded-full"
                      style={{ backgroundColor: themeAccentHex }}
                      animate={
                        prefersReducedMotion
                          ? { height: `${Math.round(barPeak * 10)}px` }
                          : {
                              height: [
                                `${Math.max(3, Math.round(barPeak * 5))}px`,
                                `${Math.max(5, Math.round(barPeak * (6 + effectiveIntensity * 6)))}px`,
                                `${Math.max(3, Math.round(barPeak * 5))}px`,
                              ],
                            }
                      }
                      transition={{
                        duration: 1.1 + idx * 0.18,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </span>
                <span>{intensityPercent}%</span>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        {torchError && (
          <p className="mt-1 text-[11px] text-amber-500/90 text-center max-w-xs px-2">
            {t.torchMode.noTorchWarning}
          </p>
        )}

        {shakeTriggeredRecently && (
          <p
            role="status"
            aria-live="polite"
            className="mt-1.5 text-xs font-medium text-amber-300 text-center"
          >
            {t.torchMode.shakeTriggered}
          </p>
        )}

        {proximityTriggeredReason && (
          <div
            role="status"
            aria-live="polite"
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 text-center max-w-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>
              {proximityTriggeredReason === 'proximity'
                ? t.torchMode.proximityTriggeredPocket
                : t.torchMode.proximityTriggeredFaceDown}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Controls: LED Intensity, Compass Overlay, Shake-to-Toggle & Auto-Off Timer */}
      <div className="w-full space-y-3 mt-4">
        {/* Variable LED Intensity Slider Card with Soft Breath Transition */}
        <div
          id="torch-intensity-card"
          className={`w-full glass-panel rounded-2xl p-3.5 space-y-3 relative overflow-hidden torch-intensity-card-transition ${
            isIntensityBreathing || isSliderDragging ? 'torch-intensity-card--breathing' : ''
          }`}
        >
          {/* Soft breathing radial luminescence inside slider card */}
          <div
            key={intensityBreathCycle}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out"
            style={{
              opacity: isIntensityBreathing || isSliderDragging ? 0.24 + effectiveIntensity * 0.26 : 0,
              background: `radial-gradient(ellipse at ${Math.max(12, sliderFillPercent)}% 62%, rgba(${themeAccentRgb}, 0.34), transparent 68%)`,
            }}
          />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-500 ease-out ${
                  isOn && canAdjustIntensity
                    ? 'bg-amber-500/18 text-amber-300 border-amber-400/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                    : 'glass-surface text-amber-400/85'
                }`}
                style={
                  isIntensityBreathing || isSliderDragging
                    ? {
                        boxShadow: `0 0 14px rgba(${themeAccentRgb}, 0.42), inset 0 1px 0 rgba(255,255,255,0.25)`,
                        transform: 'scale(1.06)',
                      }
                    : undefined
                }
              >
                <Sun className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white leading-tight truncate">
                  {t.torchMode.intensityTitle}
                </div>
                <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
                  {isHardwareVariable
                    ? t.torchMode.intensitySubtitleHardware
                    : isHardwareFixedOnly
                      ? t.torchMode.intensityFixedNotice
                      : t.torchMode.intensitySubtitleScreen}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end shrink-0">
              <span
                className="font-mono tabular-nums text-sm font-bold text-amber-400 leading-none transition-all duration-400 ease-out"
                style={
                  isIntensityBreathing || isSliderDragging
                    ? {
                        transform: 'scale(1.08)',
                        textShadow: `0 0 12px rgba(${themeAccentRgb}, 0.65)`,
                      }
                    : undefined
                }
              >
                {intensityPercent}%
              </span>
              {isHardwareVariable && hardwareStepInfo && (
                <span className="mt-1 font-mono tabular-nums text-[10px] font-medium text-neutral-400">
                  {t.torchMode.intensityLevel} {hardwareStepInfo.current}/{hardwareStepInfo.max}
                </span>
              )}
            </div>
          </div>

          {/* Slider Track */}
          <div className={`relative z-10 space-y-2 ${isHardwareFixedOnly ? 'opacity-50' : ''}`}>
            <div className="relative flex items-center gap-2.5">
              <SunDim className="w-4 h-4 text-neutral-500 shrink-0" aria-hidden="true" />
              <div className="relative flex-1 flex items-center h-9">
                <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden pointer-events-none">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300 ${
                      isSliderDragging ? 'transition-[width] duration-75' : 'torch-slider-fill-breath'
                    }`}
                    style={{
                      width: `${sliderFillPercent}%`,
                      filter:
                        isIntensityBreathing || isSliderDragging
                          ? `drop-shadow(0 0 8px rgba(${themeAccentRgb}, 0.7))`
                          : 'none',
                    }}
                  />
                </div>
                <input
                  id="torch-intensity-slider"
                  type="range"
                  min={10}
                  max={100}
                  step={1}
                  value={intensityPercent}
                  disabled={!canAdjustIntensity}
                  onPointerDown={() => {
                    if (!canAdjustIntensity) return;
                    setIsSliderDragging(true);
                    triggerIntensityBreath();
                  }}
                  onPointerUp={() => setIsSliderDragging(false)}
                  onPointerCancel={() => setIsSliderDragging(false)}
                  onBlur={() => setIsSliderDragging(false)}
                  onChange={handleSliderInput}
                  aria-label={t.torchMode.intensityTitle}
                  aria-valuemin={10}
                  aria-valuemax={100}
                  aria-valuenow={intensityPercent}
                  aria-valuetext={`${intensityPercent}%`}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                />
                {/* Visual thumb indicator synced to slider position with soft breath halo */}
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 shadow-md ${
                    isSliderDragging
                      ? 'transition-[left] duration-75 scale-115'
                      : 'torch-slider-thumb-breath'
                  } ${
                    isIntensityBreathing && !isSliderDragging
                      ? 'torch-slider-thumb-breath--active'
                      : ''
                  } ${
                    isOn
                      ? 'bg-amber-300 border-neutral-950 shadow-amber-400/50'
                      : 'bg-white border-neutral-900'
                  }`}
                  style={{
                    left: `${sliderFillPercent}%`,
                    boxShadow:
                      isIntensityBreathing || isSliderDragging
                        ? `0 0 14px rgba(${themeAccentRgb}, 0.72)`
                        : undefined,
                  }}
                />
              </div>
              <Sun className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            </div>

            {/* Quick Intensity Step Presets */}
            <div className="grid grid-cols-4 gap-1.5">
              {intensityPresets.map((preset) => {
                const isSelected = Math.abs(effectiveIntensity - preset.value) < 0.03;
                return (
                  <button
                    key={preset.label}
                    id={`torch-intensity-preset-${Math.round(preset.value * 100)}`}
                    type="button"
                    disabled={!canAdjustIntensity}
                    aria-pressed={isSelected}
                    onClick={() => handlePresetClick(preset.value)}
                    className={`min-h-[34px] py-1 px-2 rounded-xl text-[11px] font-mono tabular-nums font-medium transition-all border whitespace-nowrap disabled:cursor-not-allowed active:scale-95 ${
                      isSelected
                        ? 'bg-amber-500/90 text-neutral-950 border-amber-300/70 font-semibold shadow-[0_4px_14px_rgba(245,158,11,0.32),inset_0_1px_0_rgba(255,255,255,0.45)]'
                        : 'glass-surface text-neutral-200 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Named Lighting Presets Card (Save & Load Brightness Levels) */}
        <LightingPresetsCard
          language={language}
          currentIntensity={effectiveIntensity}
          onSelectIntensity={onChangeTorchIntensity}
          customPresets={customLightingPresets}
          onSavePreset={onSaveLightingPreset}
          onDeletePreset={onDeleteLightingPreset}
          disabled={!canAdjustIntensity}
          hapticEnabled={hapticEnabled}
        />

        {/* Homescreen Torch Widget Layout & Instant Shortcut Card */}
        <HomescreenWidgetCard
          language={language}
          layout={widgetLayout}
          onChangeLayout={onChangeWidgetLayout}
          widgetAutoStart={widgetAutoStart}
          onToggleWidgetAutoStart={onToggleWidgetAutoStart}
          isTorchOn={isOn}
          onToggleTorch={onToggle}
          torchIntensity={effectiveIntensity}
          onChangeIntensity={onChangeTorchIntensity}
          canAdjustIntensity={canAdjustIntensity}
          hasHardwareTorch={hasHardwareTorch}
          battery={battery}
          uiTheme={uiTheme}
          pwaInstall={pwaInstall}
          onEnterWidgetMode={onEnterWidgetMode}
          onQuickSos={onQuickSos}
          onQuickScreenLight={onQuickScreenLight}
        />

        {/* Front-Camera Ambient Light Auto-Suggest Card */}
        <div className="w-full glass-panel rounded-2xl p-3.5 space-y-2.5">
          <button
            id="ambient-light-sensor-switch"
            type="button"
            role="switch"
            aria-checked={ambientSensorEnabled}
            onClick={onToggleAmbientSensor}
            className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                  ambientSensorEnabled
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                    : 'glass-surface text-neutral-300'
                }`}
              >
                <SunMoon className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white leading-tight truncate">
                  {t.torchMode.ambientTitle}
                </div>
                <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
                  {t.torchMode.ambientSubtitle}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[11px] font-semibold ${
                  ambientSensorEnabled ? 'text-indigo-300' : 'text-neutral-500'
                }`}
              >
                {ambientSensorEnabled ? t.torchMode.shakeOn : t.torchMode.shakeOff}
              </span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  ambientSensorEnabled ? 'bg-indigo-500' : 'bg-neutral-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
                    ambientSensorEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </span>
            </div>
          </button>

          {ambientSensorEnabled && (
            <div className="pt-2 border-t border-neutral-800/80 space-y-1.5">
              {ambientSensorPaused ? (
                <p className="text-[11px] text-neutral-400">
                  {t.torchMode.ambientPaused}
                </p>
              ) : ambientLevel === null ? (
                <p className="text-[11px] text-indigo-300/90">
                  {t.torchMode.ambientCalibrating}
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className={`font-semibold ${
                        ambientCategory === 'dark'
                          ? 'text-indigo-300'
                          : ambientCategory === 'dim'
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                      }`}
                    >
                      {ambientCategory === 'dark'
                        ? t.torchMode.ambientDark
                        : ambientCategory === 'dim'
                          ? t.torchMode.ambientDim
                          : t.torchMode.ambientBright}
                    </span>
                    <span className="font-mono tabular-nums text-neutral-300 font-semibold">
                      {ambientLevel}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        ambientCategory === 'dark'
                          ? 'bg-indigo-400'
                          : ambientCategory === 'dim'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.max(4, ambientLevel)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {ambientError && (
            <div
              role="alert"
              className="flex items-start gap-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-2"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>{ambientError}</span>
            </div>
          )}
        </div>

        {/* Pocket & Face-Down Proximity Auto-Off Card */}
        <div className="w-full glass-panel rounded-2xl p-3.5 space-y-2.5">
          <button
            id="proximity-auto-off-switch"
            type="button"
            role="switch"
            aria-checked={proximityAutoOffEnabled}
            onClick={onToggleProximityAutoOff}
            className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                  proximityAutoOffEnabled
                    ? 'bg-amber-500/18 text-amber-300 border-amber-400/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                    : 'glass-surface text-neutral-300'
                }`}
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white leading-tight truncate">
                  {t.torchMode.proximityTitle}
                </div>
                <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
                  {t.torchMode.proximitySubtitle}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[11px] font-semibold ${
                  proximityAutoOffEnabled ? 'text-amber-400' : 'text-neutral-500'
                }`}
              >
                {proximityAutoOffEnabled ? t.torchMode.shakeOn : t.torchMode.shakeOff}
              </span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  proximityAutoOffEnabled ? 'bg-amber-500' : 'bg-neutral-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
                    proximityAutoOffEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </span>
            </div>
          </button>

          {proximityAutoOffEnabled && (
            <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2 text-[11px]">
              <span
                className={`font-medium ${
                  isOn ? 'text-emerald-400' : 'text-neutral-400'
                }`}
              >
                {isOn ? t.torchMode.proximityMonitoring : t.torchMode.proximityStandby}
              </span>
              <span className="text-neutral-500 truncate">
                {proximitySensorMode === 'hardware-proximity'
                  ? t.torchMode.proximitySensorHardware
                  : t.torchMode.proximitySensorOrientation}
              </span>
            </div>
          )}

          {proximityError && (
            <div
              role="alert"
              className="flex items-start gap-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-2"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>{proximityError}</span>
            </div>
          )}
        </div>

        {/* Compass Overlay Toggle Card */}
        <div className="w-full glass-panel rounded-2xl p-3.5">
          <button
            id="compass-overlay-toggle-switch"
            type="button"
            role="switch"
            aria-checked={compassEnabled}
            onClick={() => void handleToggleCompass()}
            className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                  compassEnabled
                    ? 'bg-amber-500/18 text-amber-300 border-amber-400/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                    : 'glass-surface text-neutral-300'
                }`}
              >
                <Compass className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white leading-tight truncate">
                  {t.torchMode.compassTitle}
                </div>
                <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
                  {t.torchMode.compassSubtitle}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[11px] font-semibold ${
                  compassEnabled ? 'text-amber-400' : 'text-neutral-500'
                }`}
              >
                {compassEnabled ? t.torchMode.shakeOn : t.torchMode.shakeOff}
              </span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  compassEnabled ? 'bg-amber-500' : 'bg-white/15'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
                    compassEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </span>
            </div>
          </button>
        </div>

        {/* Shake to Toggle Card */}
        <div className="w-full glass-panel rounded-2xl p-3.5 space-y-3">
          <button
            id="shake-to-toggle-switch"
            type="button"
            role="switch"
            aria-checked={shakeEnabled}
            onClick={onToggleShake}
            className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                  shakeEnabled
                    ? 'bg-amber-500/18 text-amber-300 border-amber-400/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                    : 'glass-surface text-neutral-300'
                }`}
              >
                <Vibrate className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white leading-tight truncate">
                  {t.torchMode.shakeTitle}
                </div>
                <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
                  {t.torchMode.shakeSubtitle}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[11px] font-semibold ${
                  shakeEnabled ? 'text-amber-400' : 'text-neutral-500'
                }`}
              >
                {shakeEnabled ? t.torchMode.shakeOn : t.torchMode.shakeOff}
              </span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  shakeEnabled ? 'bg-amber-500' : 'bg-neutral-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
                    shakeEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </span>
            </div>
          </button>

          {shakeEnabled && (
            <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-neutral-300 whitespace-nowrap">
                {t.torchMode.shakeSensitivity}
              </span>
              <div className="inline-flex items-center gap-1 p-1 rounded-xl glass-input">
                {(
                  [
                    { id: 'low', label: t.torchMode.shakeLow },
                    { id: 'medium', label: t.torchMode.shakeMedium },
                    { id: 'high', label: t.torchMode.shakeHigh },
                  ] as { id: ShakeSensitivity; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    id={`shake-sensitivity-${opt.id}`}
                    type="button"
                    aria-pressed={shakeSensitivity === opt.id}
                    onClick={() => onChangeShakeSensitivity(opt.id)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                      shakeSensitivity === opt.id
                        ? 'bg-amber-500/90 text-neutral-950 font-semibold shadow-sm'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {shakeError && (
            <div
              role="alert"
              className="flex items-start gap-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-2"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>{shakeError}</span>
            </div>
          )}
        </div>

        {/* Auto-Off Timer Card */}
        <div className="w-full glass-panel rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between text-xs text-neutral-200">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              {t.torchMode.timerTitle}
            </span>
            {timerRemaining !== null && timerRemaining > 0 ? (
              <span className="font-mono tabular-nums text-amber-300 font-bold bg-amber-500/15 px-2 py-0.5 rounded-lg border border-amber-400/35">
                {t.torchMode.timerRemaining} {formatTime(timerRemaining)}
              </span>
            ) : (
              activeTimer > 0 && (
                <span className="font-mono tabular-nums text-neutral-300 text-[11px]">
                  {formatTime(activeTimer)}
                </span>
              )
            )}
          </div>

          {/* Timer selector preset buttons */}
          <div className="grid grid-cols-3 gap-2">
            {timerOptions.map((opt) => (
              <button
                id={`timer-option-${opt.duration}`}
                key={opt.duration}
                type="button"
                onClick={() => onTimerChange?.(opt.duration)}
                aria-pressed={activeTimer === opt.duration}
                className={`min-h-[42px] py-2 px-2 rounded-xl text-xs font-medium transition-all text-center border whitespace-nowrap active:scale-95 ${
                  activeTimer === opt.duration
                    ? 'bg-amber-500/90 text-neutral-950 border-amber-300/75 font-semibold shadow-[0_4px_14px_rgba(245,158,11,0.3),inset_0_1px_0_rgba(255,255,255,0.4)]'
                    : 'glass-surface text-neutral-200 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Torch Haptic Vibration Pattern Selector Card (Subtle, Standard, Intense) */}
        <div
          id="torch-haptic-pattern-card"
          className="w-full glass-panel rounded-2xl p-3.5 space-y-3"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                  hapticEnabled
                    ? 'bg-amber-500/18 text-amber-300 border-amber-400/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                    : 'glass-surface text-neutral-400'
                }`}
              >
                <Smartphone className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white leading-tight truncate">
                  {t.torchMode.hapticPatternTitle}
                </div>
                <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
                  {t.torchMode.hapticPatternSubtitle}
                </div>
              </div>
            </div>

            <button
              id="torch-haptic-test-btn"
              type="button"
              onClick={() => {
                if (!hapticEnabled && onEnableHaptic) {
                  onEnableHaptic();
                }
                previewTorchHapticPattern(torchHapticPattern);
              }}
              className="min-h-[32px] px-2.5 py-1 rounded-xl glass-surface border border-amber-400/35 text-[11px] font-semibold text-amber-300 hover:text-amber-200 shrink-0 active:scale-95 transition-all"
            >
              {t.torchMode.hapticTestBtn}
            </button>
          </div>

          {!hapticEnabled && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-400/25 text-[11px] text-amber-200/90">
              <span className="leading-snug">{t.torchMode.hapticDisabledHint}</span>
              {onEnableHaptic && (
                <button
                  id="torch-haptic-enable-btn"
                  type="button"
                  onClick={() => {
                    onEnableHaptic();
                    previewTorchHapticPattern(torchHapticPattern);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/90 text-neutral-950 font-semibold text-[11px] shrink-0 active:scale-95"
                >
                  {t.torchMode.hapticEnableAction}
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                {
                  id: 'subtle',
                  label: t.torchMode.hapticSubtle,
                  desc: t.torchMode.hapticSubtleDesc,
                  bars: [45],
                },
                {
                  id: 'standard',
                  label: t.torchMode.hapticStandard,
                  desc: t.torchMode.hapticStandardDesc,
                  bars: [55, 80],
                },
                {
                  id: 'intense',
                  label: t.torchMode.hapticIntense,
                  desc: t.torchMode.hapticIntenseDesc,
                  bars: [85, 100, 90],
                },
              ] as Array<{
                id: TorchHapticPattern;
                label: string;
                desc: string;
                bars: number[];
              }>
            ).map((opt) => {
              const selected = torchHapticPattern === opt.id;
              return (
                <button
                  key={opt.id}
                  id={`torch-haptic-option-${opt.id}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    if (!hapticEnabled && onEnableHaptic) {
                      onEnableHaptic();
                    }
                    onChangeTorchHapticPattern(opt.id);
                    previewTorchHapticPattern(opt.id);
                  }}
                  className={`min-h-[68px] px-2 py-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                    selected
                      ? 'bg-amber-500/90 text-neutral-950 border-amber-300/80 shadow-[0_4px_14px_rgba(245,158,11,0.3),inset_0_1px_0_rgba(255,255,255,0.45)]'
                      : 'glass-surface text-neutral-200 hover:text-white'
                  }`}
                >
                  {/* Tactile pulse waveform bars */}
                  <span className="inline-flex items-end justify-center gap-1 h-3.5" aria-hidden="true">
                    {opt.bars.map((heightPct, idx) => (
                      <span
                        key={idx}
                        className={`rounded-full transition-all ${
                          opt.id === 'intense' ? 'w-1.5' : 'w-1'
                        } ${selected ? 'bg-neutral-950' : 'bg-amber-400/80'}`}
                        style={{ height: `${Math.round((heightPct / 100) * 14)}px` }}
                      />
                    ))}
                  </span>
                  <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                  <span
                    className={`text-[10px] leading-none font-mono tabular-nums ${
                      selected ? 'text-neutral-900/80' : 'text-neutral-400'
                    }`}
                  >
                    {TORCH_HAPTIC_PATTERNS[opt.id].summary}
                  </span>
                </button>
              );
            })}
          </div>

          {!isHapticSupported() && (
            <p className="text-[10px] text-neutral-400 leading-snug">
              {t.torchMode.hapticUnsupportedHint}
            </p>
          )}
        </div>

        {/* Night Mode UI Theme Selector Card (Standard, Deep Red, Warm Sepia) */}
        <div
          id="night-mode-theme-card"
          className="w-full glass-panel rounded-2xl p-3.5 space-y-3"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                uiTheme !== 'standard'
                  ? 'bg-amber-500/18 text-amber-300 border-amber-400/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'glass-surface text-neutral-300'
              }`}
            >
              <Eye className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white leading-tight truncate">
                {t.common.nightModeTitle}
              </div>
              <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
                {t.common.nightModeSubtitle}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                {
                  id: 'standard',
                  label: t.common.themeStandard,
                  swatchBg: '#0a0a0a',
                  swatchAccent: '#f59e0b',
                },
                {
                  id: 'red-night',
                  label: t.common.themeRedNight,
                  swatchBg: '#1c0508',
                  swatchAccent: '#dc2626',
                },
                {
                  id: 'sepia-night',
                  label: t.common.themeSepiaNight,
                  swatchBg: '#1b130b',
                  swatchAccent: '#d97706',
                },
              ] as Array<{
                id: UiTheme;
                label: string;
                swatchBg: string;
                swatchAccent: string;
              }>
            ).map((opt) => {
              const selected = uiTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  id={`ui-theme-option-${opt.id}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChangeUiTheme(opt.id)}
                  className={`min-h-[46px] px-2.5 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    selected
                      ? 'bg-amber-500/90 text-neutral-950 border-amber-300/75 font-semibold shadow-[0_4px_14px_rgba(245,158,11,0.28),inset_0_1px_0_rgba(255,255,255,0.4)]'
                      : 'glass-surface text-neutral-200 hover:text-white'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="w-3.5 h-3.5 rounded-full border shrink-0"
                    style={{
                      backgroundColor: opt.swatchBg,
                      borderColor: opt.swatchAccent,
                      boxShadow: `inset 0 0 0 2px ${opt.swatchAccent}66`,
                    }}
                  />
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Persistent Torch Usage History & Active Session Tracker */}
        <UsageHistoryCard
          language={language}
          accumulatedMs={usageAccumulatedMs}
          activeStartedAt={usageActiveStartedAt}
          entries={usageEntries}
          onResetHistory={onResetUsageHistory}
        />

        {/* Quick Actions Menu (Bluetooth, Wi-Fi, Location) */}
        <QuickActionsCard language={language} hapticEnabled={hapticEnabled} />
      </div>
    </div>
  );
};
