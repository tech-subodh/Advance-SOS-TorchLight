import { ShakeSensitivity } from '../types';

interface DeviceMotionEventConstructorWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

const THRESHOLDS: Record<
  ShakeSensitivity,
  { linear: number; gravityDelta: number }
> = {
  high: { linear: 10.5, gravityDelta: 14.5 },
  medium: { linear: 14.5, gravityDelta: 19.5 },
  low: { linear: 19.5, gravityDelta: 26.0 },
};

const REQUIRED_SPIKES = 2;
const SPIKE_WINDOW_MS = 450;
const COOLDOWN_MS = 950;

export function isMotionSensorSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
}

export async function requestMotionPermission(): Promise<
  'granted' | 'denied' | 'unsupported'
> {
  if (!isMotionSensorSupported()) {
    return 'unsupported';
  }

  const MotionCtor =
    window.DeviceMotionEvent as unknown as DeviceMotionEventConstructorWithPermission;

  if (typeof MotionCtor?.requestPermission === 'function') {
    try {
      const result = await MotionCtor.requestPermission();
      return result === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  return 'granted';
}

export interface ShakeDetectorOptions {
  sensitivity: ShakeSensitivity;
  onShake: () => void;
}

/**
 * Starts listening to DeviceMotionEvent accelerometer readings and invokes
 * `onShake` when a deliberate shake gesture (2 spikes within 450ms) occurs.
 * Returns a cleanup function to detach the listener.
 */
export function startShakeListener({
  sensitivity,
  onShake,
}: ShakeDetectorOptions): () => void {
  if (!isMotionSensorSupported()) {
    return () => {};
  }

  let lastX: number | null = null;
  let lastY: number | null = null;
  let lastZ: number | null = null;
  let spikeCount = 0;
  let firstSpikeAt = 0;
  let lastTriggerAt = 0;

  const { linear: linearThreshold, gravityDelta: gravityDeltaThreshold } =
    THRESHOLDS[sensitivity];

  const handleMotion = (event: DeviceMotionEvent) => {
    const now = Date.now();
    if (now - lastTriggerAt < COOLDOWN_MS) {
      return;
    }

    let isSpike = false;

    const lin = event.acceleration;
    if (
      lin &&
      typeof lin.x === 'number' &&
      typeof lin.y === 'number' &&
      typeof lin.z === 'number'
    ) {
      const magnitude = Math.sqrt(lin.x * lin.x + lin.y * lin.y + lin.z * lin.z);
      if (magnitude >= linearThreshold) {
        isSpike = true;
      }
    } else {
      const acc = event.accelerationIncludingGravity;
      if (
        acc &&
        typeof acc.x === 'number' &&
        typeof acc.y === 'number' &&
        typeof acc.z === 'number'
      ) {
        if (lastX !== null && lastY !== null && lastZ !== null) {
          const dx = acc.x - lastX;
          const dy = acc.y - lastY;
          const dz = acc.z - lastZ;
          const deltaMag = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (deltaMag >= gravityDeltaThreshold) {
            isSpike = true;
          }
        }
        lastX = acc.x;
        lastY = acc.y;
        lastZ = acc.z;
      }
    }

    if (!isSpike) return;

    if (now - firstSpikeAt > SPIKE_WINDOW_MS) {
      spikeCount = 1;
      firstSpikeAt = now;
    } else {
      spikeCount += 1;
    }

    if (spikeCount >= REQUIRED_SPIKES) {
      spikeCount = 0;
      firstSpikeAt = 0;
      lastTriggerAt = now;
      onShake();
    }
  };

  window.addEventListener('devicemotion', handleMotion, { passive: true });
  return () => {
    window.removeEventListener('devicemotion', handleMotion);
  };
}
