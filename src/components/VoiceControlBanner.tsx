import React from 'react';
import { Mic, MicOff, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Language } from '../types';
import { translations } from '../utils/translations';

interface VoiceControlBannerProps {
  language: Language;
  isListening: boolean;
  liveTranscript: string;
  lastConfirmation: string | null;
  error: string | null;
  onStopListening: () => void;
  onDismissMessage: () => void;
  onSimulateExample?: (phrase: string) => void;
}

export const VoiceControlBanner: React.FC<VoiceControlBannerProps> = ({
  language,
  isListening,
  liveTranscript,
  lastConfirmation,
  error,
  onStopListening,
  onDismissMessage,
  onSimulateExample,
}) => {
  const t = translations[language].common;
  const visible = isListening || Boolean(lastConfirmation) || Boolean(error);

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          id="voice-control-banner"
          key="voice-control-banner"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full px-4 pt-2.5 relative z-25"
        >
          <div
            className={`max-w-md mx-auto rounded-2xl glass-panel p-3 space-y-2 ${
              error
                ? 'border-rose-400/50 bg-rose-950/60 text-rose-100'
                : isListening
                  ? 'border-amber-400/50 text-white shadow-[0_8px_28px_rgba(245,158,11,0.16)]'
                  : 'border-emerald-400/45 text-emerald-100'
            }`}
          >
            {/* Primary Status Row */}
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    error
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : isListening
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  }`}
                >
                  {error ? (
                    <AlertCircle className="w-4 h-4" aria-hidden="true" />
                  ) : isListening ? (
                    <Mic className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0">
                  {error ? (
                    <p className="text-xs font-medium text-rose-200 leading-snug">
                      {error}
                    </p>
                  ) : isListening ? (
                    <>
                      <p className="text-xs font-semibold text-amber-300 leading-tight">
                        {t.voiceListening}
                      </p>
                      {liveTranscript ? (
                        <p className="text-xs text-white font-medium mt-0.5 truncate">
                          “{liveTranscript}”
                        </p>
                      ) : lastConfirmation ? (
                        <p className="text-[11px] text-emerald-400 font-medium mt-0.5 leading-snug">
                          {lastConfirmation}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs font-semibold text-emerald-300 leading-snug pt-1">
                      {lastConfirmation}
                    </p>
                  )}
                </div>
              </div>

              {isListening ? (
                <button
                  id="voice-banner-stop-btn"
                  type="button"
                  onClick={onStopListening}
                  aria-label={t.voiceStopHint}
                  title={t.voiceStopHint}
                  className="min-w-[32px] min-h-[32px] px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/40 text-rose-300 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors"
                >
                  <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{language === 'hi' ? 'रोकें' : 'Stop'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onDismissMessage}
                  aria-label={t.dismiss}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 shrink-0 transition-colors"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Spoken Command Examples (also tappable for quick execution) */}
            {isListening && !error && (
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-300">
                  {t.voiceTrySaying}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {t.voiceExamples.map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      onClick={() => onSimulateExample?.(phrase)}
                      className="px-2.5 py-1 rounded-lg glass-surface text-[11px] text-neutral-200 hover:text-amber-300 active:scale-95"
                    >
                      “{phrase}”
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
