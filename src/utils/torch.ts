/**
 * Hardware Camera Torch (with Variable Intensity Support) and Screen WakeLock Manager
 */
import { TorchIntensityCapability, TorchIntensityConstraintKey } from '../types';

export interface TorchState {
  hasHardwareTorch: boolean;
  isTorchOn: boolean;
  intensityCapability: TorchIntensityCapability;
  error: string | null;
  stream: MediaStream | null;
  track: MediaStreamTrack | null;
}

export interface HardwareSupportResult {
  hasHardwareTorch: boolean;
  intensity: TorchIntensityCapability;
}

export interface SetTorchResult {
  success: boolean;
  isHardware: boolean;
  intensityCapability: TorchIntensityCapability;
  error?: string;
}

interface TorchMediaSettingsRange {
  min?: number;
  max?: number;
  step?: number;
}

interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
  torch?: boolean | TorchMediaSettingsRange;
  torchStrength?: TorchMediaSettingsRange;
  torchLevel?: TorchMediaSettingsRange;
  torchBrightness?: TorchMediaSettingsRange;
}

const DEFAULT_INTENSITY_CAPABILITY: TorchIntensityCapability = {
  supported: false,
  min: 0.1,
  max: 1.0,
  step: 0.05,
  constraintKey: null,
};

function isValidRange(
  value: unknown,
): value is { min: number; max: number; step?: number } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { min?: unknown; max?: unknown; step?: unknown };
  return (
    typeof candidate.min === 'number' &&
    typeof candidate.max === 'number' &&
    Number.isFinite(candidate.min) &&
    Number.isFinite(candidate.max) &&
    candidate.max > candidate.min
  );
}

function inspectTrackCapabilities(track: MediaStreamTrack): HardwareSupportResult {
  const getCapabilities = (
    track as unknown as { getCapabilities?: () => ExtendedMediaTrackCapabilities }
  ).getCapabilities;
  const capabilities: ExtendedMediaTrackCapabilities =
    typeof getCapabilities === 'function' ? getCapabilities.call(track) : {};

  const supportsTorch =
    Boolean(capabilities?.torch) ||
    isValidRange(capabilities?.torchStrength) ||
    isValidRange(capabilities?.torchLevel) ||
    isValidRange(capabilities?.torchBrightness);

  const candidates: Array<{
    key: TorchIntensityConstraintKey;
    value: unknown;
  }> = [
    { key: 'torchStrength', value: capabilities?.torchStrength },
    { key: 'torchLevel', value: capabilities?.torchLevel },
    { key: 'torchBrightness', value: capabilities?.torchBrightness },
    { key: 'torch', value: capabilities?.torch },
  ];

  for (const candidate of candidates) {
    if (isValidRange(candidate.value)) {
      const range = candidate.value;
      const step =
        typeof range.step === 'number' && Number.isFinite(range.step) && range.step > 0
          ? range.step
          : Number(((range.max - range.min) / 100).toFixed(4)) || 0.01;
      return {
        hasHardwareTorch: true,
        intensity: {
          supported: true,
          min: range.min,
          max: range.max,
          step,
          constraintKey: candidate.key,
        },
      };
    }
  }

  return {
    hasHardwareTorch: supportsTorch,
    intensity: { ...DEFAULT_INTENSITY_CAPABILITY },
  };
}

class TorchController {
  private stream: MediaStream | null = null;
  private track: MediaStreamTrack | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private hasHardwareTorch: boolean | null = null;
  private intensityCapability: TorchIntensityCapability = {
    ...DEFAULT_INTENSITY_CAPABILITY,
  };
  private isTorchActive = false;
  private currentIntensity = 1.0;
  private isApplyingIntensity = false;
  private pendingIntensity: number | null = null;

  /**
   * Return the latest known torch intensity capability
   */
  getIntensityCapability(): TorchIntensityCapability {
    return { ...this.intensityCapability };
  }

  /**
   * Map a normalized intensity [0.1, 1.0] to the device's hardware range
   */
  mapNormalizedToHardware(normalized: number): number {
    const cap = this.intensityCapability;
    const clamped = Math.min(1, Math.max(0.1, normalized));
    if (!cap.supported) return clamped;

    const minOn =
      cap.min > 0
        ? cap.min
        : Math.min(cap.max, cap.step > 0 ? cap.step : cap.max * 0.1);
    const raw = minOn + ((clamped - 0.1) / 0.9) * (cap.max - minOn);

    if (cap.step > 0) {
      const stepped = Math.round((raw - minOn) / cap.step) * cap.step + minOn;
      return Number(Math.min(cap.max, Math.max(minOn, stepped)).toFixed(4));
    }
    return Number(Math.min(cap.max, Math.max(minOn, raw)).toFixed(4));
  }

