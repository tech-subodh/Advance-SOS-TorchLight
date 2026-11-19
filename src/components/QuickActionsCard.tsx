import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Bluetooth,
  MapPin,
  Settings2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { HAPTIC_PATTERNS, triggerHaptic } from '../utils/audio';
import {
  DevicePlatform,
  QuickActionId,
  QuickActionLiveStatus,
  detectDevicePlatform,
  getSystemSettingsDeepLink,
  requestBluetoothDevicePicker,
  requestBrowserLocationAccess,
  subscribeQuickActionStatus,
  triggerSystemDeepLink,
} from '../utils/quickActions';

interface QuickActionsCardProps {
  language: Language;
  hapticEnabled?: boolean;
}

const PLATFORM_LABELS: Record<DevicePlatform, string> = {
  android: 'Android',
  ios: 'iOS',
  windows: 'Windows',
  macos: 'macOS',
  other: 'Web',
};

export const QuickActionsCard: React.FC<QuickActionsCardProps> = ({
  language,
  hapticEnabled = true,
}) => {
  const t = translations[language].torchMode;
  const platform = useMemo<DevicePlatform>(() => detectDevicePlatform(), []);

  const [status, setStatus] = useState<QuickActionLiveStatus>({
    wifiOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wifiType: null,
    bluetoothAvailable: null,
    bluetoothApiSupported: false,
    locationPermission: 'prompt',
  });

  const [activeAction, setActiveAction] = useState<QuickActionId | null>(null);
  const [extraMessage, setExtraMessage] = useState<string | null>(null);

  useEffect(() => {
    return subscribeQuickActionStatus(setStatus);
  }, []);

  const platformHint =
    platform === 'android'
      ? t.quickHintAndroid
      : platform === 'ios'
        ? t.quickHintIos
        : t.quickHintDesktop;

  const handleActionClick = (action: QuickActionId) => {
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    setActiveAction(action);
    setExtraMessage(null);

    const deepLink = getSystemSettingsDeepLink(action, platform);
    if (deepLink) {
      triggerSystemDeepLink(deepLink);
    }
  };

  const handleBluetoothScan = async () => {
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    const result = await requestBluetoothDevicePicker();
    if (result.status === 'selected') {
      setExtraMessage(`${t.quickBluetoothConnected} ${result.name}`);
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
    }
  };

  const handleRequestLocation = async () => {
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
    const result = await requestBrowserLocationAccess();
    if (result === 'granted') {
      setStatus((prev) => ({ ...prev, locationPermission: 'granted' }));
      setExtraMessage(t.quickLocationGranted);
      if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.confirm);
    } else if (result === 'denied') {
      setStatus((prev) => ({ ...prev, locationPermission: 'denied' }));
      setExtraMessage(t.quickLocationDenied);
    }
  };

  const wifiStatusLabel = !status.wifiOnline
    ? t.quickStatusOffline
    : status.wifiType === 'wifi'
      ? t.quickStatusWifi
      : t.quickStatusOnline;

  const bluetoothStatusLabel =
    status.bluetoothAvailable === true
      ? t.quickStatusReady
      : status.bluetoothAvailable === false
        ? t.quickStatusOff
        : t.quickStatusSettings;

  const locationStatusLabel =
    status.locationPermission === 'granted'
      ? t.quickStatusAllowed
      : status.locationPermission === 'denied'
        ? t.quickStatusBlocked
        : t.quickStatusSettings;

  const actions: Array<{
    id: QuickActionId;
    label: string;
    statusLabel: string;
    isActive: boolean;
    icon: React.ReactNode;
  }> = [
    {
      id: 'bluetooth',
      label: t.quickBluetooth,
      statusLabel: bluetoothStatusLabel,
      isActive: status.bluetoothAvailable === true,
      icon: <Bluetooth className="w-4 h-4" aria-hidden="true" />,
    },
    {
      id: 'wifi',
      label: t.quickWifi,
      statusLabel: wifiStatusLabel,
      isActive: status.wifiOnline,
      icon: status.wifiOnline ? (
        <Wifi className="w-4 h-4" aria-hidden="true" />
      ) : (
        <WifiOff className="w-4 h-4" aria-hidden="true" />
      ),
    },
    {
      id: 'location',
      label: t.quickLocation,
      statusLabel: locationStatusLabel,
      isActive: status.locationPermission === 'granted',
      icon: <MapPin className="w-4 h-4" aria-hidden="true" />,
    },
  ];

  const activeOpeningMessage =
    activeAction === 'wifi'
      ? t.quickOpeningWifi
      : activeAction === 'bluetooth'
        ? t.quickOpeningBluetooth
        : activeAction === 'location'
          ? t.quickOpeningLocation
          : null;

  return (
    <div
      id="torch-quick-actions-card"
      className="w-full glass-panel rounded-2xl p-3.5 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 glass-surface text-amber-400">
            <Settings2 className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white leading-tight truncate">
              {t.quickActionsTitle}
            </div>
            <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
              {t.quickActionsSubtitle}
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 shrink-0 pt-0.5">
          {PLATFORM_LABELS[platform]}
        </span>
      </div>

      {/* 3-Column Quick Actions Grid */}
      <div className="grid grid-cols-3 gap-2">
        {actions.map((item) => {
          const isSelected = activeAction === item.id;
          return (
            <button
              key={item.id}
              id={`quick-action-${item.id}`}
              type="button"
              onClick={() => handleActionClick(item.id)}
              className={`relative min-h-[76px] p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all active:scale-95 ${
                isSelected
                  ? 'bg-amber-500/18 border-amber-400/55 text-white shadow-[0_4px_16px_rgba(245,158,11,0.18),inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : item.isActive
                    ? 'glass-surface border-white/18 text-white'
                    : 'glass-surface text-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={
                    isSelected || item.isActive ? 'text-amber-400' : 'text-neutral-400'
                  }
                >
                  {item.icon}
                </span>
                <ArrowUpRight
                  className="w-3.5 h-3.5 text-neutral-500"
                  aria-hidden="true"
                />
              </div>

              <div className="mt-2 min-w-0">
                <div className="text-xs font-semibold leading-tight truncate">
                  {item.label}
                </div>
                <div
                  className={`text-[10px] leading-tight mt-0.5 truncate ${
                    item.isActive ? 'text-emerald-400/90' : 'text-neutral-500'
                  }`}
                >
                  {item.statusLabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Contextual Deep-Link & Native Action Feedback Strip */}
      {activeAction && activeOpeningMessage && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl glass-input p-2.5 space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] font-medium text-amber-300 leading-snug">
                {activeOpeningMessage}
              </p>
              <p className="text-[11px] text-neutral-400 leading-snug">
                {platformHint}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveAction(null);
                setExtraMessage(null);
              }}
              aria-label={translations[language].common.dismiss}
              className="p-1 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 shrink-0"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {extraMessage && (
            <p className="text-[11px] font-medium text-emerald-400 leading-snug">
              {extraMessage}
            </p>
          )}

          {activeAction === 'bluetooth' && status.bluetoothApiSupported && (
            <button
              id="quick-action-bluetooth-scan"
              type="button"
              onClick={() => void handleBluetoothScan()}
              className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-[11px] font-semibold transition-colors"
            >
              {t.quickBluetoothScanBtn}
            </button>
          )}

          {activeAction === 'location' &&
            status.locationPermission !== 'granted' &&
            status.locationPermission !== 'unsupported' && (
              <button
                id="quick-action-location-allow"
                type="button"
                onClick={() => void handleRequestLocation()}
                className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-[11px] font-semibold transition-colors"
              >
                {t.quickLocationAllowBtn}
              </button>
            )}
        </div>
      )}
    </div>
  );
};
