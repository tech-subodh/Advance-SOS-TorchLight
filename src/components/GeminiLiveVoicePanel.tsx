import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Volume2,
  VolumeX,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { getClientId } from '../services/api';
import {
  LIVE_INPUT_SAMPLE_RATE,
  LIVE_OUTPUT_SAMPLE_RATE,
  computeRmsLevel,
  decodeBase64Pcm24kToAudioBuffer,
  float32ToBase64Pcm16,
} from '../utils/liveAudio';

export type LiveVoiceName = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';

type ConnectionPhase = 'idle' | 'connecting' | 'connected';

interface LiveTranscriptItem {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface GeminiLiveVoicePanelProps {
  language: Language;
  onBeforeStartVoice?: () => void;
}

const VOICE_OPTIONS: Array<{
  id: LiveVoiceName;
  label: string;
  toneHi: string;
  toneEn: string;
}> = [
  { id: 'Zephyr', label: 'Zephyr', toneHi: 'संतुलित', toneEn: 'Balanced' },
  { id: 'Puck', label: 'Puck', toneHi: 'ऊर्जावान', toneEn: 'Lively' },
  { id: 'Kore', label: 'Kore', toneHi: 'स्पष्ट', toneEn: 'Clear' },
  { id: 'Charon', label: 'Charon', toneHi: 'गंभीर', toneEn: 'Deep' },
  { id: 'Fenrir', label: 'Fenrir', toneHi: 'उत्साही', toneEn: 'Warm' },
];

const DEFAULT_MAX_DURATION_SEC = 300;

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const GeminiLiveVoicePanel: React.FC<GeminiLiveVoicePanelProps> = ({
  language,
  onBeforeStartVoice,
}) => {
  const t = translations[language].studio.liveVoice;

  const [phase, setPhase] = useState<ConnectionPhase>('idle');
  const [selectedVoice, setSelectedVoice] = useState<LiveVoiceName>('Zephyr');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState<boolean>(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState<boolean>(false);
  const [inputLevel, setInputLevel] = useState<number>(0);
  const [outputLevel, setOutputLevel] = useState<number>(0);
  const [remainingSec, setRemainingSec] = useState<number>(DEFAULT_MAX_DURATION_SEC);
  const [transcripts, setTranscripts] = useState<LiveTranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs for callbacks to prevent stale closures in onaudioprocess & WebSocket handlers
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const isMicMutedRef = useRef<boolean>(false);
  const isSpeakerMutedRef = useRef<boolean>(false);
  const isConnectedRef = useRef<boolean>(false);
  const lastMeterUpdateRef = useRef<number>(0);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUserTurnIdRef = useRef<string | null>(null);
  const currentModelTurnIdRef = useRef<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  isMicMutedRef.current = isMicMuted;
  isSpeakerMutedRef.current = isSpeakerMuted;

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const stopAllPlayback = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.onended = null;
        src.stop();
        src.disconnect();
      } catch {
        // already stopped
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsModelSpeaking(false);
    setOutputLevel(0);
  }, []);

  const cleanupSession = useCallback(
    (preserveError = false) => {
      isConnectedRef.current = false;

      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }

      stopAllPlayback();

      if (processorNodeRef.current) {
        try {
          processorNodeRef.current.onaudioprocess = null;
          processorNodeRef.current.disconnect();
        } catch {
          // ignore
        }
        processorNodeRef.current = null;
      }

      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch {
          // ignore
        }
        sourceNodeRef.current = null;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
        mediaStreamRef.current = null;
      }

      if (inputAudioCtxRef.current) {
        void inputAudioCtxRef.current.close().catch(() => {});
        inputAudioCtxRef.current = null;
      }

