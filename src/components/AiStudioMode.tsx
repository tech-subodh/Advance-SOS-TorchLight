import React, { useState } from 'react';
import { MessageSquare, AudioLines } from 'lucide-react';
import { ChatMessage, Language } from '../types';
import { translations } from '../utils/translations';
import { GeminiChatPanel } from './GeminiChatPanel';
import { GeminiLiveVoicePanel } from './GeminiLiveVoicePanel';

interface AiStudioModeProps {
  language: Language;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onBeforeStartVoice?: () => void;
}

type AssistantTab = 'chat' | 'voice';

export const AiStudioMode: React.FC<AiStudioModeProps> = ({
  language,
  messages,
  setMessages,
  onBeforeStartVoice,
}) => {
  const t = translations[language].studio;
  const [activeTab, setActiveTab] = useState<AssistantTab>('chat');

  return (
    <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col px-4 py-4 gap-3.5">
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {t.title}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300/80 mt-1">
            {t.subtitle}
          </p>
        </div>

        {/* Mode Switcher: Text Chat vs Real-Time Live Voice */}
        <div
          role="tablist"
          aria-label={t.title}
          className="inline-grid grid-cols-2 p-1 rounded-xl glass-surface shrink-0 self-start sm:self-auto"
        >
          <button
            id="assistant-tab-chat"
            role="tab"
            type="button"
            aria-selected={activeTab === 'chat'}
            onClick={() => setActiveTab('chat')}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'chat'
                ? 'bg-amber-500 text-neutral-950 shadow-[0_2px_12px_rgba(245,158,11,0.3)]'
                : 'text-neutral-300 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t.tabs.chat}</span>
          </button>

          <button
            id="assistant-tab-voice"
            role="tab"
            type="button"
            aria-selected={activeTab === 'voice'}
            onClick={() => setActiveTab('voice')}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'voice'
                ? 'bg-amber-500 text-neutral-950 shadow-[0_2px_12px_rgba(245,158,11,0.3)]'
                : 'text-neutral-300 hover:text-white'
            }`}
          >
            <AudioLines className="w-3.5 h-3.5" />
            <span>{t.tabs.liveVoice}</span>
          </button>
        </div>
      </div>

      {activeTab === 'chat' ? (
        <GeminiChatPanel
          language={language}
          messages={messages}
          setMessages={setMessages}
        />
      ) : (
        <GeminiLiveVoicePanel
          language={language}
          onBeforeStartVoice={onBeforeStartVoice}
        />
      )}
    </div>
  );
};
