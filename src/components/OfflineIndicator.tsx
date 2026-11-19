import React from 'react';
import { WifiOff } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { useOnlineStatus } from '../hooks/usePWAInstall';

interface OfflineIndicatorProps {
  language: Language;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ language }) => {
  const isOnline = useOnlineStatus();
  const prefersReducedMotion = useReducedMotion();
  const tWidget = translations[language].widget;

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          id="pwa-offline-indicator"
          role="status"
          aria-live="polite"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="fixed top-14 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full glass-panel border border-amber-400/40 bg-amber-950/70 text-amber-200 text-xs font-medium flex items-center gap-2 shadow-lg pointer-events-none whitespace-nowrap"
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
          <span>{tWidget.offlineNotice}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
