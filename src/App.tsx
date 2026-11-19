/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AmbientLightCategory,
  AppMode,
  AppPreferences,
  ChatMessage,
  Language,
  ProximitySensorMode,
  ProximityTriggerReason,
  ScannerConfig,
  ShakeSensitivity,
  SosSettings,
  StrobePattern,
  TimerDuration,
  TorchHapticPattern,
  TorchIntensityCapability,
  TorchLightingPreset,
  TorchUsageEntry,
  UiTheme,
  WidgetLayoutVariant,
} from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { TorchMode } from './components/TorchMode';
import { StrobeMode } from './components/StrobeMode';
import { SosMode } from './components/SosMode';
import { ScreenLightMode } from './components/ScreenLightMode';
import { ScannerMode } from './components/ScannerMode';
import { AiStudioMode } from './components/AiStudioMode';
import { HomescreenWidgetMode } from './components/HomescreenWidgetMode';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LowBatteryAlert } from './components/LowBatteryAlert';
import { VoiceControlBanner } from './components/VoiceControlBanner';
import { AmbientLightBanner } from './components/AmbientLightBanner';
import { LiquidBackdrop } from './components/LiquidBackdrop';
import { useBatteryStatus } from './hooks/useBatteryStatus';
import { usePWAInstall } from './hooks/usePWAInstall';
import { torchManager } from './utils/torch';
import {
  playSwitchClick,
  playMorseTone,
  stopActiveMorseTone,
  applySystemNotificationAudioSession,
  readNativeNotificationVolume,
  subscribeSystemVolumeChanges,
  triggerHaptic,
  triggerLightToggleHaptic,
  HAPTIC_PATTERNS,
  emergencySiren,
} from './utils/audio';
import {
  isMotionSensorSupported,
  requestMotionPermission,
  startShakeListener,
} from './utils/shake';
import {
  getProximitySensorMode,
  isProximityAutoOffSupported,
  requestProximityAutoOffPermission,
  startProximityAutoOffListener,
} from './utils/proximity';
import {
  DEFAULT_SOS_SETTINGS,
  clampSosSettings,
  cloneSosSettings,
} from './utils/sosPatterns';
import {
  VoiceCommand,
  VoiceErrorCode,
  isSpeechRecognitionSupported,
  parseVoiceCommand,
  startVoiceCommandListener,
} from './utils/voiceControl';
import {
  AmbientLightErrorCode,
  isFrontCameraSupported,
  startFrontCameraAmbientMonitor,
} from './utils/ambientLight';
import { translations } from './utils/translations';
import {
  deleteLightingPresetApi,
  fetchBootstrap,
  patchSettings,
  recordUsageSessionApi,
  recordUsageSessionKeepalive,
  resetUsageHistoryApi,
  saveScannerConfigApi,
  saveSosSettingsApi,
  upsertLightingPresetApi,
} from './services/api';

const HAPTIC_STORAGE_KEY = 'torch-haptic-enabled';
const CUSTOM_PRESETS_STORAGE_KEY = 'torch-custom-lighting-presets';
const SHAKE_SENSITIVITY_KEY = 'torch-shake-sensitivity';
const TORCH_INTENSITY_KEY = 'torch-led-intensity';
const PROXIMITY_AUTO_OFF_KEY = 'torch-proximity-auto-off';
const SOS_SETTINGS_KEY = 'torch-sos-settings';
const STROBE_PATTERN_KEY = 'torch-strobe-pattern';
const UI_THEME_KEY = 'torch-ui-theme';
const WIDGET_LAYOUT_KEY = 'torch-widget-layout';
const WIDGET_AUTOSTART_KEY = 'torch-widget-autostart';
const SOS_TONE_MUTED_KEY = 'torch-sos-tone-muted';
const SOS_SYNC_SYS_VOL_KEY = 'torch-sos-sync-system-volume';
const SOS_TONE_VOLUME_KEY = 'torch-sos-tone-volume';
const TORCH_HAPTIC_PATTERN_KEY = 'torch-haptic-pattern';

function readInitialShortcutParams(): {
  widgetMode: boolean;
  autoStart: boolean;
  mode: AppMode | null;
} {
  if (typeof window === 'undefined') {
    return { widgetMode: false, autoStart: false, mode: null };
  }
  const params = new URLSearchParams(window.location.search);
  const widgetParam = params.get('widget');
  const widgetMode = widgetParam === 'torch' || widgetParam === '1' || widgetParam === 'true';
  const autoStart = params.get('autostart') === '1' || params.get('autostart') === 'true';
  const modeParam = params.get('mode');
  const validModes: AppMode[] = ['torch', 'strobe', 'sos', 'screen', 'scanner', 'studio'];
  const mode =
    modeParam && validModes.includes(modeParam as AppMode) ? (modeParam as AppMode) : null;
  return { widgetMode, autoStart, mode };
}