  /**
   * Return discrete hardware step info (e.g., Level 3 / 5 on Android 13+) when applicable
   */
  getDiscreteHardwareStep(
    normalized: number,
  ): { current: number; max: number } | null {
    const cap = this.intensityCapability;
    if (!cap.supported) return null;

    const isDiscrete =
      Number.isInteger(cap.step) &&
      cap.step >= 1 &&
      Number.isInteger(cap.max) &&
      cap.max - cap.min <= 25;

    if (!isDiscrete) return null;

    const hwValue = this.mapNormalizedToHardware(normalized);
    return {
      current: Math.round(hwValue),
      max: Math.round(cap.max),
    };
  }

  /**
   * Check whether hardware torch and variable intensity levels are available
   */
  async checkHardwareSupport(): Promise<HardwareSupportResult> {
    if (this.hasHardwareTorch !== null) {
      return {
        hasHardwareTorch: this.hasHardwareTorch,
        intensity: { ...this.intensityCapability },
      };
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      this.hasHardwareTorch = false;
      this.intensityCapability = { ...DEFAULT_INTENSITY_CAPABILITY };
      return {
        hasHardwareTorch: false,
        intensity: { ...DEFAULT_INTENSITY_CAPABILITY },
      };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      const track = stream.getVideoTracks()[0];
      if (!track) {
        stream.getTracks().forEach((t) => t.stop());
        this.hasHardwareTorch = false;
        this.intensityCapability = { ...DEFAULT_INTENSITY_CAPABILITY };
        return {
          hasHardwareTorch: false,
          intensity: { ...DEFAULT_INTENSITY_CAPABILITY },
        };
      }

      const detected = inspectTrackCapabilities(track);
      this.hasHardwareTorch = detected.hasHardwareTorch;
      this.intensityCapability = detected.intensity;

      if (!detected.hasHardwareTorch) {
        stream.getTracks().forEach((t) => t.stop());
      } else {
        this.stream = stream;
        this.track = track;
      }
      return detected;
    } catch {
      this.hasHardwareTorch = false;
      this.intensityCapability = { ...DEFAULT_INTENSITY_CAPABILITY };
      return {
        hasHardwareTorch: false,
        intensity: { ...DEFAULT_INTENSITY_CAPABILITY },
      };
    }
  }

