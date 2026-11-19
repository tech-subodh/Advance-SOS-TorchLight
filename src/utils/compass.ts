import { Language } from '../types';

interface DeviceOrientationEventWithExtras extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

interface DeviceOrientationConstructorWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export function isOrientationSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

export async function requestOrientationPermission(): Promise<
  'granted' | 'denied' | 'unsupported'
> {
  if (!isOrientationSupported()) {
    return 'unsupported';
  }

  const OrientationCtor =
    window.DeviceOrientationEvent as unknown as DeviceOrientationConstructorWithPermission;

  if (typeof OrientationCtor?.requestPermission === 'function') {
    try {
      const result = await OrientationCtor.requestPermission();
      return result === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  return 'granted';
}

const CARDINAL_LABELS_EN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const CARDINAL_LABELS_HI = [
  'उत्तर (N)',
  'उत्तर-पूर्व (NE)',
  'पूर्व (E)',
  'दक्षिण-पूर्व (SE)',
  'दक्षिण (S)',
  'दक्षिण-पश्चिम (SW)',
  'पश्चिम (W)',
  'उत्तर-पश्चिम (NW)',
] as const;

export function normalizeHeading(deg: number): number {
  const normalized = ((deg % 360) + 360) % 360;
  return normalized === 360 ? 0 : normalized;
}

export function getCardinalDirection(heading: number, language: Language): string {
  const normalized = normalizeHeading(heading);
  const index = Math.round(normalized / 45) % 8;
  return language === 'hi' ? CARDINAL_LABELS_HI[index] : CARDINAL_LABELS_EN[index];
}

export interface CompassListenerOptions {
  onHeading: (headingDegrees: number) => void;
  onUnavailable?: () => void;
}

/**
 * Listens to device orientation magnetometer heading (`webkitCompassHeading` on iOS,
 * `deviceorientationabsolute` or `deviceorientation` on Android/other browsers).
 * Returns a cleanup function that detaches listeners and timers.
 */
export function startCompassListener({
  onHeading,
  onUnavailable,
}: CompassListenerOptions): () => void {
  if (!isOrientationSupported()) {
    onUnavailable?.();
    return () => {};
  }

  let receivedValidReading = false;
  let receivedAbsolute = false;

  const extractHeading = (event: DeviceOrientationEventWithExtras): number | null => {
    if (
      typeof event.webkitCompassHeading === 'number' &&
      !Number.isNaN(event.webkitCompassHeading)
    ) {
      return normalizeHeading(event.webkitCompassHeading);
    }

    if (typeof event.alpha === 'number' && !Number.isNaN(event.alpha)) {
      const screenAngle =
        typeof window.screen?.orientation?.angle === 'number'
          ? window.screen.orientation.angle
          : 0;
      return normalizeHeading(360 - event.alpha + screenAngle);
    }

    return null;
  };

  const handleAbsolute = (event: Event) => {
    const heading = extractHeading(event as DeviceOrientationEventWithExtras);
    if (heading === null) return;
    receivedAbsolute = true;
    receivedValidReading = true;
    onHeading(heading);
  };

  const handleRelative = (event: DeviceOrientationEvent) => {
    if (receivedAbsolute) return;
    const heading = extractHeading(event as DeviceOrientationEventWithExtras);
    if (heading === null) return;
    receivedValidReading = true;
    onHeading(heading);
  };

  window.addEventListener('deviceorientationabsolute', handleAbsolute, true);
  window.addEventListener('deviceorientation', handleRelative, true);

  const fallbackTimer = setTimeout(() => {
    if (!receivedValidReading) {
      onUnavailable?.();
    }
  }, 1600);

  return () => {
    clearTimeout(fallbackTimer);
    window.removeEventListener('deviceorientationabsolute', handleAbsolute, true);
    window.removeEventListener('deviceorientation', handleRelative, true);
  };
}
