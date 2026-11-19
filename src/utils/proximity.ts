import { ProximitySensorMode, ProximityTriggerReason } from '../types';
import { isOrientationSupported, requestOrientationPermission } from './compass';

interface GenericProximitySensor extends EventTarget {
  distance: number | null;
  max: number | null;
  near: boolean | null;
  start: () => void;
  stop: () => void;
}

interface GenericProximitySensorConstructor {
  new (options?: { frequency?: number }): GenericProximitySensor;
}

interface UserProximityEventLike extends Event {
  near?: boolean;
}

interface DeviceProximityEventLike extends Event {
  value?: number;
  min?: number;
  max?: number;
}

const PROXIMITY_DWELL_MS = 750;
const FACEDOWN_DWELL_MS = 1100;
const NEAR_DISTANCE_CM = 3;

export function hasHardwareProximityApi(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ProximitySensor' in window ||
    'onuserproximity' in window ||
    'ondeviceproximity' in window
  );
}

export function isProximityAutoOffSupported(): boolean {
  return hasHardwareProximityApi() || isOrientationSupported();
}

export function getProximitySensorMode(): ProximitySensorMode {
  if (hasHardwareProximityApi()) return 'hardware-proximity';
  if (isOrientationSupported()) return 'facedown-orientation';
  return 'unsupported';
}

export async function requestProximityAutoOffPermission(): Promise<
  'granted' | 'denied' | 'unsupported'
> {
  if (!isProximityAutoOffSupported()) {
    return 'unsupported';
  }

  if (isOrientationSupported()) {
    const orientPerm = await requestOrientationPermission();
    if (orientPerm === 'denied' && !hasHardwareProximityApi()) {
      return 'denied';
    }
  }

  return 'granted';
}

export interface ProximityAutoOffOptions {
  onAutoOff: (reason: ProximityTriggerReason) => void;
  onDetectedChange?: (detected: boolean) => void;
}

/**
 * Monitors device proximity sensors (Generic ProximitySensor, userproximity,
 * deviceproximity) and face-down orientation (DeviceOrientationEvent) to detect
 * when the phone is placed face down or slipped into a pocket.
 * Uses sustained dwell timers to prevent accidental triggers from brief movement.
 */
export function startProximityAutoOffListener({
  onAutoOff,
  onDetectedChange,
}: ProximityAutoOffOptions): () => void {
  if (!isProximityAutoOffSupported()) {
    return () => {};
  }

  let proximitySensor: GenericProximitySensor | null = null;
  let proximityTimer: ReturnType<typeof setTimeout> | null = null;
  let faceDownTimer: ReturnType<typeof setTimeout> | null = null;
  let hasTriggered = false;
  let lastDetected = false;
  let isProximityNear = false;
  let isFaceDown = false;

  const syncDetected = () => {
    const detected = isProximityNear || isFaceDown;
    if (detected !== lastDetected) {
      lastDetected = detected;
      onDetectedChange?.(detected);
    }
  };

  const triggerOnce = (reason: ProximityTriggerReason) => {
    if (hasTriggered) return;
    hasTriggered = true;
    onAutoOff(reason);
  };

  const updateProximityNear = (near: boolean) => {
    isProximityNear = near;
    syncDetected();

    if (near) {
      if (!proximityTimer && !hasTriggered) {
        proximityTimer = setTimeout(() => {
          proximityTimer = null;
          if (isProximityNear) {
            triggerOnce('proximity');
          }
        }, PROXIMITY_DWELL_MS);
      }
    } else {
      if (proximityTimer) {
        clearTimeout(proximityTimer);
        proximityTimer = null;
      }
      if (!isFaceDown) {
        hasTriggered = false;
      }
    }
  };

  const updateFaceDown = (faceDown: boolean) => {
    isFaceDown = faceDown;
    syncDetected();

    if (faceDown) {
      if (!faceDownTimer && !hasTriggered) {
        faceDownTimer = setTimeout(() => {
          faceDownTimer = null;
          if (isFaceDown) {
            triggerOnce('facedown');
          }
        }, FACEDOWN_DWELL_MS);
      }
    } else {
      if (faceDownTimer) {
        clearTimeout(faceDownTimer);
        faceDownTimer = null;
      }
      if (!isProximityNear) {
        hasTriggered = false;
      }
    }
  };

  // 1. W3C Generic Sensor API: ProximitySensor
  const ProximityCtor = (
    window as unknown as { ProximitySensor?: GenericProximitySensorConstructor }
  ).ProximitySensor;

  const handleGenericReading = () => {
    if (!proximitySensor) return;
    const nearByFlag = proximitySensor.near === true;
    const nearByDistance =
      typeof proximitySensor.distance === 'number' &&
      !Number.isNaN(proximitySensor.distance) &&
      proximitySensor.distance <= NEAR_DISTANCE_CM;
    updateProximityNear(nearByFlag || nearByDistance);
  };

  const handleGenericError = () => {
    try {
      proximitySensor?.stop();
    } catch {
      // Ignore cleanup errors
    }
    proximitySensor = null;
  };

  if (typeof ProximityCtor === 'function') {
    try {
      proximitySensor = new ProximityCtor({ frequency: 5 });
      proximitySensor.addEventListener('reading', handleGenericReading);
      proximitySensor.addEventListener('error', handleGenericError);
      proximitySensor.start();
    } catch {
      proximitySensor = null;
    }
  }

  // 2. Legacy userproximity event
  const handleUserProximity = (event: Event) => {
    const proxEvent = event as UserProximityEventLike;
    if (typeof proxEvent.near === 'boolean') {
      updateProximityNear(proxEvent.near);
    }
  };

  // 3. Legacy deviceproximity event
  const handleDeviceProximity = (event: Event) => {
    const proxEvent = event as DeviceProximityEventLike;
    if (typeof proxEvent.value === 'number' && !Number.isNaN(proxEvent.value)) {
      const threshold =
        typeof proxEvent.min === 'number'
          ? Math.max(NEAR_DISTANCE_CM, proxEvent.min)
          : NEAR_DISTANCE_CM;
      updateProximityNear(proxEvent.value <= threshold);
    }
  };

  // 4. Face-down detection via DeviceOrientationEvent (works broadly across iOS & Android)
  const handleOrientation = (event: DeviceOrientationEvent) => {
    if (
      typeof event.beta !== 'number' ||
      Number.isNaN(event.beta) ||
      typeof event.gamma !== 'number' ||
      Number.isNaN(event.gamma)
    ) {
      return;
    }
    // Screen pointing flat downward: |beta| >= 150° and |gamma| <= 35°
    const faceDownNow = Math.abs(event.beta) >= 150 && Math.abs(event.gamma) <= 35;
    updateFaceDown(faceDownNow);
  };

  window.addEventListener('userproximity', handleUserProximity);
  window.addEventListener('deviceproximity', handleDeviceProximity);
  if (isOrientationSupported()) {
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
  }

  return () => {
    if (proximityTimer) clearTimeout(proximityTimer);
    if (faceDownTimer) clearTimeout(faceDownTimer);

    if (proximitySensor) {
      try {
        proximitySensor.removeEventListener('reading', handleGenericReading);
        proximitySensor.removeEventListener('error', handleGenericError);
        proximitySensor.stop();
      } catch {
        // Ignore stop errors
      }
      proximitySensor = null;
    }

    window.removeEventListener('userproximity', handleUserProximity);
    window.removeEventListener('deviceproximity', handleDeviceProximity);
    if (isOrientationSupported()) {
      window.removeEventListener('deviceorientation', handleOrientation);
    }
  };
}
