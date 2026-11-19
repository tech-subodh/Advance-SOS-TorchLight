import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  Download,
  Copy,
  Check,
  Share,
  PlusSquare,
  X,
  LayoutGrid,
  CheckCircle2,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Language, UiTheme, WidgetLayoutVariant } from '../types';
import { BatteryStatus } from '../hooks/useBatteryStatus';
import { PWAInstallState } from '../hooks/usePWAInstall';
import { translations } from '../utils/translations';
import { TorchWidgetTile } from './TorchWidgetTile';

interface HomescreenWidgetModeProps {
  layout: WidgetLayoutVariant;
  onChangeLayout: (layout: WidgetLayoutVariant) => void;
  isTorchOn: boolean;
  onToggleTorch: () => void;
  torchIntensity: number;
  onChangeIntensity: (value: number) => void;
  canAdjustIntensity: boolean;
  hasHardwareTorch: boolean;
  battery: BatteryStatus;
  language: Language;
  uiTheme: UiTheme;
  pwaInstall: PWAInstallState;
  onQuickSos: () => void;
  onQuickScreenLight: () => void;
  onExitWidgetMode: () => void;
}

const LAYOUT_OPTIONS: Array<{ id: WidgetLayoutVariant; shortLabel: string }> = [
  { id: 'compact-2x1', shortLabel: '2×1' },
  { id: 'controls-2x2', shortLabel: '2×2' },
  { id: 'dock-4x1', shortLabel: '4×1' },
];

export const HomescreenWidgetMode: React.FC<HomescreenWidgetModeProps> = ({
  layout,
  onChangeLayout,
  isTorchOn,
  onToggleTorch,
  torchIntensity,
  onChangeIntensity,
  canAdjustIntensity,
  hasHardwareTorch,
  battery,
  language,
  uiTheme,
  pwaInstall,
  onQuickSos,
  onQuickScreenLight,
  onExitWidgetMode,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const t = translations[language];
  const tWidget = t.widget;

  const [now, setNow] = useState<Date>(() => new Date());
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  const locale = language === 'hi' ? 'hi-IN' : 'en-US';
  const timeString = now.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const dateString = now.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const handleCopyShortcut = async () => {
    const shortcutUrl = `${window.location.origin}/?widget=torch&autostart=1`;
    try {
      await navigator.clipboard.writeText(shortcutUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2400);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleInstallAction = async () => {
    if (pwaInstall.isInstallable) {
      await pwaInstall.install();
    } else {
      setShowIosGuide(true);
    }
  };

  return (
    <div
      id="homescreen-widget-mode-view"
      className="min-h-screen w-full relative z-20 flex flex-col justify-between px-4 py-6 max-w-md mx-auto select-none"
    >
      {/* Top Homescreen-style Clock & Mode Pill */}
      <div className="flex flex-col items-center text-center pt-4 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-pill text-[11px] font-medium text-amber-300/95">
          <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{tWidget.widgetModeBadge}</span>
        </div>

        <div className="text-5xl font-bold tracking-tight text-white tabular-nums leading-none pt-1">
          {timeString}
        </div>
        <div className="text-xs font-medium text-neutral-300/85">
          {dateString}
        </div>
      </div>

      {/* Center Live Interactive Homescreen Widget */}
      <div className="my-auto py-6 w-full flex flex-col items-center gap-5">
        <motion.div
          key={layout}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
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
            onExpandFullApp={onExitWidgetMode}
          />
        </motion.div>

        {/* Widget Size Switcher */}
        <div className="inline-flex items-center gap-1 p-1 rounded-2xl glass-panel">
          {LAYOUT_OPTIONS.map((opt) => {
            const selected = layout === opt.id;
            return (
              <button
                key={opt.id}
                id={`widget-mode-size-${opt.id}`}
                type="button"
                aria-pressed={selected}
                onClick={() => onChangeLayout(opt.id)}
                className={`min-h-[34px] px-3.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                  selected
                    ? 'bg-amber-500/90 text-neutral-950 shadow-sm'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                {opt.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Dock: Open Full App, Add to Homescreen, Copy Shortcut */}
      <div className="w-full space-y-2.5 pb-2">
        <button
          id="widget-exit-open-full-app-btn"
          type="button"
          onClick={onExitWidgetMode}
          className="w-full min-h-[48px] px-4 py-3 rounded-2xl glass-panel border border-white/15 hover:border-amber-400/40 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <span>{tWidget.openFullApp}</span>
          <ArrowUpRight className="w-4 h-4 text-amber-400" aria-hidden="true" />
        </button>

        <div className="grid grid-cols-2 gap-2">
          {pwaInstall.isInstalled ? (
            <div className="min-h-[42px] px-3 py-2 rounded-xl glass-surface border border-emerald-400/35 text-emerald-300 text-xs font-medium flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{tWidget.installedBadge}</span>
            </div>
          ) : (
            <button
              id="widget-mode-install-btn"
              type="button"
              onClick={() => void handleInstallAction()}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-amber-500/18 border border-amber-400/40 text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {pwaInstall.isIOS ? tWidget.installIos : tWidget.installApp}
              </span>
            </button>
          )}

          <button
            id="widget-mode-copy-shortcut-btn"
            type="button"
            onClick={() => void handleCopyShortcut()}
            className="min-h-[42px] px-3 py-2 rounded-xl glass-surface text-neutral-200 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-all"
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
      </div>

      {/* Add-to-Homescreen Guide Modal (iOS Safari / Manual Install Fallback) */}
      <AnimatePresence>
        {showIosGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowIosGuide(false)}
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
                  onClick={() => setShowIosGuide(false)}
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
                onClick={() => setShowIosGuide(false)}
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
