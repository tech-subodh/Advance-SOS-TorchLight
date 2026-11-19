import React from 'react';
import { ChatMessage, Language } from '../types';
import { translations } from '../utils/translations';
import { GeminiChatPanel } from './GeminiChatPanel';

interface AiStudioModeProps {
  language: Language;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const AiStudioMode: React.FC<AiStudioModeProps> = ({
  language,
  messages,
  setMessages,
}) => {
  const t = translations[language].studio;

  return (
    <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col px-4 py-4 gap-3.5">
      <div className="shrink-0">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          {t.title}
        </h2>
        <p className="text-xs sm:text-sm text-neutral-300/80 mt-1">
          {t.subtitle}
        </p>
      </div>

      <GeminiChatPanel
        language={language}
        messages={messages}
        setMessages={setMessages}
      />
    </div>
  );
};
