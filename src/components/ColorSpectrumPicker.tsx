import React, { useEffect, useRef, useState } from 'react';
import { Pipette } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { HsvColor, hexToHsv, hsvToHex, normalizeHexColor } from '../utils/color';

interface ColorSpectrumPickerProps {
  color: string;
  isPoliceMode: boolean;
  onChangeColor: (hex: string, fromDrag?: boolean) => void;
  language: Language;
}

export const ColorSpectrumPicker: React.FC<ColorSpectrumPickerProps> = ({
  color,
  isPoliceMode,
  onChangeColor,
  language,
}) => {
  const t = translations[language].screenMode;
  const initialHex = normalizeHexColor(color) ?? '#FFFFFF';

  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(initialHex));
  const [hexDraft, setHexDraft] = useState<string>(initialHex);
  const [isDraggingSurface, setIsDraggingSurface] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedHexRef = useRef<string>(initialHex);

  // Sync internal HSV state when an external preset is clicked
  useEffect(() => {
    if (isPoliceMode) return;
    const normalized = normalizeHexColor(color);
    if (!normalized) return;
    setHexDraft(normalized);
    if (normalized !== lastEmittedHexRef.current) {
      const nextHsv = hexToHsv(normalized);
      setHsv((prev) => ({
        // Preserve current hue when moving to grayscale/white so the hue slider doesn't jump to red
        h: nextHsv.s === 0 ? prev.h : nextHsv.h,
        s: nextHsv.s,
        v: nextHsv.v,
      }));
      lastEmittedHexRef.current = normalized;
    }
  }, [color, isPoliceMode]);

  const emitHsv = (next: HsvColor, fromDrag: boolean) => {
    const hex = hsvToHex(next.h, next.s, next.v);
    lastEmittedHexRef.current = hex;
    setHsv(next);
    setHexDraft(hex);
    onChangeColor(hex, fromDrag);
  };

  const updateSurfaceFromPointer = (clientX: number, clientY: number, fromDrag: boolean) => {
    const el = surfaceRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xRatio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const yRatio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));

    const nextS = Math.round(xRatio * 100);
    const nextV = Math.round((1 - yRatio) * 100);
    emitHsv({ h: hsv.h, s: nextS, v: nextV }, fromDrag);
  };

  const updateHueFromPointer = (clientX: number, fromDrag: boolean) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;

    const xRatio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const nextH = Math.round(xRatio * 360) % 360;
    // If user drags hue from pure white (s=0), bump saturation slightly so they immediately see the chosen color
    const nextS = hsv.s === 0 && hsv.v > 90 ? 75 : hsv.s;
    const nextV = hsv.v < 15 ? 90 : hsv.v;
    emitHsv({ h: nextH, s: nextS, v: nextV }, fromDrag);
  };

  const handleSurfacePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingSurface(true);
    updateSurfaceFromPointer(e.clientX, e.clientY, false);
  };

  const handleSurfacePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSurface) return;
    updateSurfaceFromPointer(e.clientX, e.clientY, true);
  };

  const handleSurfacePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSurface) return;
    setIsDraggingSurface(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleHuePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingHue(true);
    updateHueFromPointer(e.clientX, false);
  };

  const handleHuePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingHue) return;
    updateHueFromPointer(e.clientX, true);
  };

  const handleHuePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingHue) return;
    setIsDraggingHue(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setHexDraft(val);
    const normalized = normalizeHexColor(val);
    if (normalized) {
      const nextHsv = hexToHsv(normalized);
      lastEmittedHexRef.current = normalized;
      setHsv(nextHsv);
      onChangeColor(normalized, false);
    }
  };

  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const pureHueCss = `hsl(${hsv.h}, 100%, 50%)`;

  return (
    <div
      id="screen-color-spectrum-picker"
      className="space-y-3 pt-3 border-t border-neutral-800/80"
    >
      {/* Header Row with Live Swatch & Editable Hex Code */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Pipette className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-neutral-200 truncate">
            {t.spectrumTitle}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            aria-hidden="true"
            className="w-6 h-6 rounded-lg border border-white/25 shadow-sm shrink-0"
            style={{ backgroundColor: isPoliceMode ? '#EF4444' : currentHex }}
          />
          <input
            id="screen-hex-input"
            type="text"
            maxLength={7}
            value={isPoliceMode ? 'POLICE' : hexDraft}
            onChange={handleHexInputChange}
            aria-label={t.hexInputLabel}
            className="w-[82px] px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800 focus:border-amber-500/60 focus:outline-none font-mono text-xs text-neutral-100 uppercase text-center select-text"
          />
        </div>
      </div>

      {/* 2D Saturation × Brightness Spectrum Field */}
      <div
        ref={surfaceRef}
        id="color-spectrum-surface"
        role="application"
        aria-label={t.spectrumAriaLabel}
        onPointerDown={handleSurfacePointerDown}
        onPointerMove={handleSurfacePointerMove}
        onPointerUp={handleSurfacePointerUp}
        onPointerCancel={handleSurfacePointerUp}
        className="relative w-full h-36 rounded-xl overflow-hidden cursor-crosshair border border-neutral-700/80 touch-none select-none shadow-inner"
        style={{ backgroundColor: pureHueCss }}
      >
        {/* Saturation gradient: white -> transparent */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, #FFFFFF 0%, rgba(255,255,255,0) 100%)',
          }}
        />
        {/* Value/Brightness gradient: transparent -> black */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000000 100%)',
          }}
        />

        {/* Sampled Color Reticle */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.75),0_2px_8px_rgba(0,0,0,0.6)] transition-transform duration-75 ${
            isDraggingSurface ? 'scale-125' : 'scale-100'
          }`}
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            backgroundColor: currentHex,
          }}
        />
      </div>

      {/* Full-Spectrum Hue Slider Bar (0°–360°) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-neutral-400">
          <span>{t.hueSpectrumLabel}</span>
          <span className="font-mono tabular-nums text-neutral-300">
            H {hsv.h}° · S {hsv.s}% · V {hsv.v}%
          </span>
        </div>

        <div
          ref={hueRef}
          id="color-spectrum-hue-bar"
          role="slider"
          tabIndex={0}
          aria-label={t.hueSpectrumLabel}
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={hsv.h}
          onPointerDown={handleHuePointerDown}
          onPointerMove={handleHuePointerMove}
          onPointerUp={handleHuePointerUp}
          onPointerCancel={handleHuePointerUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              emitHsv({ ...hsv, h: (hsv.h + 5) % 360 }, false);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              emitHsv({ ...hsv, h: (hsv.h + 355) % 360 }, false);
            }
          }}
          className="relative w-full h-5 rounded-full cursor-pointer border border-neutral-700/80 touch-none select-none focus:outline-none focus:ring-2 focus:ring-amber-400/70"
          style={{
            background:
              'linear-gradient(to right, #FF0000 0%, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000 100%)',
          }}
        >
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.7),0_2px_6px_rgba(0,0,0,0.6)] transition-transform duration-75 ${
              isDraggingHue ? 'scale-120' : 'scale-100'
            }`}
            style={{
              left: `${(hsv.h / 360) * 100}%`,
              backgroundColor: pureHueCss,
            }}
          />
        </div>
      </div>
    </div>
  );
};
