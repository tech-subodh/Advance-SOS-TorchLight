import React, { useMemo, useState, useEffect } from 'react';
import {
  QrCode,
  ScanBarcode,
  Maximize2,
  Minimize2,
  Sun,
  RotateCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Language, ScannerConfig, ScannerPatternType } from '../types';
import { translations } from '../utils/translations';
import { encodeCode128B, generateQrMatrix } from '../utils/barcode';
import { triggerHaptic, HAPTIC_PATTERNS } from '../utils/audio';

interface ScannerModeProps {
  language: Language;
  hapticEnabled: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  config: ScannerConfig;
  onChangeConfig: (patch: Partial<ScannerConfig>) => void;
}

export const ScannerMode: React.FC<ScannerModeProps> = ({
  language,
  hapticEnabled,
  isFullscreen,
  onToggleFullscreen,
  config,
  onChangeConfig,
}) => {
  const t = translations[language].scannerMode;
  const { patternType, payload, brightness, verticalBarcode, showHumanText } = config;
  const [showFullscreenControls, setShowFullscreenControls] = useState<boolean>(true);

  const qrMatrix = useMemo(() => {
    try {
      return generateQrMatrix(payload);
    } catch {
      return generateQrMatrix('TORCH-LIGHT-SCANNER');
    }
  }, [payload]);

  const code128 = useMemo(() => encodeCode128B(payload), [payload]);

  // Auto-hide fullscreen floating chrome after 3s so scanners see pure high-contrast quiet zone
  useEffect(() => {
    if (!isFullscreen) {
      setShowFullscreenControls(true);
      return;
    }
    if (!showFullscreenControls) return;

    const timer = setTimeout(() => {
      setShowFullscreenControls(false);
    }, 3200);
    return () => clearTimeout(timer);
  }, [isFullscreen, showFullscreenControls, patternType, brightness]);

  const handleSelectPattern = (next: ScannerPatternType) => {
    onChangeConfig({ patternType: next });
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
  };

  const handleApplyPreset = (value: string, type: ScannerPatternType) => {
    onChangeConfig({ payload: value, patternType: type });
    if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
  };

  const renderScannerGraphic = (fullscreen: boolean) => {
    if (patternType === 'qr') {
      const viewSize = qrMatrix.size + qrMatrix.quietZone * 2;
      return (
        <div className="flex flex-col items-center justify-center w-full h-full">
          <svg
            viewBox={`0 0 ${viewSize} ${viewSize}`}
            shapeRendering="crispEdges"
            role="img"
            aria-label={`QR Code: ${payload || 'TORCH-LIGHT-SCANNER'}`}
            className={
              fullscreen
                ? 'w-[min(86vw,70vh)] h-[min(86vw,70vh)] max-w-[460px] max-h-[460px]'
                : 'w-44 h-44 sm:w-48 sm:h-48'
            }
          >
            <rect width={viewSize} height={viewSize} fill="#FFFFFF" />
            <g transform={`translate(${qrMatrix.quietZone}, ${qrMatrix.quietZone})`}>
              {qrMatrix.cells.map((cell, idx) => (
                <rect
                  key={idx}
                  x={cell.x}
                  y={cell.y}
                  width={1}
                  height={1}
                  fill="#000000"
                />
              ))}
            </g>
          </svg>

          {showHumanText && (
            <p className="mt-2 px-3 text-center font-mono text-xs sm:text-sm font-semibold text-neutral-900 tracking-wide break-all max-w-md select-text">
              {payload.trim() || 'TORCH-LIGHT-SCANNER'}
            </p>
          )}
        </div>
      );
    }

    const barHeight = fullscreen ? 140 : 96;
    return (
      <div
        className={`flex flex-col items-center justify-center w-full transition-transform duration-200 ${
          fullscreen && verticalBarcode ? 'rotate-90' : ''
        }`}
      >
        <svg
          viewBox={`0 0 ${code128.totalWidth} ${barHeight}`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
          role="img"
          aria-label={`Code 128 Barcode: ${code128.encodedText}`}
          className={
            fullscreen
              ? verticalBarcode
                ? 'w-[min(82vh,520px)] h-44 sm:h-52'
                : 'w-[92vw] max-w-2xl h-44 sm:h-56'
              : 'w-full h-28 sm:h-32'
          }
        >
          <rect width={code128.totalWidth} height={barHeight} fill="#FFFFFF" />
          {code128.bars.map((bar, idx) => (
            <rect
              key={idx}
              x={bar.x}
              y={8}
              width={bar.width}
              height={barHeight - 16}
              fill="#000000"
            />
          ))}
        </svg>

        {showHumanText && (
          <p className="mt-2 font-mono text-xs sm:text-base font-bold text-black tracking-[0.22em] select-text text-center">
            {code128.encodedText}
          </p>
        )}
      </div>
    );
  };

  if (isFullscreen) {
    return (
      <div
        id="fullscreen-scanner-surface"
        className="fixed inset-0 z-50 bg-black flex items-center justify-center cursor-pointer"
        onClick={() => setShowFullscreenControls((prev) => !prev)}
      >
        {/* High-contrast pure white illuminated scanner canvas */}
        <div
          className="w-full h-full bg-white flex flex-col items-center justify-center p-6 transition-opacity duration-150"
          style={{ opacity: brightness }}
        >
          {renderScannerGraphic(true)}
        </div>

        {/* Floating Fullscreen Top Control Bar */}
        <div
          className={`fixed top-0 left-0 right-0 p-4 flex items-center justify-between gap-2 transition-opacity duration-200 ${
            showFullscreenControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            id="exit-scanner-fullscreen-btn"
            type="button"
            onClick={onToggleFullscreen}
            className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-chrome border text-white text-xs font-semibold"
          >
            <Minimize2 className="w-4 h-4" />
            <span>{t.exitFullscreen}</span>
          </button>

          <div className="flex items-center gap-2">
            {patternType === 'barcode' && (
              <button
                type="button"
                onClick={() => {
                  onChangeConfig({ verticalBarcode: !verticalBarcode });
                  if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
                }}
                className="min-h-[40px] px-3 py-2 rounded-xl glass-chrome border text-white text-xs font-medium flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.rotateBarcode}</span>
              </button>
            )}

            <div className="flex items-center gap-2 glass-chrome border px-3 py-2 rounded-xl">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={brightness}
                onChange={(e) => onChangeConfig({ brightness: Number(e.target.value) })}
                className="w-20 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                aria-label={t.illumination}
              />
              <span className="text-white text-xs font-mono tabular-nums">
                {Math.round(brightness * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Floating Fullscreen Bottom Hint */}
        <div
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 transition-opacity duration-200 pointer-events-none ${
            showFullscreenControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="px-4 py-2 rounded-full glass-chrome border text-neutral-100 text-xs font-medium whitespace-nowrap">
            {t.tapHint}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-3 flex flex-col justify-between min-h-[calc(100vh-140px)] space-y-4">
      {/* Header Info */}
      <div className="text-center w-full">
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
          {t.title}
        </h2>
        <p className="text-xs text-neutral-400 mt-0.5">{t.subtitle}</p>
      </div>

      {/* Pattern Type Segmented Switch */}
      <div
        role="tablist"
        aria-label={t.patternType}
        className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl glass-panel"
      >
        <button
          id="scanner-type-qr"
          role="tab"
          aria-selected={patternType === 'qr'}
          type="button"
          onClick={() => handleSelectPattern('qr')}
          className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
            patternType === 'qr'
              ? 'bg-amber-500/90 text-neutral-950 shadow-[0_4px_14px_rgba(245,158,11,0.3),inset_0_1px_0_rgba(255,255,255,0.45)]'
              : 'text-neutral-200 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <QrCode className="w-4 h-4 shrink-0" />
          <span>{t.qrCode}</span>
        </button>

        <button
          id="scanner-type-barcode"
          role="tab"
          aria-selected={patternType === 'barcode'}
          type="button"
          onClick={() => handleSelectPattern('barcode')}
          className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
            patternType === 'barcode'
              ? 'bg-amber-500/90 text-neutral-950 shadow-[0_4px_14px_rgba(245,158,11,0.3),inset_0_1px_0_rgba(255,255,255,0.45)]'
              : 'text-neutral-200 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <ScanBarcode className="w-4 h-4 shrink-0" />
          <span>{t.barcode}</span>
        </button>
      </div>

      {/* High-Contrast Bright Preview Stage */}
      <div className="w-full rounded-2xl bg-black p-1 border border-neutral-700 shadow-2xl">
        <div
          id="scanner-preview-stage"
          onClick={onToggleFullscreen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleFullscreen();
            }
          }}
          className="w-full min-h-[228px] rounded-xl bg-white p-4 flex flex-col items-center justify-center cursor-pointer transition-opacity relative group"
          style={{ opacity: brightness }}
        >
          {renderScannerGraphic(false)}
        </div>
      </div>

      {/* Fullscreen Launch Primary CTA */}
      <button
        id="scanner-fullscreen-launch-btn"
        type="button"
        onClick={onToggleFullscreen}
        className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg"
      >
        <Maximize2 className="w-4 h-4" />
        <span>{t.launchFullscreen}</span>
      </button>

      {/* Scanner Controls Card */}
      <div className="w-full glass-panel rounded-2xl p-4 space-y-4">
        {/* Payload Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="scanner-payload-input"
            className="block text-xs font-medium text-neutral-200"
          >
            {t.contentLabel}
          </label>
          <input
            id="scanner-payload-input"
            type="text"
            value={payload}
            onChange={(e) => onChangeConfig({ payload: e.target.value })}
            placeholder={t.contentPlaceholder}
            maxLength={120}
            className="w-full min-h-[42px] px-3 py-2 rounded-xl glass-input text-sm text-white placeholder:text-neutral-500 font-mono focus:outline-none focus:border-amber-400/60 select-text"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {t.presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleApplyPreset(preset.value, preset.type)}
                className="px-2.5 py-1.5 rounded-lg glass-surface text-[11px] text-neutral-200 whitespace-nowrap active:scale-95"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Illumination Slider */}
        <div className="space-y-1.5 pt-2 border-t border-neutral-800/80">
          <div className="flex justify-between items-center text-xs font-medium text-neutral-300">
            <span className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              {t.illumination}
            </span>
            <span className="font-mono tabular-nums text-amber-400 font-bold">
              {Math.round(brightness * 100)}%
            </span>
          </div>
          <input
            id="scanner-brightness-slider"
            type="range"
            min="0.5"
            max="1"
            step="0.05"
            value={brightness}
            onChange={(e) => onChangeConfig({ brightness: Number(e.target.value) })}
            className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
          />
        </div>

        {/* Display Options Row */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              onChangeConfig({ showHumanText: !showHumanText });
              if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
            }}
            className="min-h-[38px] px-3 py-1.5 rounded-xl glass-surface text-xs text-neutral-200 flex items-center gap-1.5 active:scale-95"
          >
            {showHumanText ? (
              <Eye className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-neutral-500" />
            )}
            <span>{t.showTextLabel}</span>
          </button>

          {patternType === 'barcode' && (
            <button
              type="button"
              onClick={() => {
                onChangeConfig({ verticalBarcode: !verticalBarcode });
                if (hapticEnabled) triggerHaptic(HAPTIC_PATTERNS.tap);
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
                verticalBarcode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/45'
                  : 'glass-surface text-neutral-200'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{t.rotateBarcode}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
