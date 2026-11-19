import React from 'react';
import { Moon, Flashlight, Smartphone, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Language } from '../types';
import { translations } from '../utils/translations';

interface AmbientLightBannerProps {
  visible: boolean;
  ambientLevel: number | null;
  language: Language;
  onEnableTorch: () => void;
  onOpenScreenLight: () => void;
  onDismiss: () => void;
}

export const AmbientLightBanner: React.FC<AmbientLightBannerProps> = ({
  visible,
  ambientLevel,
  language,
  onEnableTorch,
  onOpenScreenLight,
  onDismiss,
}) => {
  const tCommon = translations[language].common;
  const tTorch = translations[language].torchMode;

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          id="ambient-dark-suggestion-banner"
          key="ambient-dark-suggestion-banner"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full px-4 pt-2.5 relative z-25"
        >
          <div className="max-w-md mx-auto rounded-2xl glass-panel border-indigo-400/45 p-3.5 shadow-[0_8px_28px_rgba(99,102,241,0.2)] space-y-2.5">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center shrink-0">
                  <Moon className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-white leading-tight">
                      {tCommon.ambientDarkBannerTitle}
                    </span>
                    {ambientLevel !== null && (
                      <span className="font-mono tabular-nums text-[10px] font-semibold text-indigo-300">
                        {ambientLevel}% · {tTorch.ambientDark}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-snug mt-0.5">
                    {tCommon.ambientDarkBannerBody}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onDismiss}
                aria-label={tCommon.dismiss}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 shrink-0 transition-colors"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* One-tap Suggested Actions: Enable Torch or Screen Light */}
            <div className="grid grid-cols-2 gap-2">
              <button
                id="ambient-suggest-torch-btn"
                type="button"
                onClick={onEnableTorch}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Flashlight className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{tCommon.ambientEnableTorch}</span>
              </button>

              <button
                id="ambient-suggest-screen-btn"
                type="button"
                onClick={onOpenScreenLight}
                className="min-h-[38px] px-3 py-1.5 rounded-xl glass-surface text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>{tCommon.ambientOpenScreen}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