  /**
   * Apply the current intensity constraint to an active live hardware torch track
   */
  private async applyIntensityConstraintToTrack(normalized: number): Promise<boolean> {
    if (
      !this.track ||
      this.track.readyState !== 'live' ||
      !this.intensityCapability.supported ||
      !this.intensityCapability.constraintKey
    ) {
      return false;
    }

    const hwValue = this.mapNormalizedToHardware(normalized);
    const key = this.intensityCapability.constraintKey;
    const applyConstraints = this.track.applyConstraints.bind(this.track);

    const constraintPayload: Record<string, unknown> =
      key === 'torch' ? { torch: hwValue } : { torch: true, [key]: hwValue };

    try {
      await applyConstraints({
        advanced: [constraintPayload as unknown as MediaTrackConstraintSet],
      });
      return true;
    } catch {
      // Fallback: try applying the intensity key alone if combined constraint is rejected
      if (key !== 'torch') {
        try {
          await applyConstraints({
            advanced: [{ [key]: hwValue } as unknown as MediaTrackConstraintSet],
          });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Adjust LED luminosity in real time on devices supporting variable torch strength.
   * Serializes rapid slider updates so hardware applyConstraints calls never pile up.
   */
  async setTorchIntensity(
    normalized: number,
  ): Promise<{ success: boolean; appliedLevel: number }> {
    const clamped = Math.min(1, Math.max(0.1, normalized));
    this.currentIntensity = clamped;

    if (
      !this.isTorchActive ||
      !this.intensityCapability.supported ||
      !this.track ||
      this.track.readyState !== 'live'
    ) {
      return { success: true, appliedLevel: clamped };
    }

    if (this.isApplyingIntensity) {
      this.pendingIntensity = clamped;
      return { success: true, appliedLevel: clamped };
    }

    this.isApplyingIntensity = true;
    try {
      let target: number | null = clamped;
      let applied = true;
      while (target !== null) {
        this.pendingIntensity = null;
        applied = await this.applyIntensityConstraintToTrack(target);
        target = this.pendingIntensity;
      }
      return { success: applied, appliedLevel: this.currentIntensity };
    } finally {
      this.isApplyingIntensity = false;
    }
  }

  /**
   * Turn the physical camera torch ON or OFF (applying stored or supplied intensity when ON)
   */
  async setTorch(on: boolean, intensity?: number): Promise<SetTorchResult> {
    if (typeof intensity === 'number' && Number.isFinite(intensity)) {
      this.currentIntensity = Math.min(1, Math.max(0.1, intensity));
    }

    try {
      if (on) {
        await this.requestWakeLock();
      } else {
        await this.releaseWakeLock();
      }

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        this.isTorchActive = false;
        return {
          success: true,
          isHardware: false,
          intensityCapability: { ...this.intensityCapability },
          error: 'MediaDevices not supported',
        };
      }

      if (on) {
        if (!this.track || this.track.readyState !== 'live') {
          try {
            this.stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 640 },
                height: { ideal: 480 },
              },
            });
            this.track = this.stream.getVideoTracks()[0] || null;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Camera access denied';
            this.isTorchActive = false;
            return {
              success: true,
              isHardware: false,
              intensityCapability: { ...this.intensityCapability },
              error: msg,
            };
          }
        }

        if (!this.track) {
          this.isTorchActive = false;
          return {
            success: true,
            isHardware: false,
            intensityCapability: { ...this.intensityCapability },
            error: 'No video track found',
          };
        }

        const detected = inspectTrackCapabilities(this.track);
        this.hasHardwareTorch = detected.hasHardwareTorch;
        this.intensityCapability = detected.intensity;

        if (detected.hasHardwareTorch) {
          const applyConstraints = this.track.applyConstraints.bind(this.track);
          if (detected.intensity.supported) {
            const appliedWithIntensity = await this.applyIntensityConstraintToTrack(
              this.currentIntensity,
            );
            if (!appliedWithIntensity) {
              await applyConstraints({
                advanced: [{ torch: true } as unknown as MediaTrackConstraintSet],
              });
            }
          } else {
            await applyConstraints({
              advanced: [{ torch: true } as unknown as MediaTrackConstraintSet],
            });
          }
          this.isTorchActive = true;
          return {
            success: true,
            isHardware: true,
            intensityCapability: { ...this.intensityCapability },
          };
        } else {
          this.isTorchActive = false;
          return {
            success: true,
            isHardware: false,
            intensityCapability: { ...this.intensityCapability },
            error: 'Device does not have LED torch',
          };
        }
      } else {
        this.isTorchActive = false;
        this.pendingIntensity = null;
        if (this.track && this.track.readyState === 'live') {
          try {
            const applyConstraints = this.track.applyConstraints.bind(this.track);
            await applyConstraints({
              advanced: [{ torch: false } as unknown as MediaTrackConstraintSet],
            });
          } catch {
            // Ignore
          }
          // Stop stream completely to save battery and turn off camera indicator
          if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
            this.track = null;
          }
        }
        return {
          success: true,
          isHardware: Boolean(this.hasHardwareTorch),
          intensityCapability: { ...this.intensityCapability },
        };
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Torch error';
      this.isTorchActive = false;
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.track = null;
      }
      return {
        success: false,
        isHardware: false,
        intensityCapability: { ...this.intensityCapability },
        error: errMsg,
      };
    }
  }

  /**
   * Request screen to stay awake
   */
  async requestWakeLock(): Promise<boolean> {
    try {
      if ('wakeLock' in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
        return true;
      }
    } catch {
      // Ignore
    }
    return false;
  }

  /**
   * Release screen wake lock
   */
  async releaseWakeLock(): Promise<void> {
    try {
      if (this.wakeLock) {
        await this.wakeLock.release();
        this.wakeLock = null;
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Clean up all hardware resources
   */
  cleanup(): void {
    this.isTorchActive = false;
    this.pendingIntensity = null;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
      this.track = null;
    }
    this.releaseWakeLock();
  }
}

export const torchManager = new TorchController();