      if (outputAudioCtxRef.current) {
        void outputAudioCtxRef.current.close().catch(() => {});
        outputAudioCtxRef.current = null;
      }
      outputGainRef.current = null;

      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (
          ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING
        ) {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'stop' }));
            }
            ws.close(1000, 'Client ended session');
          } catch {
            // ignore
          }
        }
      }

      currentUserTurnIdRef.current = null;
      currentModelTurnIdRef.current = null;
      setPhase('idle');
      setInputLevel(0);
      setOutputLevel(0);
      setIsModelSpeaking(false);
      setIsMicMuted(false);
      isMicMutedRef.current = false;
      if (!preserveError) {
        setError(null);
      }
    },
    [stopAllPlayback],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupSession(true);
    };
  }, [cleanupSession]);

  // Keep speaker gain synced with mute toggle
  useEffect(() => {
    const gainNode = outputGainRef.current;
    const ctx = outputAudioCtxRef.current;
    if (gainNode && ctx) {
      gainNode.gain.setTargetAtTime(
        isSpeakerMuted ? 0 : 1,
        ctx.currentTime,
        0.02,
      );
    }
  }, [isSpeakerMuted]);

  const appendTranscriptChunk = useCallback(
    (role: 'user' | 'model', chunkText: string) => {
      const normalized = chunkText;
      if (!normalized.trim()) return;

      if (role === 'user') {
        currentModelTurnIdRef.current = null;
      } else {
        currentUserTurnIdRef.current = null;
      }

      const activeRef =
        role === 'user' ? currentUserTurnIdRef : currentModelTurnIdRef;

      if (!activeRef.current) {
        const newId = `${role}-live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        activeRef.current = newId;
        setTranscripts((prev) => [
          ...prev.slice(-40),
          { id: newId, role, text: normalized.trimStart() },
        ]);
      } else {
        const targetId = activeRef.current;
        setTranscripts((prev) =>
          prev.map((item) => {
            if (item.id !== targetId) return item;
            const needsSpace =
              item.text.length > 0 &&
              !/\s$/.test(item.text) &&
              !/^[\s.,!?;:।]/.test(normalized);
            return {
              ...item,
              text: `${item.text}${needsSpace ? ' ' : ''}${normalized}`,
            };
          }),
        );
      }
    },
    [],
  );

  const scheduleAudioChunk = useCallback((base64Pcm: string) => {
    const outCtx = outputAudioCtxRef.current;
    const outGain = outputGainRef.current;
    if (!outCtx || !outGain) return;

    if (outCtx.state === 'suspended') {
      void outCtx.resume().catch(() => {});
    }

    const audioBuffer = decodeBase64Pcm24kToAudioBuffer(base64Pcm, outCtx);
    if (!audioBuffer) return;

    const rms = computeRmsLevel(audioBuffer.getChannelData(0));
    setOutputLevel(rms);
    setIsModelSpeaking(true);

    const source = outCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outGain);

    const now = outCtx.currentTime;
    const startAt = Math.max(now + 0.02, nextStartTimeRef.current);
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setIsModelSpeaking(false);
        setOutputLevel(0);
      }
    };

    try {
      source.start(startAt);
    } catch {
      activeSourcesRef.current.delete(source);
    }
  }, []);

  const handleStartConversation = async () => {
    if (phase !== 'idle') return;

    setError(null);
    onBeforeStartVoice?.();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t.micUnsupported);
      return;
    }

    setPhase('connecting');

    try {
      // 1. Request microphone with echo cancellation & noise suppression for clean full-duplex voice
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: LIVE_INPUT_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Create separate 16kHz input and 24kHz output AudioContexts (per Live API rules)
      const AudioCtxCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      const inputCtx = new AudioCtxCtor({ sampleRate: LIVE_INPUT_SAMPLE_RATE });
      const outputCtx = new AudioCtxCtor({
        sampleRate: LIVE_OUTPUT_SAMPLE_RATE,
      });
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      const outputGain = outputCtx.createGain();
      outputGain.gain.value = isSpeakerMutedRef.current ? 0 : 1;
      outputGain.connect(outputCtx.destination);

      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      outputGainRef.current = outputGain;
      nextStartTimeRef.current = 0;

      // 3. Connect to server-side Gemini Live WebSocket bridge
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams({
        clientId: getClientId(),
        lang: language,
        voice: selectedVoice,
      });
      const wsUrl = `${protocol}//${window.location.host}/api/gemini/live?${params.toString()}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let receivedExplicitError = false;

      ws.onmessage = (event) => {
        let msg: {
          type?: string;
          data?: string;
          text?: string;
          message?: string;
          reason?: string;
          maxDurationSec?: number;
        };
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }

        switch (msg.type) {
          case 'ready': {
            isConnectedRef.current = true;
            setPhase('connected');
            const capSec =
              typeof msg.maxDurationSec === 'number' && msg.maxDurationSec > 0
                ? msg.maxDurationSec
                : DEFAULT_MAX_DURATION_SEC;
            setRemainingSec(capSec);

            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
            }
            countdownTimerRef.current = setInterval(() => {
              setRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);

            // Start streaming 16kHz PCM mic frames only after Live session is ready
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);

            // Route through silent gain so mic audio isn't echoed back to local speakers
            const silentSink = inputCtx.createGain();
            silentSink.gain.value = 0;

            source.connect(processor);
            processor.connect(silentSink);
            silentSink.connect(inputCtx.destination);

            sourceNodeRef.current = source;
            processorNodeRef.current = processor;

            processor.onaudioprocess = (audioEvent) => {
              if (!isConnectedRef.current || isMicMutedRef.current) {
                if (isMicMutedRef.current) setInputLevel(0);
                return;
              }
              const activeWs = wsRef.current;
              if (!activeWs || activeWs.readyState !== WebSocket.OPEN) return;

              const channelData = audioEvent.inputBuffer.getChannelData(0);
              const nowMs = performance.now();
              if (nowMs - lastMeterUpdateRef.current > 60) {
                lastMeterUpdateRef.current = nowMs;
                setInputLevel(computeRmsLevel(channelData));
              }

              const base64Pcm = float32ToBase64Pcm16(
                channelData,
                inputCtx.sampleRate,
              );
              activeWs.send(JSON.stringify({ type: 'audio', data: base64Pcm }));
            };
            break;
          }
          case 'audio':
            if (msg.data) {
              scheduleAudioChunk(msg.data);
            }
            break;
          case 'inputTranscript':
            if (msg.text) {
              appendTranscriptChunk('user', msg.text);
            }
            break;
          case 'outputTranscript':
            if (msg.text) {
              appendTranscriptChunk('model', msg.text);
            }
            break;
          case 'interrupted':
            stopAllPlayback();
            currentModelTurnIdRef.current = null;
            break;
          case 'turnComplete':
            currentUserTurnIdRef.current = null;
            currentModelTurnIdRef.current = null;
            break;
          case 'error':
            receivedExplicitError = true;
            setError(msg.message || t.connectionError);
            cleanupSession(true);
            break;
          case 'closed':
            if (!isConnectedRef.current && msg.reason && !receivedExplicitError) {
              receivedExplicitError = true;
              setError(msg.reason);
            }
            cleanupSession(true);
            break;
          default:
            break;
        }
      };

      ws.onerror = () => {
        if (!receivedExplicitError) {
          receivedExplicitError = true;
          setError(t.connectionError);
        }
        cleanupSession(true);
      };

      ws.onclose = (closeEvent) => {
        if (wsRef.current === ws) {
          if (!receivedExplicitError && !isConnectedRef.current && closeEvent.code !== 1000) {
            setError(closeEvent.reason || t.connectionError);
          }
          cleanupSession(true);
        }
      };
    } catch (err) {
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setError(t.micDenied);
      } else if (errName === 'NotFoundError') {
        setError(t.micNotFound);
      } else {
        setError(err instanceof Error ? err.message : t.connectionError);
      }
      cleanupSession(true);
    }
  };

  const handleEndConversation = () => {
    cleanupSession(false);
  };

  const handleToggleMicMute = () => {
    setIsMicMuted((prev) => {
      const next = !prev;
      isMicMutedRef.current = next;
      if (next) setInputLevel(0);
      return next;
    });
  };

  const handleToggleSpeakerMute = () => {
    setIsSpeakerMuted((prev) => {
      const next = !prev;
      isSpeakerMutedRef.current = next;
      return next;
    });
  };

  const handleClearTranscripts = () => {
    setTranscripts([]);
    currentUserTurnIdRef.current = null;
    currentModelTurnIdRef.current = null;
  };

  const activeAmplitude =
    phase === 'connected'
      ? isModelSpeaking
        ? Math.max(0.25, outputLevel)
        : isMicMuted
          ? 0.05
          : Math.max(0.12, inputLevel)
      : 0;

  const orbScale = 1 + activeAmplitude * 0.22;

  const statusText =
    phase === 'connecting'
      ? t.statusConnecting
      : phase === 'connected'
        ? isModelSpeaking
          ? t.statusSpeaking
          : isMicMuted
            ? t.statusMuted
            : t.statusListening
        : t.statusIdle;

  return (
    <section
      aria-label={t.panelLabel}
      className="flex-1 flex flex-col glass-panel rounded-2xl overflow-hidden min-h-[460px] max-h-[calc(100dvh-235px)]"
    >
      {/* Top Bar: Free-tier badge + session timer / clear transcript */}
      <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.03] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {t.panelLabel}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">{t.freeTierNote}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {phase === 'connected' && (
            <div
              id="live-voice-countdown"
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 text-[11px] font-mono font-semibold flex items-center gap-1"
              title={t.sessionCapHint}
            >
              <Clock className="w-3 h-3" />
              <span>{formatCountdown(remainingSec)}</span>
            </div>
          )}

          {transcripts.length > 0 && (
            <button
              id="live-voice-clear-btn"
              type="button"
              onClick={handleClearTranscripts}
              className="min-h-[32px] px-2.5 py-1 rounded-lg glass-surface hover:bg-white/[0.1] text-xs font-medium text-neutral-200 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.clearTranscript}</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Voice Orb & Controls */}
      <div className="px-4 py-5 flex flex-col items-center border-b border-white/10 bg-gradient-to-b from-amber-500/[0.04] to-transparent shrink-0">
        {/* Reactive Audio Orb */}
        <div className="relative w-28 h-28 flex items-center justify-center mb-3.5">
          {/* Outer reactive aura */}
          <div
            className={`absolute inset-0 rounded-full transition-all duration-150 ${
              phase === 'connected'
                ? isModelSpeaking
                  ? 'bg-amber-400/25 blur-xl'
                  : isMicMuted
                    ? 'bg-neutral-500/15 blur-lg'
                    : 'bg-emerald-400/20 blur-xl'
                : phase === 'connecting'
                  ? 'bg-amber-400/20 blur-xl animate-pulse'
                  : 'bg-amber-500/10 blur-lg'
            }`}
            style={{
              transform: `scale(${orbScale})`,
            }}
          />

          {/* Secondary pulse ring */}
          {phase === 'connected' && (
            <div
              className={`absolute inset-2 rounded-full border transition-transform duration-100 ${
                isModelSpeaking
                  ? 'border-amber-400/50'
                  : isMicMuted
                    ? 'border-white/10'
                    : 'border-emerald-400/45'
              }`}
              style={{
                transform: `scale(${1 + activeAmplitude * 0.16})`,
              }}
            />
          )}

          {/* Core glass sphere */}
          <button
            id="live-voice-orb-btn"
            type="button"
            onClick={() => {
              if (phase === 'idle') {
                void handleStartConversation();
              } else if (phase === 'connected') {
                handleToggleMicMute();
              }
            }}
            disabled={phase === 'connecting'}
            aria-label={
              phase === 'idle'
                ? t.startCall
                : isMicMuted
                  ? t.unmuteMic
                  : t.muteMic
            }
            className={`relative w-20 h-20 rounded-full flex items-center justify-center border transition-all duration-200 active:scale-95 ${
              phase === 'connected'
                ? isModelSpeaking
                  ? 'bg-gradient-to-br from-amber-400/35 to-amber-600/30 border-amber-300/60 text-amber-200 shadow-[0_0_28px_rgba(245,158,11,0.35),inset_0_1px_1px_rgba(255,255,255,0.45)]'
                  : isMicMuted
                    ? 'bg-white/[0.06] border-white/20 text-neutral-400'
                    : 'bg-gradient-to-br from-emerald-500/30 to-teal-600/25 border-emerald-400/55 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.28),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                : phase === 'connecting'
                  ? 'bg-amber-500/20 border-amber-400/45 text-amber-200 animate-pulse cursor-wait'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/40 text-amber-300 shadow-[0_8px_24px_rgba(245,158,11,0.18),inset_0_1px_0_rgba(255,255,255,0.3)]'
            }`}
          >
            {phase === 'connected' && isMicMuted ? (
              <MicOff className="w-7 h-7" />
            ) : (
              <Mic className="w-7 h-7" />
            )}
          </button>
        </div>

        {/* Status & Mini Audio Bars */}
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <span>{statusText}</span>
        </div>
        <p className="text-xs text-neutral-300/80 text-center max-w-sm mt-1">
          {phase === 'connected' ? t.bargeInHint : t.idleHint}
        </p>

        {/* Live Reactive Waveform Bars (visible while connected) */}
        {phase === 'connected' && (
          <div
            className="flex items-center justify-center gap-1 h-5 mt-2.5"
            aria-hidden="true"
          >
            {[0.45, 0.8, 1, 0.7, 0.95, 0.6, 0.4].map((weight, idx) => {
              const barHeight = Math.max(
                4,
                Math.min(20, Math.round(4 + activeAmplitude * 18 * weight)),
              );
              return (
                <span
                  key={idx}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    isModelSpeaking
                      ? 'bg-amber-400'
                      : isMicMuted
                        ? 'bg-neutral-500/50'
                        : 'bg-emerald-400'
                  }`}
                  style={{ height: `${barHeight}px` }}
                />
              );
            })}
          </div>
        )}

        {/* Voice Selector (editable when idle) */}
        <div className="w-full max-w-md mt-4">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[11px] font-medium text-neutral-400">
              {t.voiceLabel}
            </span>
            <span className="text-[11px] text-amber-300/90 font-medium">
              {selectedVoice}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {VOICE_OPTIONS.map((v) => {
              const isSelected = selectedVoice === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={phase !== 'idle'}
                  onClick={() => setSelectedVoice(v.id)}
                  className={`py-1.5 px-1 rounded-xl border text-center transition-all ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400/55 text-amber-200 shadow-[0_2px_10px_rgba(245,158,11,0.16)]'
                      : 'glass-surface text-neutral-300 hover:bg-white/[0.08]'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <div className="text-[11px] font-semibold leading-tight truncate">
                    {v.label}
                  </div>
                  <div className="text-[10px] text-neutral-400 leading-tight truncate mt-0.5">
                    {language === 'hi' ? v.toneHi : v.toneEn}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls Row */}
        <div className="mt-4 flex items-center justify-center gap-2.5 w-full max-w-md">
          {phase === 'idle' ? (
            <button
              id="live-voice-start-btn"
              type="button"
              onClick={() => void handleStartConversation()}
              className="flex-1 min-h-[44px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-[0_6px_18px_rgba(245,158,11,0.3),inset_0_1px_0_rgba(255,255,255,0.4)]"
            >
              <PhoneCall className="w-4 h-4" />
              <span>{t.startCall}</span>
            </button>
          ) : (
            <>
              <button
                id="live-voice-mute-btn"
                type="button"
                disabled={phase === 'connecting'}
                onClick={handleToggleMicMute}
                className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 ${
                  isMicMuted
                    ? 'bg-amber-500/20 border-amber-400/45 text-amber-200'
                    : 'glass-surface text-neutral-100 hover:bg-white/[0.1]'
                }`}
              >
                {isMicMuted ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                <span>{isMicMuted ? t.unmuteMic : t.muteMic}</span>
              </button>

              <button
                id="live-voice-end-btn"
                type="button"
                onClick={handleEndConversation}
                className="flex-1 min-h-[44px] px-4 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-[0_6px_18px_rgba(225,29,72,0.3)]"
              >
                <PhoneOff className="w-4 h-4" />
                <span>{t.endCall}</span>
              </button>

              <button
                id="live-voice-speaker-btn"
                type="button"
                disabled={phase === 'connecting'}
                onClick={handleToggleSpeakerMute}
                aria-label={isSpeakerMuted ? t.unmuteSpeaker : t.muteSpeaker}
                className={`min-h-[44px] min-w-[44px] px-3 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all disabled:opacity-50 ${
                  isSpeakerMuted
                    ? 'bg-rose-500/20 border-rose-400/45 text-rose-200'
                    : 'glass-surface text-neutral-100 hover:bg-white/[0.1]'
                }`}
              >
                {isSpeakerMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl bg-rose-950/60 backdrop-blur-md border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2 select-text shrink-0"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Live Transcript Feed */}
      <div
        id="live-voice-transcript"
        className="flex-1 overflow-y-auto p-4 space-y-3 select-text min-h-[120px]"
      >
        {transcripts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-3 py-3">
            <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
              {t.transcriptEmpty}
            </p>
          </div>
        ) : (
          transcripts.map((item) => {
            const isUser = item.role === 'user';
            return (
              <div
                key={item.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isUser
                      ? 'bg-amber-500/90 text-neutral-950 font-medium'
                      : 'glass-surface text-neutral-100'
                  }`}
                >
                  {item.text}
                </div>
                <span className="mt-1 px-1 text-[10px] text-neutral-400">
                  {isUser ? (language === 'hi' ? 'आप' : 'You') : t.geminiLabel}
                </span>
              </div>
            );
          })
        )}
        <div ref={transcriptEndRef} />
      </div>
    </section>
  );
};