export default function App() {
  const prefersReducedMotion = useReducedMotion();
  const initialLaunchRef = useRef(readInitialShortcutParams());
  const pwaInstall = usePWAInstall();

  // Homescreen Widget Mode state
  const [isWidgetMode, setIsWidgetMode] = useState<boolean>(
    () => initialLaunchRef.current.widgetMode,
  );
  const [widgetLayout, setWidgetLayout] = useState<WidgetLayoutVariant>(() => {
    try {
      const saved = window.localStorage.getItem(WIDGET_LAYOUT_KEY);
      if (saved === 'compact-2x1' || saved === 'controls-2x2' || saved === 'dock-4x1') {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'controls-2x2';
  });
  const [widgetAutoStart, setWidgetAutoStart] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(WIDGET_AUTOSTART_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  // App state
  const [currentMode, setCurrentMode] = useState<AppMode>(
    () => initialLaunchRef.current.mode ?? 'torch',
  );
  const [language, setLanguage] = useState<Language>('hi');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => {
    try {
      const saved = window.localStorage.getItem(UI_THEME_KEY);
      if (saved === 'standard' || saved === 'red-night' || saved === 'sepia-night') {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'standard';
  });
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(HAPTIC_STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [torchHapticPattern, setTorchHapticPattern] = useState<TorchHapticPattern>(() => {
    try {
      const saved = window.localStorage.getItem(TORCH_HAPTIC_PATTERN_KEY);
      if (saved === 'subtle' || saved === 'standard' || saved === 'intense') {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'standard';
  });
  const torchHapticPatternRef = useRef<TorchHapticPattern>(torchHapticPattern);
  torchHapticPatternRef.current = torchHapticPattern;

  // Live battery monitoring for header indicator and automatic <15% alert
  const battery = useBatteryStatus();
  const [dismissedLowBatteryAt, setDismissedLowBatteryAt] = useState<number | null>(null);
  const wasLowBatteryRef = useRef<boolean>(false);

  // Flashlight state
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasHardwareTorch, setHasHardwareTorch] = useState<boolean>(false);
  const [torchIntensity, setTorchIntensity] = useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem(TORCH_INTENSITY_KEY));
      if (Number.isFinite(saved) && saved >= 0.1 && saved <= 1.0) {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 1.0;
  });
  const [torchIntensityCapability, setTorchIntensityCapability] =
    useState<TorchIntensityCapability>(() => torchManager.getIntensityCapability());
  const [torchError, setTorchError] = useState<string | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

  // Timer state for Torch
  const [activeTimer, setActiveTimer] = useState<TimerDuration>(0);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);

  // Shake-to-Toggle state
  const [shakeEnabled, setShakeEnabled] = useState<boolean>(false);
  const [shakeSensitivity, setShakeSensitivity] = useState<ShakeSensitivity>(() => {
    try {
      const saved = window.localStorage.getItem(SHAKE_SENSITIVITY_KEY);
      if (saved === 'low' || saved === 'medium' || saved === 'high') return saved;
    } catch {
      // ignore storage errors
    }
    return 'medium';
  });
  const [shakeError, setShakeError] = useState<string | null>(null);
  const [shakeTriggeredRecently, setShakeTriggeredRecently] = useState<boolean>(false);
  const shakeToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pocket & Face-Down Proximity Auto-Off state
  const [proximitySensorMode] = useState<ProximitySensorMode>(() => getProximitySensorMode());
  const [proximityAutoOffEnabled, setProximityAutoOffEnabled] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(PROXIMITY_AUTO_OFF_KEY);
      if (saved !== 'true') return false;
      // If iOS explicit permission API exists, wait for user tap to re-enable cleanly
      const orientCtor =
        typeof window !== 'undefined'
          ? (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown })
          : undefined;
      if (typeof orientCtor?.requestPermission === 'function') return false;
      return isProximityAutoOffSupported();
    } catch {
      return false;
    }
  });
  const [proximityError, setProximityError] = useState<string | null>(null);
  const [proximityTriggeredReason, setProximityTriggeredReason] =
    useState<ProximityTriggerReason | null>(null);
  const proximityToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Strobe state
  const [isStrobeActive, setIsStrobeActive] = useState<boolean>(false);
  const [strobeFrequency, setStrobeFrequency] = useState<number>(6);
  const [strobePattern, setStrobePattern] = useState<StrobePattern>(() => {
    try {
      const saved = window.localStorage.getItem(STROBE_PATTERN_KEY);
      if (
        saved === 'constant' ||
        saved === 'flicker' ||
        saved === 'pulse' ||
        saved === 'heartbeat'
      ) {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'constant';
  });
  const [strobeFlashTick, setStrobeFlashTick] = useState<boolean>(false);

  // SOS state (with customizable pattern, durations, mute & system notification volume sync)
  const [isSosActive, setIsSosActive] = useState<boolean>(false);
  const [sosStepIndex, setSosStepIndex] = useState<number>(0);
  const [sosIsEmitting, setSosIsEmitting] = useState<boolean>(false);
  const [sosToneMuted, setSosToneMuted] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SOS_TONE_MUTED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [sosSyncSystemVolume, setSosSyncSystemVolume] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(SOS_SYNC_SYS_VOL_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [sosToneVolume, setSosToneVolume] = useState<number>(() => {
    const nativeVol = readNativeNotificationVolume();
    if (nativeVol !== null) return nativeVol;
    try {
      const saved = Number(window.localStorage.getItem(SOS_TONE_VOLUME_KEY));
      if (Number.isFinite(saved) && saved >= 0 && saved <= 1) return saved;
    } catch {
      // ignore storage errors
    }
    return 0.85;
  });
  const sosToneMutedRef = useRef<boolean>(sosToneMuted);
  sosToneMutedRef.current = sosToneMuted;
  const sosSyncSystemVolumeRef = useRef<boolean>(sosSyncSystemVolume);
  sosSyncSystemVolumeRef.current = sosSyncSystemVolume;
  const sosToneVolumeRef = useRef<number>(sosToneVolume);
  sosToneVolumeRef.current = sosToneVolume;

  const [sosSettings, setSosSettings] = useState<SosSettings>(() => {
    try {
      const raw = window.localStorage.getItem(SOS_SETTINGS_KEY);
      if (raw) {
        return clampSosSettings(JSON.parse(raw) as Partial<SosSettings>);
      }
    } catch {
      // ignore storage/parse errors
    }
    return cloneSosSettings(DEFAULT_SOS_SETTINGS);
  });
  const sosSettingsRef = useRef<SosSettings>(sosSettings);
  sosSettingsRef.current = sosSettings;

  const handleChangeSosSettings = useCallback((next: SosSettings) => {
    const validated = clampSosSettings(next);
    setSosSettings(validated);
    sosSettingsRef.current = validated;
    try {
      window.localStorage.setItem(SOS_SETTINGS_KEY, JSON.stringify(validated));
    } catch {
      // ignore storage errors
    }
    void saveSosSettingsApi(validated).catch(() => {
      // local cache already updated
    });
  }, []);

  // Screen Light & Scanner Light fullscreen state
  const [screenColor, setScreenColor] = useState<string>('#FFFFFF');
  const [screenBrightness, setScreenBrightness] = useState<number>(1.0);
  const [isFullscreenScreenLight, setIsFullscreenScreenLight] = useState<boolean>(false);
  const [isFullscreenScanner, setIsFullscreenScanner] = useState<boolean>(false);

  // Backend-persisted Lighting Presets, Scanner Config & Torch Usage History
  const [customLightingPresets, setCustomLightingPresets] = useState<TorchLightingPreset[]>(() => {
    try {
      const raw = window.localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as TorchLightingPreset[]) : [];
    } catch {
      return [];
    }
  });
  const [scannerConfig, setScannerConfig] = useState<ScannerConfig>({
    patternType: 'qr',
    payload: 'EMERGENCY-ICE-TORCH-01',
    brightness: 1.0,
    verticalBarcode: false,
    showHumanText: true,
  });
  const [usageAccumulatedMs, setUsageAccumulatedMs] = useState<number>(0);
  const [usageActiveStartedAt, setUsageActiveStartedAt] = useState<number | null>(null);
  const [usageEntries, setUsageEntries] = useState<TorchUsageEntry[]>([]);

  // Persisted Gemini Assistant chat history across mode switches & reloads
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const backendHydratedRef = useRef<boolean>(false);
  const settingsSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usageStartedAtRef = useRef<number | null>(null);
  const torchIntensityRef = useRef<number>(torchIntensity);
  torchIntensityRef.current = torchIntensity;

  // Web Speech API hands-free voice control state
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);
  const [voiceListening, setVoiceListening] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [voiceConfirmation, setVoiceConfirmation] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Front-camera Ambient Light Auto-Suggest state
  const [ambientSensorEnabled, setAmbientSensorEnabled] = useState<boolean>(false);
  const [ambientLevel, setAmbientLevel] = useState<number | null>(null);
  const [ambientCategory, setAmbientCategory] = useState<AmbientLightCategory | null>(null);
  const [isDarkDetected, setIsDarkDetected] = useState<boolean>(false);
  const [ambientDismissed, setAmbientDismissed] = useState<boolean>(false);
  const [ambientError, setAmbientError] = useState<string | null>(null);

  // References for intervals / timeouts
  const strobeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sosTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoOffTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSosRunningRef = useRef<boolean>(false);
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const hapticEnabledRef = useRef<boolean>(hapticEnabled);
  hapticEnabledRef.current = hapticEnabled;

  useEffect(() => {
    try {
      window.localStorage.setItem(HAPTIC_STORAGE_KEY, String(hapticEnabled));
    } catch {
      // Ignore storage errors
    }
  }, [hapticEnabled]);

  // Hydrate all persisted state from Express backend on mount
  useEffect(() => {
    let cancelled = false;
    fetchBootstrap()
      .then((data) => {
        if (cancelled) return;
        const prefs = data.preferences;
        setLanguage(prefs.language);
        setSoundEnabled(prefs.soundEnabled);
        setHapticEnabled(prefs.hapticEnabled);
        setUiTheme(prefs.uiTheme);
        setTorchIntensity(prefs.torchIntensity);
        setActiveTimer(prefs.activeTimer);
        setShakeSensitivity(prefs.shakeSensitivity);
        setStrobeFrequency(prefs.strobeFrequency);
        setStrobePattern(prefs.strobePattern);
        setScreenColor(prefs.screenColor);
        setScreenBrightness(prefs.screenBrightness);
        if (prefs.widgetLayout) {
          setWidgetLayout(prefs.widgetLayout);
        }
        if (typeof prefs.widgetAutoStart === 'boolean') {
          setWidgetAutoStart(prefs.widgetAutoStart);
        }
        if (typeof prefs.sosToneMuted === 'boolean') {
          setSosToneMuted(prefs.sosToneMuted);
        }
        if (typeof prefs.sosSyncSystemVolume === 'boolean') {
          setSosSyncSystemVolume(prefs.sosSyncSystemVolume);
        }
        if (typeof prefs.sosToneVolume === 'number' && Number.isFinite(prefs.sosToneVolume)) {
          setSosToneVolume(Math.min(1, Math.max(0, prefs.sosToneVolume)));
        }
        if (
          prefs.torchHapticPattern === 'subtle' ||
          prefs.torchHapticPattern === 'standard' ||
          prefs.torchHapticPattern === 'intense'
        ) {
          setTorchHapticPattern(prefs.torchHapticPattern);
        }
        if (prefs.proximityAutoOffEnabled && isProximityAutoOffSupported()) {
          const orientCtor =
            typeof window !== 'undefined'
              ? (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown })
              : undefined;
          if (typeof orientCtor?.requestPermission !== 'function') {
            setProximityAutoOffEnabled(true);
          }
        }

        setCustomLightingPresets(data.lightingPresets);
        try {
          window.localStorage.setItem(
            CUSTOM_PRESETS_STORAGE_KEY,
            JSON.stringify(data.lightingPresets),
          );
        } catch {
          // ignore storage errors
        }

        const clampedSos = clampSosSettings(data.sosSettings);
        setSosSettings(clampedSos);
        sosSettingsRef.current = clampedSos;

        setUsageAccumulatedMs(data.usageHistory.accumulatedMs);
        setUsageEntries(data.usageHistory.entries);
        setScannerConfig(data.scanner);
        if (data.chatHistory.length > 0) {
          setChatMessages(data.chatHistory);
        }

        // Enable preference write-back on next tick so hydrated values don't immediately re-PATCH
        setTimeout(() => {
          if (!cancelled) backendHydratedRef.current = true;
        }, 0);
      })
      .catch(() => {
        if (!cancelled) backendHydratedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced preference write-back to PATCH /api/settings
  useEffect(() => {
    if (!backendHydratedRef.current) return;
    if (settingsSyncTimerRef.current) clearTimeout(settingsSyncTimerRef.current);

    const payload: Partial<AppPreferences> = {
      language,
      soundEnabled,
      hapticEnabled,
      uiTheme,
      torchIntensity,
      activeTimer,
      shakeSensitivity,
      proximityAutoOffEnabled,
      strobeFrequency,
      strobePattern,
      screenColor,
      screenBrightness,
      widgetLayout,
      widgetAutoStart,
      sosToneMuted,
      sosSyncSystemVolume,
      sosToneVolume,
      torchHapticPattern,
    };

    settingsSyncTimerRef.current = setTimeout(() => {
      void patchSettings(payload).catch(() => {
        // ignore transient network errors; local cache remains intact
      });
    }, 300);

    return () => {
      if (settingsSyncTimerRef.current) clearTimeout(settingsSyncTimerRef.current);
    };
  }, [
    language,
    soundEnabled,
    hapticEnabled,
    uiTheme,
    torchIntensity,
    activeTimer,
    shakeSensitivity,
    proximityAutoOffEnabled,
    strobeFrequency,
    strobePattern,
    screenColor,
    screenBrightness,
    widgetLayout,
    widgetAutoStart,
    sosToneMuted,
    sosSyncSystemVolume,
    sosToneVolume,
    torchHapticPattern,
  ]);

  const handleChangeTorchHapticPattern = useCallback((next: TorchHapticPattern) => {
    setTorchHapticPattern(next);
    torchHapticPatternRef.current = next;
    try {
      window.localStorage.setItem(TORCH_HAPTIC_PATTERN_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  // Synchronize Web Audio session channel & hardware volume keys with system notification volume
  useEffect(() => {
    applySystemNotificationAudioSession(sosSyncSystemVolume);
    if (!sosSyncSystemVolume) return;

    const nativeVol = readNativeNotificationVolume();
    if (nativeVol !== null) {
      setSosToneVolume(nativeVol);
    }

    return subscribeSystemVolumeChanges({
      onVolumeDelta: (delta) => {
        setSosToneVolume((prev) => {
          const next = Math.min(1, Math.max(0, Number((prev + delta).toFixed(2))));
          try {
            window.localStorage.setItem(SOS_TONE_VOLUME_KEY, String(next));
          } catch {
            // ignore storage errors
          }
          if (next > 0 && sosToneMutedRef.current) {
            setSosToneMuted(false);
          }
          return next;
        });
      },
      onMuteToggle: () => {
        setSosToneMuted((prev) => {
          const next = !prev;
          if (next) stopActiveMorseTone();
          try {
            window.localStorage.setItem(SOS_TONE_MUTED_KEY, String(next));
          } catch {
            // ignore storage errors
          }
          return next;
        });
      },
      onExactVolume: (vol) => {
        setSosToneVolume(vol);
      },
    });
  }, [sosSyncSystemVolume]);

  const handleToggleSosMute = useCallback(() => {
    const currentlyMuted =
      sosToneMutedRef.current || !soundEnabledRef.current || sosToneVolumeRef.current <= 0.001;
    if (currentlyMuted) {
      setSosToneMuted(false);
      if (!soundEnabledRef.current) {
        setSoundEnabled(true);
      }
      if (sosToneVolumeRef.current <= 0.001) {
        setSosToneVolume(0.75);
        try {
          window.localStorage.setItem(SOS_TONE_VOLUME_KEY, '0.75');
        } catch {
          // ignore
        }
      }
      try {
        window.localStorage.setItem(SOS_TONE_MUTED_KEY, 'false');
      } catch {
        // ignore
      }
    } else {
      setSosToneMuted(true);
      stopActiveMorseTone();
      try {
        window.localStorage.setItem(SOS_TONE_MUTED_KEY, 'true');
      } catch {
        // ignore
      }
    }
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
  }, [hapticEnabled]);

  const handleToggleSosSyncSystemVolume = useCallback(() => {
    setSosSyncSystemVolume((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SOS_SYNC_SYS_VOL_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
  }, [hapticEnabled]);

  const handleChangeSosToneVolume = useCallback((nextVolume: number) => {
    const clamped = Math.min(1, Math.max(0, Number(nextVolume.toFixed(2))));
    setSosToneVolume(clamped);
    try {
      window.localStorage.setItem(SOS_TONE_VOLUME_KEY, String(clamped));
    } catch {
      // ignore
    }
    if (clamped <= 0.001) {
      setSosToneMuted(true);
      stopActiveMorseTone();
      try {
        window.localStorage.setItem(SOS_TONE_MUTED_KEY, 'true');
      } catch {
        // ignore
      }
    } else {
      if (sosToneMutedRef.current) {
        setSosToneMuted(false);
        try {
          window.localStorage.setItem(SOS_TONE_MUTED_KEY, 'false');
        } catch {
          // ignore
        }
      }
      if (!soundEnabledRef.current) {
        setSoundEnabled(true);
      }
    }
  }, []);

  // Track real Torch activation runs & persist completed sessions to POST /api/usage/sessions
  useEffect(() => {
    if (isTorchOn) {
      if (usageStartedAtRef.current === null) {
        const started = Date.now();
        usageStartedAtRef.current = started;
        setUsageActiveStartedAt(started);
      }
    } else if (usageStartedAtRef.current !== null) {
      const startedAt = usageStartedAtRef.current;
      const endedAt = Date.now();
      const durationMs = Math.max(500, endedAt - startedAt);
      const intensityPercent = Math.round(torchIntensityRef.current * 100);
      usageStartedAtRef.current = null;
      setUsageActiveStartedAt(null);

      const optimisticEntry: TorchUsageEntry = {
        id: `local-${endedAt}`,
        startedAt,
        endedAt,
        durationMs,
        intensityPercent,
      };
      setUsageAccumulatedMs((prev) => prev + durationMs);
      setUsageEntries((prev) => [optimisticEntry, ...prev].slice(0, 50));

      void recordUsageSessionApi({
        startedAt,
        endedAt,
        durationMs,
        intensityPercent,
      })
        .then((res) => {
          setUsageAccumulatedMs(res.usageHistory.accumulatedMs);
          setUsageEntries(res.usageHistory.entries);
        })
        .catch(() => {
          // optimistic session remains visible
        });
    }
  }, [isTorchOn]);

  // Flush any active torch session cleanly if the user closes/reloads the tab
  useEffect(() => {
    const handlePageHide = () => {
      if (usageStartedAtRef.current !== null) {
        const startedAt = usageStartedAtRef.current;
        const endedAt = Date.now();
        usageStartedAtRef.current = null;
        recordUsageSessionKeepalive({
          startedAt,
          endedAt,
          durationMs: Math.max(500, endedAt - startedAt),
          intensityPercent: Math.round(torchIntensityRef.current * 100),
        });
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  const handleSaveLightingPreset = useCallback((name: string, intensity: number) => {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    const normalized = Math.min(1, Math.max(0.1, Number(intensity.toFixed(2))));

    setCustomLightingPresets((prev) => {
      const idx = prev.findIndex((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      const next =
        idx >= 0
          ? prev.map((p, i) =>
              i === idx ? { ...p, name: trimmed, intensity: normalized } : p,
            )
          : [
              ...prev,
              {
                id: `custom-${Date.now()}`,
                name: trimmed,
                intensity: normalized,
                isBuiltIn: false,
              },
            ].slice(-9);
      try {
        window.localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });

    void upsertLightingPresetApi(trimmed, normalized)
      .then((res) => {
        setCustomLightingPresets(res.presets);
        try {
          window.localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(res.presets));
        } catch {
          // ignore storage errors
        }
      })
      .catch(() => {
        // optimistic state already applied
      });
  }, []);

  const handleDeleteLightingPreset = useCallback((presetId: string) => {
    setCustomLightingPresets((prev) => {
      const next = prev.filter((p) => p.id !== presetId);
      try {
        window.localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });

    void deleteLightingPresetApi(presetId)
      .then((presets) => {
        setCustomLightingPresets(presets);
        try {
          window.localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(presets));
        } catch {
          // ignore storage errors
        }
      })
      .catch(() => {
        // optimistic deletion already applied
      });
  }, []);

  const handleResetUsageHistory = useCallback(() => {
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    setUsageAccumulatedMs(0);
    setUsageEntries([]);
    if (isTorchOn) {
      const now = Date.now();
      usageStartedAtRef.current = now;
      setUsageActiveStartedAt(now);
    }
    void resetUsageHistoryApi().catch(() => {
      // ignore network errors
    });
  }, [hapticEnabled, isTorchOn]);

  const handleChangeScannerConfig = useCallback((patch: Partial<ScannerConfig>) => {
    setScannerConfig((prev) => {
      const next = { ...prev, ...patch };
      if (scannerSyncTimerRef.current) clearTimeout(scannerSyncTimerRef.current);
      scannerSyncTimerRef.current = setTimeout(() => {
        void saveScannerConfigApi(next).catch(() => {
          // ignore transient network errors
        });
      }, 280);
      return next;
    });
  }, []);

  // Sync Night Mode UI theme attribute on <html> and browser theme-color meta tag
  useEffect(() => {
    document.documentElement.dataset.uiTheme = uiTheme;
    try {
      window.localStorage.setItem(UI_THEME_KEY, uiTheme);
    } catch {
      // Ignore storage errors
    }
    const themeColorHex =
      uiTheme === 'red-night'
        ? '#130305'
        : uiTheme === 'sepia-night'
          ? '#140e08'
          : '#0a0a0a';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = themeColorHex;
  }, [uiTheme]);

  const handleChangeUiTheme = useCallback(
    (next: UiTheme) => {
      setUiTheme(next);
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    },
    [hapticEnabled],
  );

  const handleCycleUiTheme = useCallback(() => {
    setUiTheme((prev) =>
      prev === 'standard'
        ? 'red-night'
        : prev === 'red-night'
          ? 'sepia-night'
          : 'standard',
    );
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
  }, [hapticEnabled]);

  // Reset low-battery dismissal when charging/recovered, and vibrate once when dropping below 15%
  useEffect(() => {
    if (!battery.isLowBattery) {
      setDismissedLowBatteryAt(null);
      wasLowBatteryRef.current = false;
      return;
    }
    if (!wasLowBatteryRef.current) {
      wasLowBatteryRef.current = true;
      if (hapticEnabledRef.current) {
        triggerHaptic(HAPTIC_PATTERNS.timerExpired);
      }
    }
  }, [battery.isLowBattery]);

  const showLowBatteryAlert =
    battery.isLowBattery &&
    battery.level !== null &&
    (dismissedLowBatteryAt === null || battery.level <= dismissedLowBatteryAt - 5);

  // Check hardware torch and variable intensity support on mount
  useEffect(() => {
    let mounted = true;
    torchManager.checkHardwareSupport().then((support) => {
      if (mounted) {
        setHasHardwareTorch(support.hasHardwareTorch);
        setTorchIntensityCapability(support.intensity);
      }
    });

    return () => {
      mounted = false;
      torchManager.cleanup();
      emergencySiren.stop();
    };
  }, []);

  // Sync wake lock whenever any light or scanner display is active
  useEffect(() => {
    const anyActive =
      isTorchOn ||
      isStrobeActive ||
      isSosActive ||
      currentMode === 'screen' ||
      currentMode === 'scanner';
    if (anyActive) {
      torchManager.requestWakeLock().then((active) => setWakeLockActive(active));
    } else {
      torchManager.releaseWakeLock();
      setWakeLockActive(false);
    }
  }, [isTorchOn, isStrobeActive, isSosActive, currentMode]);

  // Handle hardware torch setting with capability & error capture
  const updateHardwareTorch = useCallback(async (on: boolean, intensityOverride?: number) => {
    const result = await torchManager.setTorch(on, intensityOverride);
    setTorchIntensityCapability(result.intensityCapability);
    if (on && result.isHardware) {
      setHasHardwareTorch(true);
    }
    if (!result.success) {
      setTorchError(result.error || 'Torch unavailable');
    } else {
      setTorchError(null);
    }
  }, []);

  const handleChangeTorchIntensity = useCallback((nextIntensity: number) => {
    const clamped = Math.min(1, Math.max(0.1, nextIntensity));
    setTorchIntensity(clamped);
    try {
      window.localStorage.setItem(TORCH_INTENSITY_KEY, String(clamped));
    } catch {
      // ignore storage errors
    }
    void torchManager.setTorchIntensity(clamped);
  }, []);

  // Clean up other modes when switching tabs
  const handleSelectMode = (mode: AppMode) => {
    if (hapticEnabled) triggerHaptic(15);
    if (soundEnabled) playSwitchClick(false);

    if (currentMode === 'strobe' && isStrobeActive) {
      setIsStrobeActive(false);
      updateHardwareTorch(false);
    }
    if (currentMode === 'sos' && mode !== 'sos') {
      if (isSosActive) {
        setIsSosActive(false);
        isSosRunningRef.current = false;
        if (sosTimeoutRef.current) clearTimeout(sosTimeoutRef.current);
        stopActiveMorseTone();
        updateHardwareTorch(false);
      }
      emergencySiren.stop();
    }

    setCurrentMode(mode);
  };

  // Toggle Torch Mode
  const handleToggleTorch = useCallback(async () => {
    const next = !isTorchOn;
    setIsTorchOn(next);
    if (next) {
      setProximityTriggeredReason(null);
      if (proximityToastTimeoutRef.current) {
        clearTimeout(proximityToastTimeoutRef.current);
        proximityToastTimeoutRef.current = null;
      }
    }
    if (soundEnabled) playSwitchClick(next);
    if (hapticEnabled) triggerLightToggleHaptic('torch', next, torchHapticPatternRef.current);

    await updateHardwareTorch(next, next ? torchIntensity : undefined);

    if (!next) {
      setTimerRemaining(null);
      if (autoOffTimerRef.current) clearInterval(autoOffTimerRef.current);
    } else if (activeTimer > 0) {
      setTimerRemaining(activeTimer);
    }
  }, [isTorchOn, soundEnabled, hapticEnabled, updateHardwareTorch, torchIntensity, activeTimer]);

  // Timer countdown handler
  useEffect(() => {
    if (isTorchOn && activeTimer > 0) {
      setTimerRemaining(activeTimer);
      if (autoOffTimerRef.current) clearInterval(autoOffTimerRef.current);

      autoOffTimerRef.current = setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev === null || prev <= 1) {
            setIsTorchOn(false);
            updateHardwareTorch(false);
            if (soundEnabledRef.current) playSwitchClick(false);
            if (hapticEnabledRef.current) triggerHaptic(HAPTIC_PATTERNS.timerExpired);
            if (autoOffTimerRef.current) clearInterval(autoOffTimerRef.current);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (autoOffTimerRef.current) clearInterval(autoOffTimerRef.current);
      setTimerRemaining(null);
    }

    return () => {
      if (autoOffTimerRef.current) clearInterval(autoOffTimerRef.current);
    };
  }, [isTorchOn, activeTimer, updateHardwareTorch]);

  const handleTimerChange = (duration: TimerDuration) => {
    setActiveTimer(duration);
    if (hapticEnabled) triggerHaptic(20);
    if (isTorchOn) {
      if (duration > 0) {
        setTimerRemaining(duration);
      } else {
        setTimerRemaining(null);
      }
    }
  };

  const handleToggleShake = useCallback(async () => {
    const tTorch = translations[language].torchMode;
    if (shakeEnabled) {
      setShakeEnabled(false);
      setShakeError(null);
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
      return;
    }

    if (!isMotionSensorSupported()) {
      setShakeError(tTorch.shakeUnsupported);
      return;
    }

    const permission = await requestMotionPermission();
    if (permission === 'unsupported') {
      setShakeError(tTorch.shakeUnsupported);
      return;
    }
    if (permission === 'denied') {
      setShakeError(tTorch.shakePermissionDenied);
      return;
    }

    setShakeError(null);
    setShakeEnabled(true);
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
  }, [shakeEnabled, language, hapticEnabled]);

  const handleChangeShakeSensitivity = useCallback(
    (next: ShakeSensitivity) => {
      setShakeSensitivity(next);
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
      try {
        window.localStorage.setItem(SHAKE_SENSITIVITY_KEY, next);
      } catch {
        // ignore storage errors
      }
    },
    [hapticEnabled],
  );

  // Ref for latest torch toggle & SOS state so accelerometer listener stays stable
  const handleToggleTorchRef = useRef(handleToggleTorch);
  handleToggleTorchRef.current = handleToggleTorch;
  const isSosActiveRef = useRef(isSosActive);
  isSosActiveRef.current = isSosActive;
  const currentModeRef = useRef(currentMode);
  currentModeRef.current = currentMode;

  useEffect(() => {
    if (!shakeEnabled) return;

    const stopListening = startShakeListener({
      sensitivity: shakeSensitivity,
      onShake: () => {
        // Do not interrupt an active emergency SOS broadcast
        if (isSosActiveRef.current) return;
        if (currentModeRef.current !== 'torch') {
          setCurrentMode('torch');
        }
        void handleToggleTorchRef.current();
        setShakeTriggeredRecently(true);
        if (shakeToastTimeoutRef.current) {
          clearTimeout(shakeToastTimeoutRef.current);
        }
        shakeToastTimeoutRef.current = setTimeout(() => {
          setShakeTriggeredRecently(false);
        }, 1600);
      },
    });

    return () => {
      stopListening();
      if (shakeToastTimeoutRef.current) {
        clearTimeout(shakeToastTimeoutRef.current);
      }
    };
  }, [shakeEnabled, shakeSensitivity]);

  // Toggle Pocket & Face-Down Proximity Auto-Off
  const handleToggleProximityAutoOff = useCallback(async () => {
    const tTorch = translations[language].torchMode;
    if (proximityAutoOffEnabled) {
      setProximityAutoOffEnabled(false);
      setProximityError(null);
      setProximityTriggeredReason(null);
      try {
        window.localStorage.setItem(PROXIMITY_AUTO_OFF_KEY, 'false');
      } catch {
        // ignore storage errors
      }
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
      return;
    }

    if (!isProximityAutoOffSupported()) {
      setProximityError(tTorch.proximityUnsupported);
      return;
    }

    const permission = await requestProximityAutoOffPermission();
    if (permission === 'unsupported') {
      setProximityError(tTorch.proximityUnsupported);
      return;
    }
    if (permission === 'denied') {
      setProximityError(tTorch.proximityPermissionDenied);
      return;
    }

    setProximityError(null);
    setProximityAutoOffEnabled(true);
    try {
      window.localStorage.setItem(PROXIMITY_AUTO_OFF_KEY, 'true');
    } catch {
      // ignore storage errors
    }
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
  }, [proximityAutoOffEnabled, language, hapticEnabled]);

  // Arm proximity & face-down listener only while enabled and Torch is ON
  useEffect(() => {
    if (!proximityAutoOffEnabled || !isTorchOn) return;

    const stopProximity = startProximityAutoOffListener({
      onAutoOff: (reason) => {
        setIsTorchOn(false);
        setTimerRemaining(null);
        if (autoOffTimerRef.current) {
          clearInterval(autoOffTimerRef.current);
        }
        void updateHardwareTorch(false);
        if (soundEnabledRef.current) playSwitchClick(false);
        if (hapticEnabledRef.current) triggerHaptic(HAPTIC_PATTERNS.timerExpired);

        setProximityTriggeredReason(reason);
        if (proximityToastTimeoutRef.current) {
          clearTimeout(proximityToastTimeoutRef.current);
        }
        proximityToastTimeoutRef.current = setTimeout(() => {
          setProximityTriggeredReason(null);
        }, 5500);
      },
    });

    return () => {
      stopProximity();
    };
  }, [proximityAutoOffEnabled, isTorchOn, updateHardwareTorch]);

  useEffect(() => {
    return () => {
      if (proximityToastTimeoutRef.current) {
        clearTimeout(proximityToastTimeoutRef.current);
      }
    };
  }, []);

  // Strobe Mode Logic (supports Constant, Flicker, Pulse, and Heartbeat waveforms)
  const handleToggleStrobe = useCallback(() => {
    const next = !isStrobeActive;
    setIsStrobeActive(next);
    if (soundEnabled) playSwitchClick(next);
    if (hapticEnabled) triggerLightToggleHaptic('strobe', next);

    if (!next) {
      if (strobeTimerRef.current) clearTimeout(strobeTimerRef.current);
      setStrobeFlashTick(false);
      updateHardwareTorch(false);
    }
  }, [isStrobeActive, soundEnabled, hapticEnabled, updateHardwareTorch]);

  const handleChangeStrobePattern = useCallback(
    (next: StrobePattern) => {
      setStrobePattern(next);
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
      try {
        window.localStorage.setItem(STROBE_PATTERN_KEY, next);
      } catch {
        // ignore storage errors
      }
    },
    [hapticEnabled],
  );

  useEffect(() => {
    if (!isStrobeActive) {
      if (strobeTimerRef.current) clearTimeout(strobeTimerRef.current);
      return;
    }

    let cancelled = false;
    let stepIndex = 0;
    const basePeriodMs = Math.max(40, Math.round(1000 / strobeFrequency));

    const getNextPhase = (): { on: boolean; durationMs: number } => {
      switch (strobePattern) {
        case 'constant': {
          const on = stepIndex % 2 === 0;
          const halfPeriod = Math.max(20, Math.round(basePeriodMs / 2));
          stepIndex += 1;
          return { on, durationMs: halfPeriod };
        }
        case 'pulse': {
          const on = stepIndex % 2 === 0;
          const onMs = Math.max(22, Math.round(basePeriodMs * 0.22));
          const offMs = Math.max(36, basePeriodMs - onMs);
          stepIndex += 1;
          return { on, durationMs: on ? onMs : offMs };
        }
        case 'heartbeat': {
          // Lub-dub cardiac cycle scaled smoothly across 1–25 Hz (~1800ms down to ~420ms)
          const cycleMs = Math.max(420, Math.round(1900 - ((strobeFrequency - 1) / 24) * 1480));
          const phases: Array<{ on: boolean; ratio: number }> = [
            { on: true, ratio: 0.12 },  // Lub
            { on: false, ratio: 0.10 }, // Short inter-beat gap
            { on: true, ratio: 0.15 },  // Dub
            { on: false, ratio: 0.63 }, // Resting pause
          ];
          const phase = phases[stepIndex % phases.length];
          stepIndex += 1;
          return {
            on: phase.on,
            durationMs: Math.max(35, Math.round(cycleMs * phase.ratio)),
          };
        }
        case 'flicker': {
          const on = stepIndex % 2 === 0;
          const half = Math.max(20, basePeriodMs / 2);
          const jitterFactor = on
            ? 0.35 + Math.random() * 0.65
            : 0.25 + Math.random() * 1.15;
          stepIndex += 1;
          return {
            on,
            durationMs: Math.max(20, Math.round(half * jitterFactor)),
          };
        }
      }
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const { on, durationMs } = getNextPhase();
      setStrobeFlashTick(on);
      if (hasHardwareTorch) {
        updateHardwareTorch(on);
      }
      strobeTimerRef.current = setTimeout(scheduleNext, durationMs);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (strobeTimerRef.current) clearTimeout(strobeTimerRef.current);
      setStrobeFlashTick(false);
      updateHardwareTorch(false);
    };
  }, [isStrobeActive, strobeFrequency, strobePattern, hasHardwareTorch, updateHardwareTorch]);

  // Emergency SOS Mode Logic (supports standard Morse SOS and custom sequences/timings)
  const runSosSequence = useCallback(() => {
    if (!isSosRunningRef.current) return;

    let current = 0;

    const executeStep = () => {
      if (!isSosRunningRef.current) return;

      const activeSettings = sosSettingsRef.current;
      const steps = activeSettings.steps;
      if (!steps.length) return;

      const stepIdx = current % steps.length;
      const item = steps[stepIdx];
      const isDash = item.type === 'dash';
      const duration = isDash
        ? activeSettings.dashDurationMs
        : activeSettings.dotDurationMs;
      const isLastStep = stepIdx === steps.length - 1;
      const pauseAfter = isLastStep
        ? activeSettings.repeatPauseMs
        : activeSettings.pulseGapMs * (item.gapUnits ?? 1);

      setSosStepIndex(stepIdx);
      setSosIsEmitting(true);
      updateHardwareTorch(true);

      if (soundEnabledRef.current && !sosToneMutedRef.current) {
        playMorseTone(duration, isDash ? 750 : 850, {
          volume: sosToneVolumeRef.current,
          syncSystemVolume: sosSyncSystemVolumeRef.current,
        });
      }

      sosTimeoutRef.current = setTimeout(() => {
        if (!isSosRunningRef.current) return;
        setSosIsEmitting(false);
        updateHardwareTorch(false);

        sosTimeoutRef.current = setTimeout(() => {
          if (!isSosRunningRef.current) return;
          const latestLen = sosSettingsRef.current.steps.length || 1;
          current = (stepIdx + 1) % latestLen;
          executeStep();
        }, pauseAfter);
      }, duration);
    };

    executeStep();
  }, [updateHardwareTorch]);

  const handleToggleSos = useCallback(() => {
    const next = !isSosActive;
    setIsSosActive(next);
    isSosRunningRef.current = next;

    if (soundEnabled) playSwitchClick(next);
    if (hapticEnabled) triggerLightToggleHaptic('sos', next);

    if (next) {
      runSosSequence();
    } else {
      if (sosTimeoutRef.current) clearTimeout(sosTimeoutRef.current);
      setSosIsEmitting(false);
      stopActiveMorseTone();
      updateHardwareTorch(false);
    }
  }, [isSosActive, soundEnabled, hapticEnabled, runSosSequence, updateHardwareTorch]);

  const handleTransmitCustomSosMessage = useCallback(
    (nextSettings: SosSettings) => {
      handleChangeSosSettings(nextSettings);

      // Stop any conflicting torch/strobe light and restart SOS cleanly from the first letter
      setIsTorchOn(false);
      setTimerRemaining(null);
      if (autoOffTimerRef.current) clearInterval(autoOffTimerRef.current);
      if (isStrobeActive) {
        setIsStrobeActive(false);
        if (strobeTimerRef.current) clearTimeout(strobeTimerRef.current);
        setStrobeFlashTick(false);
      }

      if (sosTimeoutRef.current) clearTimeout(sosTimeoutRef.current);
      setSosStepIndex(0);
      setIsSosActive(true);
      isSosRunningRef.current = true;

      if (soundEnabled) playSwitchClick(true);
      if (hapticEnabled) triggerLightToggleHaptic('sos', true);

      runSosSequence();
    },
    [
      handleChangeSosSettings,
      isStrobeActive,
      soundEnabled,
      hapticEnabled,
      runSosSequence,
    ],
  );

  useEffect(() => {
    return () => {
      isSosRunningRef.current = false;
      if (sosTimeoutRef.current) clearTimeout(sosTimeoutRef.current);
      if (voiceConfirmTimeoutRef.current) clearTimeout(voiceConfirmTimeoutRef.current);
      stopActiveMorseTone();
      emergencySiren.stop();
    };
  }, []);

  const showVoiceFeedback = useCallback((message: string) => {
    setVoiceConfirmation(message);
    if (voiceConfirmTimeoutRef.current) {
      clearTimeout(voiceConfirmTimeoutRef.current);
    }
    voiceConfirmTimeoutRef.current = setTimeout(() => {
      setVoiceConfirmation(null);
    }, 3800);
  }, []);

  const executeVoiceCommand = useCallback(
    (command: VoiceCommand) => {
      const tCommon = translations[language].common;

      const stopStrobeClean = () => {
        setIsStrobeActive(false);
        if (strobeTimerRef.current) clearTimeout(strobeTimerRef.current);
        setStrobeFlashTick(false);
      };

      const stopSosClean = () => {
        setIsSosActive(false);
        isSosRunningRef.current = false;
        if (sosTimeoutRef.current) clearTimeout(sosTimeoutRef.current);
        setSosIsEmitting(false);
        stopActiveMorseTone();
        emergencySiren.stop();
      };

      switch (command.type) {
        case 'torch-on': {
          stopStrobeClean();
          stopSosClean();
          setIsFullscreenScreenLight(false);
          setIsFullscreenScanner(false);
          setCurrentMode('torch');
          setIsTorchOn(true);
          setProximityTriggeredReason(null);
          if (soundEnabledRef.current) playSwitchClick(true);
          if (hapticEnabledRef.current)
            triggerLightToggleHaptic('torch', true, torchHapticPatternRef.current);
          void updateHardwareTorch(true, torchIntensity);
          if (activeTimer > 0) setTimerRemaining(activeTimer);
          showVoiceFeedback(tCommon.voiceCmdTorchOn);
          break;
        }
        case 'torch-off': {
          setIsTorchOn(false);
          setTimerRemaining(null);
          if (autoOffTimerRef.current) clearInterval(autoOffTimerRef.current);
          if (soundEnabledRef.current) playSwitchClick(false);
          if (hapticEnabledRef.current)
            triggerLightToggleHaptic('torch', false, torchHapticPatternRef.current);
          void updateHardwareTorch(false);
          showVoiceFeedback(tCommon.voiceCmdTorchOff);
          break;
        }
        case 'sos-start': {
          stopStrobeClean();
          setIsTorchOn(false);
          setTimerRemaining(null);
          if (autoOffTimerRef.current) clearInterval(autoOffTimerRef.current);
          setIsFullscreenScreenLight(false);
          setIsFullscreenScanner(false);
          setCurrentMode('sos');
          if (!isSosRunningRef.current) {
            setIsSosActive(true);
            isSosRunningRef.current = true;
            if (soundEnabledRef.current) playSwitchClick(true);
            if (hapticEnabledRef.current) triggerLightToggleHaptic('sos', true);
            runSosSequence();
          }
          showVoiceFeedback(tCommon.voiceCmdSosStart);
          break;
        }
        case 'sos-stop': {
          stopSosClean();
          if (soundEnabledRef.current) playSwitchClick(false);
          if (hapticEnabledRef.current) triggerLightToggleHaptic('sos', false);
          void updateHardwareTorch(false);
          showVoiceFeedback(tCommon.voiceCmdSosStop);
          break;
        }
        case 'strobe-start': {
          stopSosClean();
          setIsTorchOn(false);
          setTimerRemaining(null);
          if (autoOffTimerRef.current) clearInterval(autoOffTimerRef.current);
          setIsFullscreenScreenLight(false);
          setIsFullscreenScanner(false);
          setCurrentMode('strobe');
          setIsStrobeActive(true);
          if (soundEnabledRef.current) playSwitchClick(true);
          if (hapticEnabledRef.current) triggerLightToggleHaptic('strobe', true);
          showVoiceFeedback(tCommon.voiceCmdStrobeStart);
          break;
        }
        case 'strobe-stop': {
          stopStrobeClean();
          if (soundEnabledRef.current) playSwitchClick(false);
          if (hapticEnabledRef.current) triggerLightToggleHaptic('strobe', false);
          void updateHardwareTorch(false);
          showVoiceFeedback(tCommon.voiceCmdStrobeStop);
          break;
        }
        case 'screen-mode': {
          stopStrobeClean();
          stopSosClean();
          setIsFullscreenScanner(false);
          setCurrentMode('screen');
          if (hapticEnabledRef.current) triggerHaptic(HAPTIC_PATTERNS.confirm);
          showVoiceFeedback(tCommon.voiceCmdScreenMode);
          break;
        }
        case 'scanner-mode': {
          stopStrobeClean();
          stopSosClean();
          setIsFullscreenScreenLight(false);
          setCurrentMode('scanner');
          if (hapticEnabledRef.current) triggerHaptic(HAPTIC_PATTERNS.confirm);
          showVoiceFeedback(tCommon.voiceCmdScannerMode);
          break;
        }
        case 'brightness-set': {
          handleChangeTorchIntensity(command.level);
          if (currentModeRef.current === 'screen') {
            setScreenBrightness(command.level);
          }
          if (hapticEnabledRef.current) triggerHaptic(HAPTIC_PATTERNS.confirm);
          showVoiceFeedback(
            `${tCommon.voiceCmdBrightness} ${Math.round(command.level * 100)}%`,
          );
          break;
        }
        case 'all-off': {
          setIsTorchOn(false);
          setTimerRemaining(null);
          if (autoOffTimerRef.current) clearInterval(autoOffTimerRef.current);
          stopStrobeClean();
          stopSosClean();
          setIsFullscreenScreenLight(false);
          setIsFullscreenScanner(false);
          if (soundEnabledRef.current) playSwitchClick(false);
          if (hapticEnabledRef.current)
            triggerLightToggleHaptic('torch', false, torchHapticPatternRef.current);
          void updateHardwareTorch(false);
          showVoiceFeedback(tCommon.voiceCmdAllOff);
          break;
        }
      }
    },
    [
      language,
      torchIntensity,
      activeTimer,
      updateHardwareTorch,
      runSosSequence,
      handleChangeTorchIntensity,
      showVoiceFeedback,
    ],
  );

  const executeVoiceCommandRef = useRef(executeVoiceCommand);
  executeVoiceCommandRef.current = executeVoiceCommand;

  const mapVoiceError = useCallback(
    (code: VoiceErrorCode): string => {
      const tCommon = translations[language].common;
      switch (code) {
        case 'unsupported':
          return tCommon.voiceUnsupported;
        case 'permission-denied':
          return tCommon.voicePermissionDenied;
        case 'no-microphone':
          return tCommon.voiceNoMic;
        case 'network':
          return tCommon.voiceNetworkError;
        default:
          return tCommon.voiceUnknownError;
      }
    },
    [language],
  );
  const mapVoiceErrorRef = useRef(mapVoiceError);
  mapVoiceErrorRef.current = mapVoiceError;

  const handleToggleVoiceControl = useCallback(() => {
    if (voiceEnabled) {
      setVoiceEnabled(false);
      setVoiceListening(false);
      setVoiceTranscript('');
      setVoiceError(null);
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setVoiceError(translations[language].common.voiceUnsupported);
      return;
    }

    setVoiceError(null);
    setVoiceTranscript('');
    setVoiceEnabled(true);
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
  }, [voiceEnabled, language, hapticEnabled]);

  useEffect(() => {
    if (!voiceEnabled) return;

    const stopVoice = startVoiceCommandListener({
      language,
      onListeningChange: (listening) => setVoiceListening(listening),
      onTranscript: (transcript) => setVoiceTranscript(transcript),
      onCommand: (command) => {
        executeVoiceCommandRef.current(command);
      },
      onError: (code) => {
        setVoiceEnabled(false);
        setVoiceListening(false);
        setVoiceError(mapVoiceErrorRef.current(code));
      },
    });

    return () => {
      stopVoice();
    };
  }, [voiceEnabled, language]);

  // Pause front camera ambient monitoring whenever any light is already active to avoid camera conflicts
  const isAnyLightActiveForAmbient =
    isTorchOn ||
    isStrobeActive ||
    isSosActive ||
    currentMode === 'screen' ||
    isFullscreenScanner;

  const mapAmbientError = useCallback(
    (code: AmbientLightErrorCode): string => {
      const tTorch = translations[language].torchMode;
      switch (code) {
        case 'unsupported':
          return tTorch.ambientUnsupported;
        case 'permission-denied':
          return tTorch.ambientPermissionDenied;
        case 'no-camera':
          return tTorch.ambientNoCamera;
        default:
          return tTorch.ambientUnknownError;
      }
    },
    [language],
  );
  const mapAmbientErrorRef = useRef(mapAmbientError);
  mapAmbientErrorRef.current = mapAmbientError;

  const handleToggleAmbientSensor = useCallback(() => {
    if (ambientSensorEnabled) {
      setAmbientSensorEnabled(false);
      setAmbientLevel(null);
      setAmbientCategory(null);
      setIsDarkDetected(false);
      setAmbientDismissed(false);
      setAmbientError(null);
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
      return;
    }

    if (!isFrontCameraSupported()) {
      setAmbientError(translations[language].torchMode.ambientUnsupported);
      return;
    }

    setAmbientError(null);
    setAmbientDismissed(false);
    setAmbientSensorEnabled(true);
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
  }, [ambientSensorEnabled, language, hapticEnabled]);

  useEffect(() => {
    if (!ambientSensorEnabled || isAnyLightActiveForAmbient) {
      setIsDarkDetected(false);
      return;
    }

    const stopMonitor = startFrontCameraAmbientMonitor({
      onReading: (reading) => {
        setAmbientLevel(reading.level);
        setAmbientCategory(reading.category);
        setIsDarkDetected(reading.isDarkSustained);
        if (reading.category !== 'dark') {
          setAmbientDismissed(false);
        }
      },
      onError: (code) => {
        setAmbientSensorEnabled(false);
        setAmbientLevel(null);
        setAmbientCategory(null);
        setIsDarkDetected(false);
        setAmbientError(mapAmbientErrorRef.current(code));
      },
    });

    return () => {
      stopMonitor();
    };
  }, [ambientSensorEnabled, isAnyLightActiveForAmbient]);

  const handleAmbientEnableTorch = useCallback(() => {
    setAmbientDismissed(true);
    setCurrentMode('torch');
    setIsTorchOn(true);
    setProximityTriggeredReason(null);
    if (soundEnabled) playSwitchClick(true);
    if (hapticEnabled) triggerLightToggleHaptic('torch', true, torchHapticPatternRef.current);
    void updateHardwareTorch(true, torchIntensity);
    if (activeTimer > 0) setTimerRemaining(activeTimer);
  }, [soundEnabled, hapticEnabled, updateHardwareTorch, torchIntensity, activeTimer]);

  const handleAmbientOpenScreen = useCallback(() => {
    setAmbientDismissed(true);
    setCurrentMode('screen');
    if (screenBrightness < 0.75) {
      setScreenBrightness(1.0);
    }
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
  }, [screenBrightness, hapticEnabled]);

  const showAmbientDarkSuggestion =
    ambientSensorEnabled &&
    !isAnyLightActiveForAmbient &&
    isDarkDetected &&
    !ambientDismissed;

  const handleConservePower = useCallback(() => {
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
    if (isTorchOn) {
      setIsTorchOn(false);
      updateHardwareTorch(false);
    }
    if (isStrobeActive) {
      setIsStrobeActive(false);
      if (strobeTimerRef.current) clearTimeout(strobeTimerRef.current);
      setStrobeFlashTick(false);
      updateHardwareTorch(false);
    }
    if (screenBrightness > 0.4) {
      setScreenBrightness(0.4);
    }
    if (torchIntensity > 0.5) {
      handleChangeTorchIntensity(0.5);
    }
    if (shakeEnabled) {
      setShakeEnabled(false);
    }
    if (battery.level !== null) {
      setDismissedLowBatteryAt(battery.level);
    }
  }, [
    hapticEnabled,
    isTorchOn,
    isStrobeActive,
    screenBrightness,
    torchIntensity,
    handleChangeTorchIntensity,
    shakeEnabled,
    battery.level,
    updateHardwareTorch,
  ]);

  const handleChangeWidgetLayout = useCallback(
    (next: WidgetLayoutVariant) => {
      setWidgetLayout(next);
      try {
        window.localStorage.setItem(WIDGET_LAYOUT_KEY, next);
      } catch {
        // ignore storage errors
      }
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    },
    [hapticEnabled],
  );

  const handleToggleWidgetAutoStart = useCallback(() => {
    setWidgetAutoStart((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(WIDGET_AUTOSTART_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
  }, [hapticEnabled]);

  const handleEnterWidgetMode = useCallback(() => {
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    setIsWidgetMode(true);
    setCurrentMode('torch');
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('widget', 'torch');
      url.searchParams.delete('autostart');
      url.searchParams.delete('mode');
      window.history.replaceState({}, '', url.pathname + url.search);
    } catch {
      // ignore history errors
    }
  }, [hapticEnabled]);

  const handleExitWidgetMode = useCallback(() => {
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    setIsWidgetMode(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('widget');
      url.searchParams.delete('autostart');
      url.searchParams.delete('mode');
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
    } catch {
      // ignore history errors
    }
  }, [hapticEnabled]);

  const handleWidgetQuickSos = useCallback(() => {
    setIsWidgetMode(false);
    setIsTorchOn(false);
    setTimerRemaining(null);
    if (autoOffTimerRef.current) clearInterval(autoOffTimerRef.current);
    setCurrentMode('sos');
    if (!isSosRunningRef.current) {
      setIsSosActive(true);
      isSosRunningRef.current = true;
      if (soundEnabled) playSwitchClick(true);
      if (hapticEnabled) triggerLightToggleHaptic('sos', true);
      runSosSequence();
    }
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch {
      // ignore history errors
    }
  }, [soundEnabled, hapticEnabled, runSosSequence]);

  const handleWidgetQuickScreenLight = useCallback(() => {
    setIsWidgetMode(false);
    setCurrentMode('screen');
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch {
      // ignore history errors
    }
  }, [hapticEnabled]);

  // Execute instant shortcut auto-start when launched via ?widget=torch&autostart=1 or ?mode=sos&autostart=1
  const shortcutHandledRef = useRef<boolean>(false);
  useEffect(() => {
    if (shortcutHandledRef.current) return;
    shortcutHandledRef.current = true;
    const launch = initialLaunchRef.current;

    if (launch.widgetMode && (launch.autoStart || widgetAutoStart)) {
      setCurrentMode('torch');
      setIsTorchOn(true);
      void updateHardwareTorch(true, torchIntensityRef.current);
    } else if (launch.mode === 'sos' && launch.autoStart) {
      setCurrentMode('sos');
      setIsSosActive(true);
      isSosRunningRef.current = true;
      runSosSequence();
    }
  }, [widgetAutoStart, updateHardwareTorch, runSosSequence]);

  const isScreenTorchActive =
    ((currentMode === 'torch' || isWidgetMode) && isTorchOn && !hasHardwareTorch) ||
    (currentMode === 'strobe' && isStrobeActive && strobeFlashTick) ||
    (currentMode === 'sos' && isSosActive && sosIsEmitting);

  const isAnyFullscreen = isFullscreenScreenLight || isFullscreenScanner;
  const isAnyLightEngaged =
    isTorchOn || isStrobeActive || isSosActive || currentMode === 'screen';
  const canAdjustTorchIntensity = !(hasHardwareTorch && !torchIntensityCapability.supported);

  return (
    <div
      id="torch-app-root"
      className={`min-h-screen flex flex-col justify-between transition-colors duration-300 relative ${
        isScreenTorchActive ? 'bg-neutral-900' : 'bg-neutral-950'
      }`}
    >
      <OfflineIndicator language={language} />

      {!isAnyFullscreen && (
        <LiquidBackdrop
          currentMode={isWidgetMode ? 'torch' : currentMode}
          isLightActive={isAnyLightEngaged}
          uiTheme={uiTheme}
          screenColor={screenColor}
        />
      )}

      {isScreenTorchActive && (
        <div
          id="screen-flash-overlay"
          className="fixed inset-0 pointer-events-none z-10 transition-opacity duration-75"
          style={{
            backgroundColor: currentMode === 'sos' ? '#FFE4E6' : '#FFFFFF',
            opacity:
              currentMode === 'sos'
                ? 0.85
                : currentMode === 'torch' || isWidgetMode
                  ? 0.15 + torchIntensity * 0.8
                  : 0.95,
          }}
        />
      )}

      {isWidgetMode && !isAnyFullscreen ? (
        <HomescreenWidgetMode
          layout={widgetLayout}
          onChangeLayout={handleChangeWidgetLayout}
          isTorchOn={isTorchOn}
          onToggleTorch={() => void handleToggleTorch()}
          torchIntensity={torchIntensity}
          onChangeIntensity={handleChangeTorchIntensity}
          canAdjustIntensity={canAdjustTorchIntensity}
          hasHardwareTorch={hasHardwareTorch}
          battery={battery}
          language={language}
          uiTheme={uiTheme}
          pwaInstall={pwaInstall}
          onQuickSos={handleWidgetQuickSos}
          onQuickScreenLight={handleWidgetQuickScreenLight}
          onExitWidgetMode={handleExitWidgetMode}
        />
      ) : (
        <>
          {!isAnyFullscreen && (
            <Header
              language={language}
              onToggleLanguage={() => setLanguage((prev) => (prev === 'hi' ? 'en' : 'hi'))}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled((prev) => !prev)}
              hapticEnabled={hapticEnabled}
              onToggleHaptic={() => {
                setHapticEnabled((prev) => {
                  const next = !prev;
                  if (next) triggerHaptic(HAPTIC_PATTERNS.confirm);
                  return next;
                });
              }}
              wakeLockActive={wakeLockActive}
              hasHardwareTorch={hasHardwareTorch}
              battery={battery}
              voiceListening={voiceListening || voiceEnabled}
              onToggleVoice={handleToggleVoiceControl}
              uiTheme={uiTheme}
              onCycleUiTheme={handleCycleUiTheme}
              onOpenWidgetMode={handleEnterWidgetMode}
              pwaInstall={pwaInstall}
            />
          )}

      {!isAnyFullscreen && (
        <VoiceControlBanner
          language={language}
          isListening={voiceListening || voiceEnabled}
          liveTranscript={voiceTranscript}
          lastConfirmation={voiceConfirmation}
          error={voiceError}
          onStopListening={() => {
            setVoiceEnabled(false);
            setVoiceListening(false);
            setVoiceTranscript('');
            if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
          }}
          onDismissMessage={() => {
            setVoiceConfirmation(null);
            setVoiceError(null);
          }}
          onSimulateExample={(phrase) => {
            setVoiceTranscript(phrase);
            const parsed = parseVoiceCommand(phrase);
            if (parsed) executeVoiceCommand(parsed);
          }}
        />
      )}

      {!isAnyFullscreen && (
        <AmbientLightBanner
          visible={showAmbientDarkSuggestion}
          ambientLevel={ambientLevel}
          language={language}
          onEnableTorch={handleAmbientEnableTorch}
          onOpenScreenLight={handleAmbientOpenScreen}
          onDismiss={() => setAmbientDismissed(true)}
        />
      )}

      {!isAnyFullscreen && (
        <LowBatteryAlert
          visible={showLowBatteryAlert}
          batteryLevel={battery.level}
          language={language}
          onConservePower={handleConservePower}
          onDismiss={() => setDismissedLowBatteryAt(battery.level)}
        />
      )}

      <main
        className={`flex-1 flex flex-col pb-24 relative z-20 ${
          currentMode === 'studio' ? 'justify-start items-stretch' : 'justify-center items-center'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentMode}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 10, scale: 0.985 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -8, scale: 0.985 }
            }
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`w-full flex-1 flex flex-col ${
              currentMode === 'studio' ? 'justify-start items-stretch' : 'justify-center items-center'
            }`}
          >
            {currentMode === 'torch' && (
              <TorchMode
                isOn={isTorchOn}
                onToggle={handleToggleTorch}
                language={language}
                hasHardwareTorch={hasHardwareTorch}
                torchIntensity={torchIntensity}
                onChangeTorchIntensity={handleChangeTorchIntensity}
                torchIntensityCapability={torchIntensityCapability}
                hardwareStepInfo={torchManager.getDiscreteHardwareStep(torchIntensity)}
                torchError={torchError}
                onTimerChange={handleTimerChange}
                timerRemaining={timerRemaining}
                activeTimer={activeTimer}
                hapticEnabled={hapticEnabled}
                onEnableHaptic={() => setHapticEnabled(true)}
                torchHapticPattern={torchHapticPattern}
                onChangeTorchHapticPattern={handleChangeTorchHapticPattern}
                shakeEnabled={shakeEnabled}
                onToggleShake={() => void handleToggleShake()}
                shakeSensitivity={shakeSensitivity}
                onChangeShakeSensitivity={handleChangeShakeSensitivity}
                shakeError={shakeError}
                shakeTriggeredRecently={shakeTriggeredRecently}
                proximityAutoOffEnabled={proximityAutoOffEnabled}
                onToggleProximityAutoOff={() => void handleToggleProximityAutoOff()}
                proximitySensorMode={proximitySensorMode}
                proximityError={proximityError}
                proximityTriggeredReason={proximityTriggeredReason}
                ambientSensorEnabled={ambientSensorEnabled}
                onToggleAmbientSensor={handleToggleAmbientSensor}
                ambientLevel={ambientLevel}
                ambientCategory={ambientCategory}
                ambientSensorPaused={isAnyLightActiveForAmbient}
                ambientError={ambientError}
                uiTheme={uiTheme}
                onChangeUiTheme={handleChangeUiTheme}
                customLightingPresets={customLightingPresets}
                onSaveLightingPreset={handleSaveLightingPreset}
                onDeleteLightingPreset={handleDeleteLightingPreset}
                usageAccumulatedMs={usageAccumulatedMs}
                usageActiveStartedAt={usageActiveStartedAt}
                usageEntries={usageEntries}
                onResetUsageHistory={handleResetUsageHistory}
                battery={battery}
                pwaInstall={pwaInstall}
                widgetLayout={widgetLayout}
                onChangeWidgetLayout={handleChangeWidgetLayout}
                widgetAutoStart={widgetAutoStart}
                onToggleWidgetAutoStart={handleToggleWidgetAutoStart}
                onEnterWidgetMode={handleEnterWidgetMode}
                onQuickSos={handleWidgetQuickSos}
                onQuickScreenLight={handleWidgetQuickScreenLight}
              />
            )}

            {currentMode === 'strobe' && (
              <StrobeMode
                isActive={isStrobeActive}
                onToggle={handleToggleStrobe}
                frequency={strobeFrequency}
                onChangeFrequency={(hz) => {
                  setStrobeFrequency(hz);
                  if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
                }}
                pattern={strobePattern}
                onChangePattern={handleChangeStrobePattern}
                language={language}
                flashTick={strobeFlashTick}
                hapticEnabled={hapticEnabled}
                uiTheme={uiTheme}
              />
            )}

            {currentMode === 'sos' && (
              <SosMode
                isActive={isSosActive}
                onToggle={handleToggleSos}
                language={language}
                currentStepIndex={sosStepIndex}
                isEmitting={sosIsEmitting}
                soundEnabled={soundEnabled}
                sosToneMuted={sosToneMuted}
                onToggleSosMute={handleToggleSosMute}
                sosSyncSystemVolume={sosSyncSystemVolume}
                onToggleSosSyncSystemVolume={handleToggleSosSyncSystemVolume}
                sosToneVolume={sosToneVolume}
                onChangeSosToneVolume={handleChangeSosToneVolume}
                hapticEnabled={hapticEnabled}
                sosSettings={sosSettings}
                onChangeSosSettings={handleChangeSosSettings}
                onTransmitCustomMessage={handleTransmitCustomSosMessage}
              />
            )}

            {currentMode === 'screen' && (
              <ScreenLightMode
                language={language}
                selectedColor={screenColor}
                onSelectColor={(color, fromDrag) => {
                  setScreenColor(color);
                  if (hapticEnabled && !fromDrag) triggerHaptic(HAPTIC_PATTERNS.tap);
                }}
                brightness={screenBrightness}
                onChangeBrightness={(b) => setScreenBrightness(b)}
                isFullscreen={isFullscreenScreenLight}
                onToggleFullscreen={() => {
                  setIsFullscreenScreenLight((prev) => {
                    const next = !prev;
                    if (hapticEnabled) triggerLightToggleHaptic('screen', next);
                    return next;
                  });
                }}
              />
            )}

            {currentMode === 'scanner' && (
              <ScannerMode
                language={language}
                hapticEnabled={hapticEnabled}
                isFullscreen={isFullscreenScanner}
                onToggleFullscreen={() => {
                  setIsFullscreenScanner((prev) => {
                    const next = !prev;
                    if (hapticEnabled) triggerLightToggleHaptic('screen', next);
                    return next;
                  });
                }}
                config={scannerConfig}
                onChangeConfig={handleChangeScannerConfig}
              />
            )}

            {currentMode === 'studio' && (
              <AiStudioMode
                language={language}
                messages={chatMessages}
                setMessages={setChatMessages}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {!isAnyFullscreen && (
        <BottomNav
          currentMode={currentMode}
          onSelectMode={handleSelectMode}
          language={language}
        />
      )}
        </>
      )}
    </div>
  );
}
