import React, { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw, Square, AlertCircle, MessageSquare } from 'lucide-react';
import { ChatMessage, Language } from '../types';
import { translations } from '../utils/translations';
import { clearChatHistoryApi, getClientId } from '../services/api';

interface GeminiChatPanelProps {
  language: Language;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const GeminiChatPanel: React.FC<GeminiChatPanelProps> = ({
  language,
  messages,
  setMessages,
}) => {
  const t = translations[language].studio.chat;
  const [input, setInput] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleStopStream = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  };

  const handleClearChat = () => {
    handleStopStream();
    setMessages([]);
    setError(null);
    void clearChatHistoryApi().catch(() => {
      // ignore network error; local state already cleared
    });
  };

  const sendMessage = async (textToSend?: string) => {
    const trimmed = (textToSend ?? input).trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    if (!textToSend) setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };

    const assistantId = `model-${Date.now() + 1}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'model',
      text: '',
      timestamp: Date.now(),
    };

    const historyPayload = messages
      .filter((m) => m.text.trim().length > 0)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': getClientId(),
        },
        body: JSON.stringify({
          systemInstruction: t.defaultInstruction,
          history: historyPayload,
          message: trimmed,
          userMessageId: userMsg.id,
          assistantMessageId: assistantId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errMessage = `Request failed (${response.status})`;
        try {
          const errData = (await response.json()) as { error?: string };
          if (errData.error) errMessage = errData.error;
        } catch {
          // ignore json parse failure
        }
        throw new Error(errMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming response unavailable.');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const jsonText = line.slice(5).trim();
          if (!jsonText) continue;

          try {
            const parsed = JSON.parse(jsonText) as {
              text?: string;
              error?: string;
              done?: boolean;
            };
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, text: m.text + parsed.text } : m,
                ),
              );
            }
          } catch (parseErr) {
            if (
              parseErr instanceof Error &&
              parseErr.message !== 'Unexpected end of JSON input'
            ) {
              throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Unable to reach Gemini API.';
      setError(message);
      setMessages((prev) =>
        prev.filter((m) => !(m.id === assistantId && m.text.trim() === '')),
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  return (
    <section
      aria-label={t.assistantLabel}
      className="flex-1 flex flex-col glass-panel rounded-2xl overflow-hidden min-h-[460px] max-h-[calc(100dvh-210px)]"
    >
      {/* Active conversation slim top bar with New Chat button */}
      {messages.length > 0 && (
        <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.03] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-white truncate">
              {t.assistantLabel}
            </span>
          </div>

          <button
            id="gemini-chat-clear-btn"
            type="button"
            onClick={handleClearChat}
            className="min-h-[34px] px-3 py-1.5 rounded-xl glass-surface hover:bg-white/[0.1] text-xs font-medium text-neutral-200 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.clearChat}</span>
          </button>
        </div>
      )}

      {/* Scrollable Thread */}
      <div
        id="gemini-chat-thread"
        className="flex-1 overflow-y-auto p-4 space-y-4 select-text"
      >
        {messages.length === 0 ? (
          <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center px-3 py-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/35 shadow-[0_6px_22px_rgba(245,158,11,0.18),inset_0_1px_0_rgba(255,255,255,0.25)] flex items-center justify-center text-amber-300 mb-3.5">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white">
              {t.emptyTitle}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-300/80 max-w-md mt-1.5 leading-relaxed">
              {t.emptySubtitle}
            </p>

            <div className="mt-5 w-full max-w-md space-y-2.5">
              {t.starters.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void sendMessage(starter)}
                  className="w-full text-left px-4 py-3 rounded-xl glass-surface hover:bg-white/[0.1] hover:border-amber-400/35 text-xs sm:text-sm text-neutral-100 transition-all active:scale-[0.99]"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isUser
                      ? 'bg-amber-500/95 text-neutral-950 font-medium shadow-[0_4px_16px_rgba(245,158,11,0.28),inset_0_1px_0_rgba(255,255,255,0.4)]'
                      : 'glass-surface text-neutral-100'
                  }`}
                >
                  {msg.text || (isStreaming ? t.sending : '')}
                </div>
                <div className="mt-1 px-1 text-[11px] text-neutral-400">
                  {isUser ? (language === 'hi' ? 'आप' : 'You') : t.assistantLabel}
                </div>
              </div>
            );
          })
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div
          role="alert"
          className="mx-4 mb-3 px-3.5 py-2.5 rounded-xl bg-rose-950/60 backdrop-blur-md border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2 select-text"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-white/10 bg-black/25 backdrop-blur-md flex items-end gap-2"
      >
        <textarea
          id="gemini-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          rows={1}
          placeholder={t.inputPlaceholder}
          className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl glass-input px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-400 focus:outline-none focus:border-amber-400/60 select-text"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={handleStopStream}
            className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-[0_4px_14px_rgba(225,29,72,0.3)]"
            aria-label="Stop response"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            id="gemini-chat-send-btn"
            type="submit"
            disabled={!input.trim()}
            className="min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0 shadow-[0_4px_14px_rgba(245,158,11,0.3),inset_0_1px_0_rgba(255,255,255,0.4)]"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">{t.send}</span>
          </button>
        )}
      </form>
    </section>
  );
};
