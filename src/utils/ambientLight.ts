import { AmbientLightCategory } from '../types';

export type AmbientLightErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'no-camera'
  | 'unknown';

export interface AmbientLightReading {
  /** Normalized perceptual luminance percentage [0, 100] */
  level: number;
  category: AmbientLightCategory;
  /** True only after sustained dark readings so auto-exposure startup never false-triggers */
  isDarkSustained: boolean;
}

export interface AmbientLightMonitorOptions {
  onReading: (reading: AmbientLightReading) => void;
  onError: (code: AmbientLightErrorCode) => void;
}

const SAMPLE_WIDTH = 32;
const SAMPLE_HEIGHT = 24;
const SAMPLE_INTERVAL_MS = 1200;
const DARK_THRESHOLD = 24;
const DIM_THRESHOLD = 48;
const SUSTAINED_DARK_SAMPLES = 2;

export function isFrontCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices) &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

function classifyLuminance(level: number): AmbientLightCategory {
  if (level < DARK_THRESHOLD) return 'dark';
  if (level < DIM_THRESHOLD) return 'dim';
  return 'bright';
}

/**
 * Samples perceptual ambient luminance locally from the device's front camera
 * using an offscreen 32x24 canvas. No frames are stored or transmitted.
 * Returns a cleanup function that stops the camera track immediately.
 */
export function startFrontCameraAmbientMonitor({
  onReading,
  onError,
}: AmbientLightMonitorOptions): () => void {
  if (!isFrontCameraSupported()) {
    onError('unsupported');
    return () => {};
  }

  let cancelled = false;
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let warmupTimeoutId: ReturnType<typeof setTimeout> | null = null;
  const recentLevels: number[] = [];
  let consecutiveDarkCount = 0;

  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_WIDTH;
  canvas.height = SAMPLE_HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const stopResources = () => {
    if (warmupTimeoutId) {
      clearTimeout(warmupTimeoutId);
      warmupTimeoutId = null;
    }
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (video) {
      try {
        video.pause();
        video.srcObject = null;
      } catch {
        // Ignore cleanup errors
      }
      video = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
  };

  const sampleFrame = () => {
    if (cancelled || !video || !ctx) return;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    try {
      ctx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const imageData = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data;
      let totalLuma = 0;
      const pixelCount = SAMPLE_WIDTH * SAMPLE_HEIGHT;

      for (let i = 0; i < imageData.length; i += 4) {
        // Rec. 709 perceptual luminance
        totalLuma +=
          0.2126 * imageData[i] +
          0.7152 * imageData[i + 1] +
          0.0722 * imageData[i + 2];
      }

      const avgLuma = totalLuma / pixelCount;
      const levelPercent = Math.min(100, Math.max(0, Math.round((avgLuma / 255) * 100)));

      recentLevels.push(levelPercent);
      if (recentLevels.length > 3) recentLevels.shift();
      const smoothed = Math.round(
        recentLevels.reduce((acc, v) => acc + v, 0) / recentLevels.length,
      );

      const category = classifyLuminance(smoothed);
      if (category === 'dark') {
        consecutiveDarkCount += 1;
      } else {
        consecutiveDarkCount = 0;
      }

      onReading({
        level: smoothed,
        category,
        isDarkSustained: consecutiveDarkCount >= SUSTAINED_DARK_SAMPLES,
      });
    } catch {
      // Ignore transient frame read issues
    }
  };

  navigator.mediaDevices
    .getUserMedia({
      video: {
        facingMode: { ideal: 'user' },
        width: { ideal: 160 },
        height: { ideal: 120 },
      },
      audio: false,
    })
    .then(async (mediaStream) => {
      if (cancelled) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }

      stream = mediaStream;
      video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.srcObject = mediaStream;

      try {
        await video.play();
      } catch {
        // Autoplay on muted offscreen video may still advance frames on ready
      }

      if (cancelled) {
        stopResources();
        return;
      }

      // Allow ~650ms for front camera auto-exposure to settle before first reading
      warmupTimeoutId = setTimeout(() => {
        if (cancelled) return;
        sampleFrame();
        intervalId = setInterval(sampleFrame, SAMPLE_INTERVAL_MS);
      }, 650);
    })
    .catch((err: unknown) => {
      if (cancelled) return;
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        onError('permission-denied');
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        onError('no-camera');
      } else {
        onError('unknown');
      }
    });

  return () => {
    cancelled = true;
    stopResources();
  };
}
