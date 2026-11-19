import React, { useState } from 'react';
import { Power } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

interface PowerButtonProps {
  isOn: boolean;
  onToggle: () => void;
  label?: string;
  size?: 'normal' | 'large';
  accentColor?: string; // hex color
  disabled?: boolean;
  hapticEnabled?: boolean;
}

export const PowerButton: React.FC<PowerButtonProps> = ({
  isOn,
  onToggle,
  label,
  size = 'large',
  accentColor = '#F59E0B',
  disabled = false,
  hapticEnabled = true,
}) => {
  const [pulseCount, setPulseCount] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const isLarge = size === 'large';
  const outerSize = isLarge ? 'w-48 h-48 sm:w-56 sm:h-56' : 'w-36 h-36';
  const innerSize = isLarge ? 'w-36 h-36 sm:w-44 sm:h-44' : 'w-28 h-28';
  const iconSize = isLarge ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-12 h-12';

  const handlePress = () => {
    if (hapticEnabled) {
      setPulseCount((c) => c + 1);
    }
    onToggle();
  };

  return (
    <div className="flex flex-col items-center justify-center select-none my-4">
      {/* Outer Halo Glow */}
      <div className="relative flex items-center justify-center">
        {/* Liquid concentric ripple on toggle */}
        <AnimatePresence>
          {pulseCount > 0 && hapticEnabled && !prefersReducedMotion && (
            <motion.span
              key={pulseCount}
              initial={{ scale: 0.9, opacity: 0.72 }}
              animate={{ scale: 1.34, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 rounded-full border-2 pointer-events-none"
              style={{ borderColor: accentColor }}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        {/* Breathing liquid ambient aura when ON */}
        {isOn && (
          <motion.div
            initial={{ scale: 0.82, opacity: 0 }}
            animate={
              prefersReducedMotion
                ? { scale: 1.04, opacity: 0.5 }
                : { scale: [0.98, 1.12, 0.98], opacity: [0.42, 0.72, 0.42] }
            }
            transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
            className="absolute -inset-7 rounded-full blur-3xl pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${accentColor} 0%, transparent 72%)`,
            }}
          />
        )}

        {/* Frosted Refractive Outer Glass Bezel */}
        <div
          className={`relative ${outerSize} rounded-full p-2.5 flex items-center justify-center transition-all duration-500 backdrop-blur-2xl`}
          style={{
            background: isOn
              ? `linear-gradient(145deg, rgba(255,255,255,0.16) 0%, ${accentColor}26 55%, rgba(10,10,14,0.65) 100%)`
              : 'linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 50%, rgba(0,0,0,0.45) 100%)',
            border: isOn
              ? `1.5px solid ${accentColor}80`
              : '1px solid rgba(255,255,255,0.15)',
            boxShadow: isOn
              ? `0 20px 55px -10px ${accentColor}55, inset 0 1.5px 0 rgba(255,255,255,0.35), inset 0 -4px 12px rgba(0,0,0,0.45)`
              : '0 20px 44px -14px rgba(0,0,0,0.75), inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -4px 12px rgba(0,0,0,0.55)',
          }}
        >
          {/* Subtle inner refractive ring */}
          <div className="absolute inset-2 rounded-full border border-white/12 pointer-events-none" />

          {/* Pressable Liquid Glass Optical Dome Button */}
          <motion.button
            id="main-power-toggle-button"
            type="button"
            disabled={disabled}
            onClick={handlePress}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.93 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            className={`relative ${innerSize} rounded-full flex flex-col items-center justify-center transition-all duration-300 focus:outline-none cursor-pointer overflow-hidden backdrop-blur-xl`}
            style={
              isOn
                ? {
                    background: `radial-gradient(120% 100% at 32% 20%, rgba(255,255,255,0.55) 0%, ${accentColor} 42%, ${accentColor}CC 100%)`,
                    boxShadow: `0 10px 30px ${accentColor}75, inset 0 2px 5px rgba(255,255,255,0.7), inset 0 -6px 14px rgba(0,0,0,0.35)`,
                    border: '1px solid rgba(255,255,255,0.45)',
                  }
                : {
                    background:
                      'linear-gradient(155deg, rgba(255,255,255,0.11) 0%, rgba(24,24,30,0.72) 55%, rgba(10,10,14,0.88) 100%)',
                    boxShadow:
                      '0 8px 22px rgba(0,0,0,0.62), inset 0 1.5px 3px rgba(255,255,255,0.18), inset 0 -4px 10px rgba(0,0,0,0.65)',
                    border: '1px solid rgba(255,255,255,0.14)',
                  }
            }
            aria-pressed={isOn}
            aria-label={label || (isOn ? 'Turn off' : 'Turn on')}
          >
            {/* Specular upper liquid glass reflection crescent */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1.5 left-1/2 -translate-x-1/2 w-[72%] h-[36%] rounded-full opacity-55"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 100%)',
              }}
            />

            <Power
              className={`relative z-10 ${iconSize} transition-all duration-300 ${
                isOn
                  ? 'text-neutral-950 drop-shadow-[0_2px_6px_rgba(255,255,255,0.45)]'
                  : 'text-neutral-300/80'
              }`}
              strokeWidth={isLarge ? 2.5 : 2.2}
            />

            {/* Luminous active indicator pip */}
            <div
              className={`relative z-10 mt-1.5 w-2 h-2 rounded-full transition-all duration-300 ${
                isOn
                  ? 'bg-white shadow-[0_0_10px_#ffffff]'
                  : 'bg-white/25'
              }`}
            />
          </motion.button>
        </div>
      </div>

      {label && (
        <span
          className={`mt-4 text-xs sm:text-sm font-semibold tracking-wider uppercase transition-colors ${
            isOn ? 'text-amber-300' : 'text-neutral-300/80'
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
};
