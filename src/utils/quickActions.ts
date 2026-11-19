/**
 * Device Quick Actions utility for Bluetooth, Wi-Fi, and Location.
 * Detects live browser/hardware status and builds native OS settings deep links
 * without using window.open or window.alert.
 */

export type QuickActionId = 'wifi' | 'bluetooth' | 'location';

export type DevicePlatform = 'android' | 'ios' | 'windows' | 'macos' | 'other';

export interface QuickActionLiveStatus {
  wifiOnline: boolean;
  wifiType: string | null;
  bluetoothAvailable: boolean | null;
  bluetoothApiSupported: boolean;
  locationPermission: 'granted' | 'prompt' | 'denied' | 'unsupported';
}

interface NetworkInformationLike extends EventTarget {
  type?: string;
  effectiveType?: string;
}

interface NavigatorWithExtras extends Navigator {
  connection?: NetworkInformationLike;
  bluetooth?: {
    getAvailability?: () => Promise<boolean>;
    requestDevice?: (options: { acceptAllDevices?: boolean }) => Promise<{ name?: string; id: string }>;
    addEventListener?: (type: string, listener: EventListener) => void;
    removeEventListener?: (type: string, listener: EventListener) => void;
  };
}

export function detectDevicePlatform(): DevicePlatform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';

  if (/Android/i.test(ua)) return 'android';
  if (
    /iPad|iPhone|iPod/i.test(ua) ||
    (platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1)
  ) {
    return 'ios';
  }
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return 'windows';
  if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) return 'macos';
  return 'other';
}

/**
 * Returns the native system settings deep link URI for the detected OS,
 * or null if the platform does not expose a standard deep link scheme.
 */
export function getSystemSettingsDeepLink(
  action: QuickActionId,
  platform: DevicePlatform,
): string | null {
  switch (platform) {
    case 'android': {
      const intentActions: Record<QuickActionId, string> = {
        wifi: 'android.settings.WIFI_SETTINGS',
        bluetooth: 'android.settings.BLUETOOTH_SETTINGS',
        location: 'android.settings.LOCATION_SOURCE_SETTINGS',
      };
      return `intent:#Intent;action=${intentActions[action]};end`;
    }
    case 'ios': {
      const iosPrefs: Record<QuickActionId, string> = {
        wifi: 'App-Prefs:root=WIFI',
        bluetooth: 'App-Prefs:root=Bluetooth',
        location: 'App-Prefs:root=Privacy&path=LOCATION',
      };
      return iosPrefs[action];
    }
    case 'windows': {
      const winSettings: Record<QuickActionId, string> = {
        wifi: 'ms-settings:network-wifi',
        bluetooth: 'ms-settings:bluetooth',
        location: 'ms-settings:privacy-location',
      };
      return winSettings[action];
    }
    case 'macos': {
      const macSettings: Record<QuickActionId, string> = {
        wifi: 'x-apple.systempreferences:com.apple.wifi-settings-extension',
        bluetooth: 'x-apple.systempreferences:com.apple.BluetoothSettings',
        location: 'x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices',
      };
      return macSettings[action];
    }
    default:
      return null;
  }
}

/**
 * Trigger a native OS deep link via an anchor click inside a user gesture
 * (avoids window.open and keeps the SPA intact).
 */
export function triggerSystemDeepLink(uri: string): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = uri;
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Invoke native Web Bluetooth device picker if supported by the browser.
 */
export async function requestBluetoothDevicePicker(): Promise<
  { status: 'selected'; name: string } | { status: 'cancelled' } | { status: 'unsupported' }
> {
  const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithExtras) : null;
  if (!nav?.bluetooth?.requestDevice) {
    return { status: 'unsupported' };
  }
  try {
    const device = await nav.bluetooth.requestDevice({ acceptAllDevices: true });
    return { status: 'selected', name: device.name || device.id };
  } catch {
    return { status: 'cancelled' };
  }
}

/**
 * Request native browser Location access via Geolocation API.
 */
export function requestBrowserLocationAccess(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve('unsupported');
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      (err) => resolve(err.code === err.PERMISSION_DENIED ? 'denied' : 'granted'),
      { timeout: 6000, maximumAge: 60000 },
    );
  });
}

/**
 * Subscribe to live Wi-Fi/Network, Bluetooth availability, and Location permission status.
 */
export function subscribeQuickActionStatus(
  onUpdate: (status: QuickActionLiveStatus) => void,
): () => void {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  const nav = navigator as NavigatorWithExtras;
  const state: QuickActionLiveStatus = {
    wifiOnline: navigator.onLine,
    wifiType: nav.connection?.type || null,
    bluetoothAvailable: null,
    bluetoothApiSupported: Boolean(nav.bluetooth?.requestDevice),
    locationPermission: 'geolocation' in navigator ? 'prompt' : 'unsupported',
  };

  let active = true;
  const emit = () => {
    if (active) onUpdate({ ...state });
  };

  emit();

  // 1. Network / Wi-Fi listeners
  const handleNetworkChange = () => {
    state.wifiOnline = navigator.onLine;
    state.wifiType = nav.connection?.type || null;
    emit();
  };
  window.addEventListener('online', handleNetworkChange);
  window.addEventListener('offline', handleNetworkChange);
  nav.connection?.addEventListener?.('change', handleNetworkChange);

  // 2. Web Bluetooth availability listener
  const handleBluetoothAvailability = (event: Event) => {
    const value = (event as unknown as { value?: boolean }).value;
    if (typeof value === 'boolean') {
      state.bluetoothAvailable = value;
      emit();
    }
  };

  if (nav.bluetooth?.getAvailability) {
    nav.bluetooth
      .getAvailability()
      .then((avail) => {
        state.bluetoothAvailable = avail;
        emit();
      })
      .catch(() => {
        // Ignore browser restriction
      });
    nav.bluetooth.addEventListener?.('availabilitychanged', handleBluetoothAvailability);
  }

  // 3. Location permission status listener
  let geoPermissionStatus: PermissionStatus | null = null;
  const handleGeoPermissionChange = () => {
    if (!geoPermissionStatus) return;
    if (
      geoPermissionStatus.state === 'granted' ||
      geoPermissionStatus.state === 'denied' ||
      geoPermissionStatus.state === 'prompt'
    ) {
      state.locationPermission = geoPermissionStatus.state;
      emit();
    }
  };

  if ('permissions' in navigator && typeof navigator.permissions.query === 'function') {
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((permStatus) => {
        if (!active) return;
        geoPermissionStatus = permStatus;
        handleGeoPermissionChange();
        permStatus.addEventListener('change', handleGeoPermissionChange);
      })
      .catch(() => {
        // Ignore unsupported Permissions API query
      });
  }

  return () => {
    active = false;
    window.removeEventListener('online', handleNetworkChange);
    window.removeEventListener('offline', handleNetworkChange);
    nav.connection?.removeEventListener?.('change', handleNetworkChange);
    nav.bluetooth?.removeEventListener?.('availabilitychanged', handleBluetoothAvailability);
    geoPermissionStatus?.removeEventListener('change', handleGeoPermissionChange);
  };
}
