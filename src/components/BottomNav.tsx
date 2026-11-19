import React from 'react';
import { Flashlight, Zap, ShieldAlert, SunMedium, QrCode, MessageSquare } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { AppMode, Language } from '../types';
import { translations } from '../utils/translations';

interface BottomNavProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  language: Language;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentMode,
  onSelectMode,
  language,
}) => {
  const t = translations[language];
  const prefersReducedMotion = useReducedMotion();

  const navItems: {
    mode: AppMode;
    label: string;
    icon: React.ReactNode;
    color: string;
    glow: string;
  }[] = [
    {
      mode: 'torch',
      label: t.modes.torch,
      icon: <Flashlight className="w-5 h-5" />,
      color: 'text-amber-400',
      glow: 'rgba(245, 158, 11, 0.22)',
    },
    {
      mode: 'strobe',
      label: t.modes.strobe,
      icon: <Zap className="w-5 h-5" />,
      color: 'text-yellow-400',
      glow: 'rgba(250, 204, 21, 0.22)',
    },
    {
      mode: 'sos',
      label: t.modes.sos,
      icon: <ShieldAlert className="w-5 h-5" />,
      color: 'text-rose-400',
      glow: 'rgba(244, 63, 94, 0.25)',
    },
    {
      mode: 'screen',
      label: t.modes.screen,
      icon: <SunMedium className="w-5 h-5" />,
      color: 'text-cyan-400',
      glow: 'rgba(34, 211, 238, 0.22)',
    },
    {
      mode: 'scanner',
      label: t.modes.scanner,
      icon: <QrCode className="w-5 h-5" />,
      color: 'text-white',
      glow: 'rgba(255, 255, 255, 0.16)',
    },
    {
      mode: 'studio',
      label: t.modes.studio,
      icon: <MessageSquare className="w-5 h-5" />,
      color: 'text-amber-300',
      glow: 'rgba(251, 191, 36, 0.22)',
    },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      aria-label="Navigation modes"
      className="fixed bottom-0 left-0 right-0 z-40 px-2.5 pb-2 pt-1 safe-area-pb pointer-events-none"
    >
      <div className="max-w-2xl mx-auto glass-chrome border rounded-2xl p-1 grid grid-cols-6 gap-1 pointer-events-auto">
        {navItems.map((item) => {
          const isActive = currentMode === item.mode;
          return (
            <button
              id={`nav-item-${item.mode}`}
              key={item.mode}
              type="button"
              onClick={() => onSelectMode(item.mode)}
              className={`min-h-[48px] flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-colors relative overflow-hidden ${
                isActive
                  ? 'text-white font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="liquid-nav-active-pill"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0.12 }
                      : { type: 'spring', stiffness: 410, damping: 32, mass: 0.8 }
                  }
                  className="absolute inset-0 rounded-xl border border-white/20"
                  style={{
                    background: `linear-gradient(180deg, rgba(255,255,255,0.14) 0%, ${item.glow} 100%)`,
                    boxShadow:
                      'inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 14px -4px rgba(0,0,0,0.45)',
                  }}
                  aria-hidden="true"
                />
              )}

              <div
                className={`relative z-10 transition-transform duration-200 ${
                  isActive ? `${item.color} scale-105` : ''
                }`}
              >
                {item.icon}
              </div>

              <span
                className={`relative z-10 text-[10px] mt-1 tracking-tight truncate max-w-full whitespace-nowrap ${
                  isActive ? 'text-white font-semibold' : 'text-neutral-400'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
