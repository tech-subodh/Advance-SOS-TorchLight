import React from 'react';
import { AlertTriangle, X, BatteryLow } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Language } from '../types';
import { translations } from '../utils/translations';

interface LowBatteryAlertProps {
  visible: boolean;
  batteryLevel: number | null;
  language: Language;
  onConservePower: () => void;
  onDismiss: () => void;
}

export const LowBatteryAlert: React.FC<LowBatteryAlertProps> = ({
  visible,
  batteryLevel,
  language,
  onConservePower,
  onDismiss,
}) => {
  const t = translations[language].common;
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {visible && batteryLevel !== null && (
        <motion.div
          id="low-battery-alert-banner"
          role="alert"
          aria-live="assertive"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-6xl mx-auto px-4 pt-3 relative z-20"
        >
          <div className="w-full rounded-2xl glass-panel border-rose-400/50 bg-rose-950/60 px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-rose-100 leading-tight flex items-center gap-1.5 flex-wrap">
                  <span>{t.lowBatteryAlertTitle}</span>
                  <span className="font-mono tabular-nums text-rose-300">
                    ({batteryLevel}%)
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-rose-200/85 leading-snug mt-0.5">
                  {t.lowBatteryAlertBody}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                id="low-battery-conserve-btn"
                type="button"
                onClick={onConservePower}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-neutral-950 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <BatteryLow className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.lowBatteryConserveAction}</span>
              </button>

              <button
                id="low-battery-dismiss-btn"
                type="button"
                onClick={onDismiss}
                className="min-w-[36px] min-h-[36px] p-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-500/30 flex items-center justify-center transition-colors"
                aria-label={t.dismiss}
                title={t.dismiss}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
