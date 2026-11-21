import { ShakeSensitivity } from '../types';

interface DeviceMotionEventConstructorWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export const SHAKE_THRESHOLDS: Record<
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
const READING_THROTTLE_MS = 45;

export type ShakeSensorSource = 'linear' | 'gravity-delta';

export interface ShakeTelemetry {
  x: number;
  y: number;
  z: number;
  magnitude: number;
  threshold: number;
  isOverThreshold: boolean;
  spikeCount: number;
  requiredSpikes: number;
  source: ShakeSensorSource;
  timestamp: number;
}

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
  onReading?: (reading: ShakeTelemetry) => void;
}

/**
 * Starts listening to DeviceMotionEvent accelerometer readings and invokes
 * `onShake` when a deliberate shake gesture (2 spikes within 450ms) occurs.
 * Optionally emits real-time telemetry via `onReading` for sensitivity calibration.
 * Returns a cleanup function to detach the listener.
 */
export function startShakeListener({
  sensitivity,
  onShake,
  onReading,
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
  let lastReadingAt = 0;

  const { linear: linearThreshold, gravityDelta: gravityDeltaThreshold } =
    SHAKE_THRESHOLDS[sensitivity];

  const handleMotion = (event: DeviceMotionEvent) => {
    const now = Date.now();
    const inCooldown = now - lastTriggerAt < COOLDOWN_MS;

    let isSpike = false;
    let x = 0;
    let y = 0;
    let z = 0;
    let magnitude = 0;
    let activeThreshold = linearThreshold;
    let source: ShakeSensorSource = 'linear';
    let hasValidSample = false;

    const lin = event.acceleration;
    if (
      lin &&
      typeof lin.x === 'number' &&
      typeof lin.y === 'number' &&
      typeof lin.z === 'number' &&
      (Number.isFinite(lin.x) || Number.isFinite(lin.y) || Number.isFinite(lin.z))
    ) {
      x = lin.x;
      y = lin.y;
      z = lin.z;
      magnitude = Math.sqrt(x * x + y * y + z * z);
      activeThreshold = linearThreshold;
      source = 'linear';
      hasValidSample = true;
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
        source = 'gravity-delta';
        activeThreshold = gravityDeltaThreshold;
        hasValidSample = true;
        if (lastX !== null && lastY !== null && lastZ !== null) {
          x = acc.x - lastX;
          y = acc.y - lastY;
          z = acc.z - lastZ;
          magnitude = Math.sqrt(x * x + y * y + z * z);
          if (magnitude >= gravityDeltaThreshold) {
            isSpike = true;
          }
        }
        lastX = acc.x;
        lastY = acc.y;
        lastZ = acc.z;
      }
    }

    if (!hasValidSample) return;

    // Reset expired spike window for accurate UI feedback
    if (spikeCount > 0 && now - firstSpikeAt > SPIKE_WINDOW_MS) {
      spikeCount = 0;
      firstSpikeAt = 0;
    }

    let triggeredNow = false;
    if (!inCooldown && isSpike) {
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
        triggeredNow = true;
      }
    }

    if (onReading && (isSpike || triggeredNow || now - lastReadingAt >= READING_THROTTLE_MS)) {
      lastReadingAt = now;
      onReading({
        x,
        y,
        z,
        magnitude,
        threshold: activeThreshold,
        isOverThreshold: isSpike,
        spikeCount: triggeredNow ? REQUIRED_SPIKES : spikeCount,
        requiredSpikes: REQUIRED_SPIKES,
        source,
        timestamp: now,
      });
    }

    if (triggeredNow) {
      onShake();
    }
  };

  window.addEventListener('devicemotion', handleMotion, { passive: true });
  return () => {
    window.removeEventListener('devicemotion', handleMotion);
  };
}
