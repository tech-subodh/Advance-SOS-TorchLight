import React, { useEffect, useState } from 'react';
import { History, RotateCcw, Clock } from 'lucide-react';
import { Language, TorchUsageEntry } from '../types';
import { translations } from '../utils/translations';

interface UsageHistoryCardProps {
  language: Language;
  accumulatedMs: number;
  activeStartedAt: number | null;
  entries: TorchUsageEntry[];
  onResetHistory: () => void;
}

function formatDurationClock(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatDurationCompact(totalMs: number): string {
  const totalSeconds = Math.max(1, Math.round(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function formatClockTime(timestamp: number, language: Language): string {
  try {
    return new Date(timestamp).toLocaleTimeString(
      language === 'hi' ? 'hi-IN' : 'en-US',
      {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      },
    );
  } catch {
    return '--:--';
  }
}

export const UsageHistoryCard: React.FC<UsageHistoryCardProps> = ({
  language,
  accumulatedMs,
  activeStartedAt,
  entries,
  onResetHistory,
}) => {
  const t = translations[language].torchMode;
  const [now, setNow] = useState<number>(() => Date.now());

  // Tick every 500ms only while the torch is actively running so the rest of the app stays idle
  useEffect(() => {
    if (activeStartedAt === null) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(timer);
  }, [activeStartedAt]);

  const currentRunMs =
    activeStartedAt !== null ? Math.max(0, now - activeStartedAt) : 0;
  const totalActiveMs = accumulatedMs + currentRunMs;
  const totalActivations = entries.length + (activeStartedAt !== null ? 1 : 0);
  const hasAnyHistory = totalActiveMs > 0 || entries.length > 0;

  return (
    <div
      id="torch-usage-history-card"
      className="w-full glass-panel rounded-2xl p-3.5 space-y-3"
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
              activeStartedAt !== null
                ? 'bg-amber-500/18 text-amber-300 border-amber-400/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'glass-surface text-neutral-300'
            }`}
          >
            <History className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white leading-tight truncate">
                {t.usageHistoryTitle}
              </span>
              {activeStartedAt !== null && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-400 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {t.usageLiveBadge}
                </span>
              )}
            </div>
            <div className="text-[11px] text-neutral-400 leading-snug mt-0.5">
              {t.usageHistorySubtitle}
            </div>
          </div>
        </div>

        {hasAnyHistory && (
          <button
            id="torch-usage-history-reset"
            type="button"
            onClick={onResetHistory}
            className="min-h-[30px] px-2.5 py-1 rounded-lg glass-surface hover:bg-white/[0.1] text-[11px] text-neutral-200 font-medium flex items-center gap-1 shrink-0 transition-colors active:scale-95"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>{t.usageResetBtn}</span>
          </button>
        )}
      </div>

      {/* Primary Session Stats Strip */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl glass-input px-3 py-2.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
            {t.usageTotalTime}
          </div>
          <div
            id="torch-usage-total-time"
            className="mt-1 font-mono tabular-nums text-lg font-bold text-amber-400 leading-none"
          >
            {formatDurationClock(totalActiveMs)}
          </div>
        </div>

        <div className="rounded-xl glass-input px-3 py-2.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
            {activeStartedAt !== null ? t.usageCurrentRun : t.usageActivations}
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-lg font-bold text-white leading-none">
              {activeStartedAt !== null
                ? formatDurationClock(currentRunMs)
                : totalActivations}
            </span>
            {activeStartedAt !== null && (
              <span className="font-mono tabular-nums text-[10px] text-neutral-400">
                #{totalActivations}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Recent Session Activations List */}
      {entries.length > 0 ? (
        <div className="space-y-1.5 pt-2 border-t border-white/10">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            {t.usageRecentSessions}
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg glass-input text-[11px]"
              >
                <div className="flex items-center gap-1.5 text-neutral-200 min-w-0">
                  <Clock className="w-3 h-3 text-neutral-400 shrink-0" aria-hidden="true" />
                  <span className="font-mono tabular-nums truncate">
                    {formatClockTime(entry.startedAt, language)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                  <span className="text-neutral-400 text-[10px]">
                    {entry.intensityPercent}%
                  </span>
                  <span className="text-amber-300 font-semibold">
                    {formatDurationCompact(entry.durationMs)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        activeStartedAt === null && (
          <p className="text-[11px] text-neutral-400 leading-snug">
            {t.usageEmptyState}
          </p>
        )
      )}
    </div>
  );
};
