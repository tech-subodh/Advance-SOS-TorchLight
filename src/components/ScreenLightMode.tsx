import React, { useState, useEffect } from 'react';
import { Sun, Maximize2, Minimize2, Palette, Check } from 'lucide-react';
import { Language } from '../types';
import { translations, COLOR_PRESETS } from '../utils/translations';
import { ColorSpectrumPicker } from './ColorSpectrumPicker';
import { hexToHsv, hsvToHex } from '../utils/color';

interface ScreenLightModeProps {
  language: Language;
  selectedColor: string;
  onSelectColor: (colorHex: string, fromDrag?: boolean) => void;
  brightness: number; // 0.1 to 1.0
  onChangeBrightness: (b: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const ScreenLightMode: React.FC<ScreenLightModeProps> = ({
  language,
  selectedColor,
  onSelectColor,
  brightness,
  onChangeBrightness,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const t = translations[language];
  const [showControlsInFullscreen, setShowControlsInFullscreen] = useState(true);
  const [policeStrobeColor, setPoliceStrobeColor] = useState<'#EF4444' | '#3B82F6'>('#EF4444');
  const [isPoliceMode, setIsPoliceMode] = useState(false);

  // Check if current selected color is police strobe
  useEffect(() => {
    const isPolice =
      selectedColor.toLowerCase() === '#police' ||
      selectedColor.toLowerCase() === '#ef4444-police';
    setIsPoliceMode(isPolice);

    if (isPolice) {
      const interval = setInterval(() => {
        setPoliceStrobeColor((prev) => (prev === '#EF4444' ? '#3B82F6' : '#EF4444'));
      }, 250);
      return () => clearInterval(interval);
    }
  }, [selectedColor]);

  // Auto-hide floating controls in fullscreen mode after 3.5s of inactivity
  useEffect(() => {
    if (!isFullscreen) {
      setShowControlsInFullscreen(true);
      return;
    }

    const timer = setTimeout(() => {
      setShowControlsInFullscreen(false);
    }, 3500);

    return () => clearTimeout(timer);
  }, [isFullscreen, showControlsInFullscreen, brightness, selectedColor]);

  const activeDisplayColor = isPoliceMode ? policeStrobeColor : selectedColor;
  const activeHsv = hexToHsv(activeDisplayColor);

  if (isFullscreen) {
    return (
      <div
        id="fullscreen-lamp-surface"
        className="fixed inset-0 z-50 flex flex-col justify-between items-center transition-colors duration-100 cursor-pointer"
        style={{
          backgroundColor: activeDisplayColor,
          opacity: brightness,
        }}
        onClick={() => setShowControlsInFullscreen((prev) => !prev)}
      >
        {/* Floating Top Controls Overlay */}
        <div
          className={`w-full max-w-lg p-4 transition-opacity duration-300 flex justify-between items-center ${
            showControlsInFullscreen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            id="exit-fullscreen-btn"
            type="button"
            onClick={onToggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-chrome border text-white text-xs font-semibold"
          >
            <Minimize2 className="w-4 h-4" />
            <span>{t.screenMode.exitFullscreen}</span>
          </button>

          {/* Quick Brightness in Fullscreen */}
          <div className="flex items-center gap-2 glass-chrome border px-3 py-1.5 rounded-xl">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={brightness}
              onChange={(e) => onChangeBrightness(Number(e.target.value))}
              className="w-24 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <span className="text-white text-xs font-mono tabular-nums">
              {Math.round(brightness * 100)}%
            </span>
          </div>
        </div>

        {/* Center prompt tip (only visible briefly) */}
        {showControlsInFullscreen && (
          <div className="glass-pill text-white/95 px-4 py-2 rounded-full text-xs font-medium pointer-events-none">
            {t.screenMode.tapToHide}
          </div>
        )}

        {/* Bottom floating spectrum hue bar + quick color palette in fullscreen */}
        <div
          className={`w-full max-w-lg p-4 transition-opacity duration-300 flex justify-center ${
            showControlsInFullscreen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm glass-chrome border p-3 rounded-2xl space-y-2.5">
            {/* Fullscreen Hue Spectrum Slider */}
            <div className="flex items-center gap-2.5">
              <input
                id="fullscreen-hue-spectrum-slider"
                type="range"
                min={0}
                max={359}
                value={activeHsv.h}
                aria-label={t.screenMode.hueSpectrumLabel}
                onChange={(e) => {
                  const nextHue = Number(e.target.value);
                  const nextSat = activeHsv.s < 15 ? 85 : activeHsv.s;
                  const nextVal = activeHsv.v < 30 ? 95 : activeHsv.v;
                  onSelectColor(hsvToHex(nextHue, nextSat, nextVal), true);
                }}
                className="flex-1 h-3 rounded-full appearance-none cursor-pointer border border-white/20"
                style={{
                  background:
                    'linear-gradient(to right, #FF0000 0%, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000 100%)',
                }}
              />
              <span className="font-mono text-[11px] text-neutral-200 uppercase w-16 text-right shrink-0">
                {isPoliceMode ? 'POLICE' : activeDisplayColor}
              </span>
            </div>

            {/* Quick Swatches */}
            <div className="flex justify-center gap-1.5 overflow-x-auto">
              {COLOR_PRESETS.slice(0, 6).map((preset) => {
                const isSelected =
                  !isPoliceMode &&
                  selectedColor.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectColor(preset.hex, false)}
                    className={`w-8 h-8 rounded-xl border-2 transition-transform shrink-0 ${
                      isSelected
                        ? 'border-white scale-110 shadow-md'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                    title={language === 'hi' ? preset.nameHi : preset.nameEn}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between w-full max-w-md mx-auto px-4 py-3 min-h-[calc(100vh-140px)] select-none relative">
      {/* Dynamic Ambient Screen Background Wash reflecting chosen spectrum color */}
      <div
        id="screen-dynamic-ambient-bg"
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none transition-colors duration-150 -z-10"
        style={{
          background: `radial-gradient(circle at 50% 24%, ${activeDisplayColor} 0%, ${activeDisplayColor}44 38%, rgba(10,10,10,0.92) 82%)`,
          opacity: 0.22 + brightness * 0.45,
        }}
      />

      {/* Top Header */}
      <div className="text-center w-full">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full glass-pill border-amber-400/35 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-1">
          <Palette className="w-3.5 h-3.5" />
          {t.screenMode.title}
        </div>
        <p className="text-xs text-neutral-300/90">{t.screenMode.subtitle}</p>
      </div>

      {/* Screen Color Preview Lamp Box */}
      <div className="w-full my-4 flex flex-col items-center">
        <div
          id="screen-light-preview-bulb"
          onClick={onToggleFullscreen}
          className="relative w-full h-40 rounded-3xl cursor-pointer border-2 border-white/25 shadow-2xl transition-colors duration-100 flex flex-col items-center justify-center overflow-hidden group hover:border-amber-300/80"
          style={{
            backgroundColor: activeDisplayColor,
            opacity: brightness,
            boxShadow: `0 16px 46px -8px ${activeDisplayColor}66, inset 0 1px 0 rgba(255,255,255,0.45)`,
          }}
        >
          {/* Subtle overlay with Fullscreen Button */}
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors flex flex-col items-center justify-center p-4">
            <div className="px-4 py-2 rounded-full glass-chrome border text-white text-xs font-semibold flex items-center gap-2 group-hover:scale-105 transition-transform">
              <Maximize2 className="w-4 h-4 text-amber-400" />
              <span>{t.screenMode.fullscreenMode}</span>
            </div>
            <span className="text-[11px] text-neutral-900 font-semibold mt-2 bg-white/85 px-2.5 py-0.5 rounded-lg backdrop-blur-sm shadow-sm">
              {language === 'hi' ? 'फुलस्क्रीन लैंप के लिए टैप करें' : 'Tap for Fullscreen Lamp'}
            </span>
          </div>
        </div>
      </div>

      {/* Controls: Brightness Slider, Color Spectrum Picker & Quick Presets */}
      <div className="w-full glass-panel rounded-2xl p-4 space-y-4">
        {/* Brightness Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-medium text-neutral-300">
            <span className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              {t.screenMode.brightness}
            </span>
            <span className="font-mono tabular-nums text-amber-400 font-bold">
              {Math.round(brightness * 100)}%
            </span>
          </div>

          <input
            id="screen-brightness-slider"
            type="range"
            min="0.1"
            max="1"
            step="0.02"
            value={brightness}
            onChange={(e) => onChangeBrightness(Number(e.target.value))}
            className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
          />
        </div>

        {/* Interactive 2D Color Spectrum Picker */}
        <ColorSpectrumPicker
          color={selectedColor}
          isPoliceMode={isPoliceMode}
          onChangeColor={(hex, fromDrag) => onSelectColor(hex, fromDrag)}
          language={language}
        />

        {/* Quick Color Presets */}
        <div className="space-y-2 pt-3 border-t border-neutral-800/80">
          <div className="flex justify-between items-center text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
            <span>{t.screenMode.colorPresets}</span>
            <span className="text-neutral-500 lowercase">
              {COLOR_PRESETS.length} {language === 'hi' ? 'रंग' : 'presets'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {COLOR_PRESETS.map((preset) => {
              const isSelected = preset.isStrobe
                ? isPoliceMode
                : !isPoliceMode &&
                  selectedColor.toLowerCase() === preset.hex.toLowerCase();

              return (
                <button
                  id={`color-preset-${preset.id}`}
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    if (preset.isStrobe) {
                      onSelectColor('#police', false);
                    } else {
                      onSelectColor(preset.hex, false);
                    }
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center active:scale-95 ${
                    isSelected
                      ? 'bg-amber-500/18 border-amber-400/75 shadow-[0_4px_16px_rgba(245,158,11,0.22),inset_0_1px_0_rgba(255,255,255,0.25)]'
                      : 'glass-surface'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-full border border-black/20 flex items-center justify-center shadow-sm relative overflow-hidden"
                    style={{
                      background: preset.isStrobe
                        ? 'linear-gradient(45deg, #EF4444 50%, #3B82F6 50%)'
                        : preset.hex,
                    }}
                  >
                    {isSelected && (
                      <Check className="w-4 h-4 text-neutral-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)] stroke-[3]" />
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-neutral-300 mt-1 truncate max-w-[70px]">
                    {language === 'hi' ? preset.nameHi : preset.nameEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
