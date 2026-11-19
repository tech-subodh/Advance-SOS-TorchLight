import React, { useEffect, useRef, useState } from 'react';
import { Compass, X, AlertCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { getCardinalDirection, normalizeHeading } from '../utils/compass';

interface CompassOverlayProps {
  heading: number | null;
  sensorUnavailable: boolean;
  error: string | null;
  language: Language;
  onClose: () => void;
}

const MAJOR_TICKS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const MINOR_TICKS = [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345];

export const CompassOverlay: React.FC<CompassOverlayProps> = ({
  heading,
  sensorUnavailable,
  error,
  language,
  onClose,
}) => {
  const t = translations[language].torchMode;
  const prefersReducedMotion = useReducedMotion();

  // Keep continuous rotation angle so crossing 359° -> 0° rotates shortest path
  const [continuousAngle, setContinuousAngle] = useState<number>(0);
  const lastRawHeadingRef = useRef<number | null>(null);

  useEffect(() => {
    if (heading === null) return;
    const normalized = normalizeHeading(heading);
    if (lastRawHeadingRef.current === null) {
      lastRawHeadingRef.current = normalized;
      setContinuousAngle(normalized);
      return;
    }
    const delta = ((normalized - lastRawHeadingRef.current + 540) % 360) - 180;
    lastRawHeadingRef.current = normalized;
    setContinuousAngle((prev) => prev + delta);
  }, [heading]);

  const roundedHeading = heading !== null ? Math.round(normalizeHeading(heading)) : null;
  const formattedDegrees =
    roundedHeading !== null ? `${String(roundedHeading).padStart(3, '0')}°` : '---°';
  const cardinalLabel =
    roundedHeading !== null ? getCardinalDirection(roundedHeading, language) : t.compassCalibrating;

  return (
    <motion.section
      id="torch-compass-overlay"
      aria-label={t.compassTitle}
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="w-full rounded-2xl glass-panel p-3.5"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-white truncate">
            {t.compassTitle}
          </span>
        </div>
        <button
          id="close-compass-overlay-btn"
          type="button"
          onClick={onClose}
          className="min-w-[32px] min-h-[32px] p-1.5 rounded-xl glass-surface text-neutral-300 hover:text-white flex items-center justify-center"
          aria-label={t.compassClose}
          title={t.compassClose}
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Dial + Heading Readout */}
      <div className="flex items-center justify-between gap-4">
        {/* Precision SVG Compass Rose */}
        <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
          <svg
            viewBox="0 0 140 140"
            className="w-full h-full"
            role="img"
            aria-label={`${t.compassTitle}: ${formattedDegrees} ${cardinalLabel}`}
          >
            {/* Outer bezel ring */}
            <circle
              cx="70"
              cy="70"
              r="64"
              fill="#0a0a0a"
              stroke="#262626"
              strokeWidth="2"
            />

            {/* Fixed top lubber pointer (direction phone is pointing) */}
            <polygon points="70,2 65,11 75,11" fill="#f59e0b" />

            {/* Rotating Compass Rose Dial */}
            <g
              style={{
                transformOrigin: '70px 70px',
                transform: `rotate(${-continuousAngle}deg)`,
                transition: prefersReducedMotion
                  ? 'none'
                  : 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Minor ticks */}
              {MINOR_TICKS.map((deg) => (
                <line
                  key={`minor-${deg}`}
                  x1="70"
                  y1="14"
                  x2="70"
                  y2="19"
                  stroke="#525252"
                  strokeWidth="1"
                  transform={`rotate(${deg} 70 70)`}
                />
              ))}

              {/* Major ticks */}
              {MAJOR_TICKS.map((deg) => (
                <line
                  key={`major-${deg}`}
                  x1="70"
                  y1="13"
                  x2="70"
                  y2={deg % 90 === 0 ? '22' : '20'}
                  stroke={deg === 0 ? '#f43f5e' : '#a3a3a3'}
                  strokeWidth={deg % 90 === 0 ? '2' : '1.25'}
                  transform={`rotate(${deg} 70 70)`}
                />
              ))}

              {/* Cardinal Labels */}
              <text
                x="70"
                y="34"
                textAnchor="middle"
                fill="#fb7185"
                fontSize="12"
                fontWeight="700"
              >
                N
              </text>
              <text
                x="110"
                y="74"
                textAnchor="middle"
                fill="#e5e5e5"
                fontSize="11"
                fontWeight="600"
              >
                E
              </text>
              <text
                x="70"
                y="114"
                textAnchor="middle"
                fill="#a3a3a3"
                fontSize="11"
                fontWeight="600"
              >
                S
              </text>
              <text
                x="30"
                y="74"
                textAnchor="middle"
                fill="#e5e5e5"
                fontSize="11"
                fontWeight="600"
              >
                W
              </text>

              {/* Subtle crosshairs */}
              <line x1="70" y1="48" x2="70" y2="92" stroke="#262626" strokeWidth="1" />
              <line x1="48" y1="70" x2="92" y2="70" stroke="#262626" strokeWidth="1" />

              {/* North indicator needle */}
              <polygon points="70,42 66.5,70 73.5,70" fill="#f43f5e" />
              <polygon points="70,98 66.5,70 73.5,70" fill="#525252" />
              <circle cx="70" cy="70" r="3.5" fill="#f59e0b" />
            </g>
          </svg>
        </div>

        {/* Numeric Heading & Direction Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="text-[11px] text-neutral-400">{t.compassHeadingLabel}</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-white tracking-tight leading-none">
            {formattedDegrees}
          </div>
          <div className="text-sm font-semibold text-amber-400 truncate">
            {cardinalLabel}
          </div>
          <p className="text-[11px] text-neutral-400 leading-snug pt-0.5">
            {t.compassTip}
          </p>
        </div>
      </div>

      {/* Sensor unavailable or permission notice */}
      {(error || sensorUnavailable) && (
        <div
          role="alert"
          className="mt-2.5 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/25 px-2.5 py-2 text-[11px] text-amber-200/90 leading-snug"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>{error || t.compassNoSensor}</span>
        </div>
      )}
    </motion.section>
  );
};
