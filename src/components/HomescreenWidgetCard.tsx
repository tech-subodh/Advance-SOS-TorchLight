import React, { useState } from 'react';
import {
  LayoutGrid,
  ExternalLink,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Share,
  PlusSquare,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Language, UiTheme, WidgetLayoutVariant } from '../types';
import { BatteryStatus } from '../hooks/useBatteryStatus';
import { PWAInstallState } from '../hooks/usePWAInstall';
import { translations } from '../utils/translations';
import { TorchWidgetTile } from './TorchWidgetTile';

interface HomescreenWidgetCardProps {
  language: Language;
  layout: WidgetLayoutVariant;
  onChangeLayout: (layout: WidgetLayoutVariant) => void;
  widgetAutoStart: boolean;
  onToggleWidgetAutoStart: () => void;
  isTorchOn: boolean;
  onToggleTorch: () => void;
  torchIntensity: number;
  onChangeIntensity: (value: number) => void;
  canAdjustIntensity: boolean;
  hasHardwareTorch: boolean;
  battery: BatteryStatus;
  uiTheme: UiTheme;
  pwaInstall: PWAInstallState;
  onEnterWidgetMode: () => void;
  onQuickSos: () => void;
  onQuickScreenLight: () => void;
}

export const HomescreenWidgetCard: React.FC<HomescreenWidgetCardProps> = ({
  language,
  layout,
  onChangeLayout,
  widgetAutoStart,
  onToggleWidgetAutoStart,
  isTorchOn,
  onToggleTorch,
  torchIntensity,
  onChangeIntensity,
  canAdjustIntensity,
  hasHardwareTorch,
  battery,
  uiTheme,
  pwaInstall,
  onEnterWidgetMode,
  onQuickSos,
  onQuickScreenLight,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const tWidget = translations[language].widget;
  const tTorch = translations[language].torchMode;
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);

  const layoutOptions: Array<{ id: WidgetLayoutVariant; label: string }> = [
    { id: 'compact-2x1', label: tWidget.layouts['compact-2x1'] },
    { id: 'controls-2x2', label: tWidget.layouts['controls-2x2'] },
    { id: 'dock-4x1', label: tWidget.layouts['dock-4x1'] },
  ];

  const handleCopyShortcut = async () => {
    const url = `${window.location.origin}/?widget=torch${widgetAutoStart ? '&autostart=1' : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2400);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleInstallClick = async () => {
    if (pwaInstall.isInstallable) {
      await pwaInstall.install();
    } else {
      setShowInstallGuide(true);
    }
  };

  return (
    <div
      id="homescreen-widget-card"
      className="w-full glass-panel rounded-2xl p-3.5 space-y-3.5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/18 text-amber-300 border border-amber-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] flex items-center justify-center shrink-0">
            <LayoutGrid className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white leading-tight truncate">
              {tWidget.title}
            </div>
            <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
              {tWidget.subtitle}
            </div>
          </div>
        </div>

        <button
          id="open-widget-mode-card-btn"
          type="button"
          onClick={onEnterWidgetMode}
          className="min-h-[34px] px-2.5 py-1 rounded-xl bg-amber-500/18 border border-amber-400/45 text-amber-200 text-[11px] font-semibold flex items-center gap-1 shrink-0 active:scale-95 transition-all"
        >
          <span>{tWidget.openWidgetMode}</span>
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>

      {/* Layout Selector */}
      <div className="grid grid-cols-3 gap-1.5">
        {layoutOptions.map((opt) => {
          const selected = layout === opt.id;
          return (
            <button
              key={opt.id}
              id={`widget-layout-option-${opt.id}`}
              type="button"
              aria-pressed={selected}
              onClick={() => onChangeLayout(opt.id)}
              className={`min-h-[36px] px-2 py-1.5 rounded-xl text-[11px] font-medium border transition-all active:scale-95 truncate ${
                selected
                  ? 'bg-amber-500/90 text-neutral-950 border-amber-300/75 font-semibold shadow-sm'
                  : 'glass-surface text-neutral-200 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Live Interactive Homescreen Widget Preview */}
      <div className="rounded-2xl bg-black/35 border border-white/10 p-3 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-medium text-neutral-400 px-1">
          <span>{tWidget.livePreviewLabel}</span>
          <span className="text-amber-300/90">{tWidget.livePreviewHint}</span>
        </div>

        <TorchWidgetTile
          layout={layout}
          isTorchOn={isTorchOn}
          onToggleTorch={onToggleTorch}
          torchIntensity={torchIntensity}
          onChangeIntensity={onChangeIntensity}
          canAdjustIntensity={canAdjustIntensity}
          hasHardwareTorch={hasHardwareTorch}
          battery={battery}
          language={language}
          uiTheme={uiTheme}
          onQuickSos={onQuickSos}
          onQuickScreenLight={onQuickScreenLight}
          isPreview
        />
      </div>

      {/* Instant Auto-ON on Shortcut Launch Toggle */}
      <button
        id="widget-autostart-switch"
        type="button"
        role="switch"
        aria-checked={widgetAutoStart}
        onClick={onToggleWidgetAutoStart}
        className="w-full min-h-[42px] px-3 py-2 rounded-xl glass-surface flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Zap
            className={`w-3.5 h-3.5 shrink-0 ${
              widgetAutoStart ? 'text-amber-400' : 'text-neutral-500'
            }`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-white truncate">
              {tWidget.autoStartTitle}
            </div>
            <div className="text-[10px] text-neutral-400 truncate">
              {tWidget.autoStartSubtitle}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10px] font-semibold ${
              widgetAutoStart ? 'text-amber-400' : 'text-neutral-500'
            }`}
          >
            {widgetAutoStart ? tTorch.shakeOn : tTorch.shakeOff}
          </span>
          <span
            aria-hidden="true"
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              widgetAutoStart ? 'bg-amber-500' : 'bg-neutral-700'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-150 ${
                widgetAutoStart ? 'translate-x-4.5' : 'translate-x-1'
              }`}
            />
          </span>
        </div>
      </button>

      {/* Install / Homescreen Shortcut Actions */}
      <div className="grid grid-cols-2 gap-2">
        {pwaInstall.isInstalled ? (
          <div className="min-h-[40px] px-3 py-2 rounded-xl glass-surface border border-emerald-400/35 text-emerald-300 text-xs font-medium flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{tWidget.installedBadge}</span>
          </div>
        ) : (
          <button
            id="pwa-install-homescreen-btn"
            type="button"
            onClick={() => void handleInstallClick()}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-amber-500/90 text-neutral-950 border border-amber-300/75 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-[0_4px_14px_rgba(245,158,11,0.28)]"
          >
            <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {pwaInstall.isIOS ? tWidget.installIos : tWidget.installApp}
            </span>
          </button>
        )}

        <button
          id="copy-widget-shortcut-btn"
          type="button"
          onClick={() => void handleCopyShortcut()}
          className="min-h-[40px] px-3 py-2 rounded-xl glass-surface text-neutral-200 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-all"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
              <span className="truncate text-emerald-300">{tWidget.shortcutCopied}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span className="truncate">{tWidget.copyShortcut}</span>
            </>
          )}
        </button>
      </div>

      <p className="text-[11px] text-neutral-400 leading-relaxed">
        {tWidget.shortcutsTip}
      </p>

      {/* Install Guide Modal (iOS Safari / Manual Add to Home Screen) */}
      <AnimatePresence>
        {showInstallGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowInstallGuide(false)}
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl glass-panel border border-white/15 p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">{tWidget.iosGuideTitle}</h3>
                <button
                  type="button"
                  onClick={() => setShowInstallGuide(false)}
                  className="p-1.5 rounded-xl glass-surface text-neutral-300 hover:text-white"
                  aria-label={tWidget.iosGuideClose}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-neutral-200 leading-relaxed">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl glass-surface">
                  <Share className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{tWidget.iosGuideStep1}</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl glass-surface">
                  <PlusSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{tWidget.iosGuideStep2}</span>
                </div>
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed">
                {tWidget.shortcutsTip}
              </p>

              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="w-full min-h-[42px] rounded-xl bg-amber-500 text-neutral-950 font-semibold text-xs active:scale-95 transition-transform"
              >
                {tWidget.iosGuideClose}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
