import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AppMode, UiTheme } from '../types';

interface LiquidBackdropProps {
  currentMode: AppMode;
  isLightActive: boolean;
  uiTheme: UiTheme;
  screenColor: string;
}

interface OrbPalette {
  primary: string;
  secondary: string;
  tertiary: string;
}

function getOrbPalette(
  currentMode: AppMode,
  uiTheme: UiTheme,
  screenColor: string,
): OrbPalette {
  // Preserve scotopic dark adaptation in Red Night & Warm Sepia themes
  if (uiTheme === 'red-night') {
    return {
      primary: 'rgba(220, 38, 38, 0.34)',
      secondary: 'rgba(153, 27, 27, 0.28)',
      tertiary: 'rgba(239, 68, 68, 0.2)',
    };
  }

  if (uiTheme === 'sepia-night') {
    return {
      primary: 'rgba(217, 119, 6, 0.3)',
      secondary: 'rgba(146, 64, 14, 0.28)',
      tertiary: 'rgba(245, 158, 11, 0.2)',
    };
  }

  switch (currentMode) {
    case 'sos':
      return {
        primary: 'rgba(225, 29, 72, 0.36)',
        secondary: 'rgba(190, 18, 60, 0.26)',
        tertiary: 'rgba(244, 63, 94, 0.22)',
      };
    case 'strobe':
      return {
        primary: 'rgba(245, 158, 11, 0.34)',
        secondary: 'rgba(234, 179, 8, 0.24)',
        tertiary: 'rgba(251, 146, 60, 0.2)',
      };
    case 'screen': {
      const safeHex =
        screenColor.startsWith('#') &&
        (screenColor.length === 7 || screenColor.length === 4)
          ? screenColor
          : '#38BDF8';
      return {
        primary: `${safeHex}4D`,
        secondary: `${safeHex}33`,
        tertiary: 'rgba(245, 158, 11, 0.16)',
      };
    }
    case 'scanner':
      return {
        primary: 'rgba(245, 158, 11, 0.24)',
        secondary: 'rgba(226, 232, 240, 0.16)',
        tertiary: 'rgba(251, 191, 36, 0.15)',
      };
    case 'studio':
      return {
        primary: 'rgba(245, 158, 11, 0.28)',
        secondary: 'rgba(20, 184, 166, 0.22)',
        tertiary: 'rgba(234, 179, 8, 0.18)',
      };
    case 'torch':
    default:
      return {
        primary: 'rgba(245, 158, 11, 0.32)',
        secondary: 'rgba(180, 83, 9, 0.25)',
        tertiary: 'rgba(251, 191, 36, 0.19)',
      };
  }
}

export const LiquidBackdrop: React.FC<LiquidBackdropProps> = ({
  currentMode,
  isLightActive,
  uiTheme,
  screenColor,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const palette = getOrbPalette(currentMode, uiTheme, screenColor);

  return (
    <div
      id="liquid-glass-backdrop"
      aria-hidden="true"
      className="fixed inset-0 overflow-hidden pointer-events-none z-0"
    >
      {/* Top-Left Primary Liquid Orb */}
      <motion.div
        animate={
          prefersReducedMotion
            ? { opacity: isLightActive ? 0.95 : 0.62 }
            : {
                opacity: isLightActive ? 1 : 0.66,
                scale: isLightActive ? 1.12 : 1,
              }
        }
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -top-24 -left-24 w-[24rem] h-[24rem] sm:w-[32rem] sm:h-[32rem] rounded-full blur-[90px] liquid-orb-a"
        style={{
          background: `radial-gradient(circle at 40% 40%, ${palette.primary} 0%, transparent 72%)`,
        }}
      />

      {/* Bottom-Right Secondary Liquid Orb */}
      <motion.div
        animate={
          prefersReducedMotion
            ? { opacity: isLightActive ? 0.9 : 0.58 }
            : {
                opacity: isLightActive ? 0.92 : 0.6,
                scale: isLightActive ? 1.08 : 1,
              }
        }
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -bottom-28 -right-24 w-[24rem] h-[24rem] sm:w-[34rem] sm:h-[34rem] rounded-full blur-[100px] liquid-orb-b"
        style={{
          background: `radial-gradient(circle at 60% 60%, ${palette.secondary} 0%, transparent 72%)`,
        }}
      />

      {/* Mid-Center Reactive Optical Bloom behind the main lens */}
      <motion.div
        animate={
          prefersReducedMotion
            ? { opacity: isLightActive ? 0.85 : 0.35 }
            : {
                opacity: isLightActive ? 0.95 : 0.4,
                scale: isLightActive ? 1.16 : 0.96,
              }
        }
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-[22%] left-1/2 -translate-x-1/2 w-[22rem] h-[22rem] sm:w-[28rem] sm:h-[28rem] rounded-full blur-[95px] liquid-orb-c"
        style={{
          background: `radial-gradient(circle, ${palette.tertiary} 0%, transparent 70%)`,
        }}
      />

      {/* Subtle architectural specular mesh veil for depth contrast */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(120% 70% at 50% 0%, rgba(255,255,255,0.035) 0%, transparent 55%)',
        }}
      />
    </div>
  );
};
