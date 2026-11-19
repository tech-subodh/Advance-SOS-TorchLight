import { useEffect, useState } from 'react';

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
}

export interface BatteryStatus {
  level: number | null;
  charging: boolean;
  supported: boolean;
  isLowBattery: boolean;
}

export const LOW_BATTERY_THRESHOLD = 15;

export function useBatteryStatus(): BatteryStatus {
  const [status, setStatus] = useState<BatteryStatus>({
    level: null,
    charging: false,
    supported: false,
    isLowBattery: false,
  });

  useEffect(() => {
    let batteryManager: BatteryManagerLike | null = null;
    let isMounted = true;

    const syncBattery = () => {
      if (!batteryManager || !isMounted) return;
      const pct = Math.max(0, Math.min(100, Math.round(batteryManager.level * 100)));
      const charging = Boolean(batteryManager.charging);
      setStatus({
        level: pct,
        charging,
        supported: true,
        isLowBattery: !charging && pct < LOW_BATTERY_THRESHOLD,
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncBattery();
      }
    };

    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManagerLike>;
    };

    if (typeof nav !== 'undefined' && typeof nav.getBattery === 'function') {
      nav
        .getBattery()
        .then((manager) => {
          if (!isMounted) return;
          batteryManager = manager;
          syncBattery();
          manager.addEventListener('levelchange', syncBattery);
          manager.addEventListener('chargingchange', syncBattery);
          manager.addEventListener('chargingtimechange', syncBattery);
          manager.addEventListener('dischargingtimechange', syncBattery);
          document.addEventListener('visibilitychange', handleVisibility);
        })
        .catch(() => {
          if (isMounted) {
            setStatus({
              level: null,
              charging: false,
              supported: false,
              isLowBattery: false,
            });
          }
        });
    }

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (batteryManager) {
        batteryManager.removeEventListener('levelchange', syncBattery);
        batteryManager.removeEventListener('chargingchange', syncBattery);
        batteryManager.removeEventListener('chargingtimechange', syncBattery);
        batteryManager.removeEventListener('dischargingtimechange', syncBattery);
      }
    };
  }, []);

  return status;
}
