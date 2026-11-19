import type { Language } from '../types';

export type VoiceCommand =
  | { type: 'torch-on' }
  | { type: 'torch-off' }
  | { type: 'sos-start' }
  | { type: 'sos-stop' }
  | { type: 'strobe-start' }
  | { type: 'strobe-stop' }
  | { type: 'screen-mode' }
  | { type: 'scanner-mode' }
  | { type: 'brightness-set'; level: number }
  | { type: 'all-off' };

export type VoiceErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'no-microphone'
  | 'network'
  | 'unknown';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEventLike) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/**
 * Parses natural spoken English, Hindi (Devanagari), or Hinglish transcripts
 * into deterministic flashlight control commands.
 */
export function parseVoiceCommand(rawTranscript: string): VoiceCommand | null {
  const text = rawTranscript.trim().toLowerCase().replace(/[.,!?।]/g, ' ').replace(/\s+/g, ' ');
  if (!text) return null;

  // 1. Stop / Turn off ALL lights
  if (
    /\b(all off|turn off everything|everything off|lights off|shut down|sab band)\b/.test(text) ||
    /(सब बंद|सभी बंद|सारी लाइट बंद)/.test(text)
  ) {
    return { type: 'all-off' };
  }

  // 2. SOS stop (checked before SOS start so "stop sos" never triggers start)
  if (
    (/\b(sos|emergency|distress)\b/.test(text) &&
      /\b(stop|off|cancel|end|disable|band|rok)\b/.test(text)) ||
    (/(एसओएस|इमरजेंसी|आपातकालीन)/.test(text) && /(बंद|रोक|रोको|खत्म)/.test(text))
  ) {
    return { type: 'sos-stop' };
  }

  // 3. SOS start
  if (
    /\b(start sos|sos mode|sos on|enable sos|turn on sos|emergency mode|emergency light|help signal|sos chalu|sos shuru)\b/.test(
      text,
    ) ||
    text === 'sos' ||
    /(एसओएस चालू|एसओएस शुरू|इमरजेंसी मोड|आपातकालीन मोड|एसओएस मोड)/.test(text)
  ) {
    return { type: 'sos-start' };
  }

  // 4. Strobe stop
  if (
    (/\b(strobe|flash|blinking|disco)\b/.test(text) &&
      /\b(stop|off|cancel|end|disable|band|rok)\b/.test(text)) ||
    (/(स्ट्रोब)/.test(text) && /(बंद|रोक|रोको)/.test(text))
  ) {
    return { type: 'strobe-stop' };
  }

  // 5. Strobe start
  if (
    /\b(start strobe|strobe mode|strobe on|enable strobe|turn on strobe|strobe light|strobe chalu|strobe shuru)\b/.test(
      text,
    ) ||
    /(स्ट्रोब चालू|स्ट्रोब शुरू|स्ट्रोब लाइट|स्ट्रोब मोड)/.test(text)
  ) {
    return { type: 'strobe-start' };
  }

  // 6. Brightness / Intensity commands (percentage or named levels)
  const percentMatch = text.match(/\b(\d{1,3})\s*(%|percent|प्रतिशत)?\b/);
  if (
    percentMatch &&
    (/\b(bright|brightness|intensity|dim|level|light|torch|power)\b/.test(text) ||
      /(चमक|ब्राइटनेस|रोशनी|तीव्रता)/.test(text))
  ) {
    const pct = Math.min(100, Math.max(10, Number(percentMatch[1])));
    return { type: 'brightness-set', level: Number((pct / 100).toFixed(2)) };
  }

  if (
    /\b(max brightness|full brightness|maximum brightness|brightest|outdoor mode|outdoor preset|full light)\b/.test(
      text,
    ) ||
    /(पूरी रोशनी|अधिकतम चमक|फुल ब्राइटनेस|आउटडोर)/.test(text)
  ) {
    return { type: 'brightness-set', level: 1.0 };
  }

  if (
    /\b(half brightness|medium brightness|reading mode|reading light|reading preset)\b/.test(
      text,
    ) ||
    /(मध्यम रोशनी|आधी चमक|पढ़ाई मोड|रीडिंग)/.test(text)
  ) {
    return { type: 'brightness-set', level: 0.45 };
  }

  if (
    /\b(dim light|dim torch|low brightness|soft light|soft mode|soft preset|minimum brightness)\b/.test(
      text,
    ) ||
    /(कम रोशनी|धीमी रोशनी|सौम्य|कम चमक)/.test(text)
  ) {
    return { type: 'brightness-set', level: 0.2 };
  }

  // 7. Scanner mode
  if (
    /\b(scanner|qr code|barcode|scan mode|open scanner)\b/.test(text) ||
    /(स्कैनर|क्यूआर|बारकोड)/.test(text)
  ) {
    return { type: 'scanner-mode' };
  }

  // 8. Screen light mode
  if (
    /\b(screen light|screen mode|screen torch|night lamp|color light)\b/.test(text) ||
    /(स्क्रीन लाइट|स्क्रीन मोड|नाइट लैंप)/.test(text)
  ) {
    return { type: 'screen-mode' };
  }

  // 9. Torch OFF
  if (
    (/\b(torch|flashlight|flash|light|lamp)\b/.test(text) &&
      /\b(off|stop|close|disable|shut|band)\b/.test(text)) ||
    /\b(turn off|switch off|band karo)\b/.test(text) ||
    /(टॉर्च बंद|फ्लैशलाइट बंद|लाइट बंद|बंद करो)/.test(text)
  ) {
    return { type: 'torch-off' };
  }

  // 10. Torch ON
  if (
    (/\b(torch|flashlight|flash|light|lamp)\b/.test(text) &&
      /\b(on|start|open|enable|chalu|jalao|on karo)\b/.test(text)) ||
    /\b(turn on|switch on|chalu karo)\b/.test(text) ||
    /(टॉर्च चालू|फ्लैशलाइट चालू|लाइट चालू|लाइट जलाओ|टॉर्च ऑन|चालू करो)/.test(text)
  ) {
    return { type: 'torch-on' };
  }

  return null;
}

export interface VoiceListenerOptions {
  language: Language;
  onListeningChange: (listening: boolean) => void;
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onCommand: (command: VoiceCommand, rawTranscript: string) => void;
  onError: (code: VoiceErrorCode) => void;
}

/**
 * Starts a continuous hands-free Web Speech API recognition session.
 * Automatically recovers from browser silence timeouts until stopped by the caller.
 */
export function startVoiceCommandListener({
  language,
  onListeningChange,
  onTranscript,
  onCommand,
  onError,
}: VoiceListenerOptions): () => void {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    onError('unsupported');
    return () => {};
  }

  let recognition: SpeechRecognitionInstance | null = null;
  let shouldKeepListening = true;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let lastCommandKey = '';
  let lastCommandAt = 0;

  const startInstance = () => {
    if (!shouldKeepListening) return;
    try {
      recognition = new Ctor();
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 2;

      recognition.onstart = () => {
        if (shouldKeepListening) {
          onListeningChange(true);
        }
      };

      recognition.onresult = (event) => {
        if (!shouldKeepListening) return;

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const primary = result[0]?.transcript?.trim() || '';
          if (primary) {
            onTranscript(primary, result.isFinal);
          }

          // Inspect all alternatives for a matching voice command
          for (let altIdx = 0; altIdx < result.length; altIdx += 1) {
            const altTranscript = result[altIdx]?.transcript?.trim() || '';
            const parsed = parseVoiceCommand(altTranscript);
            if (parsed) {
              const now = Date.now();
              const key = JSON.stringify(parsed);
              // Deduplicate interim + final recognition of the same spoken phrase
              if (key !== lastCommandKey || now - lastCommandAt > 1100) {
                lastCommandKey = key;
                lastCommandAt = now;
                onCommand(parsed, altTranscript);
              }
              break;
            }
          }
        }
      };

      recognition.onerror = (event) => {
        const code = event.error;
        if (code === 'no-speech' || code === 'aborted') {
          return;
        }
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          shouldKeepListening = false;
          onListeningChange(false);
          onError('permission-denied');
          return;
        }
        if (code === 'audio-capture') {
          shouldKeepListening = false;
          onListeningChange(false);
          onError('no-microphone');
          return;
        }
        if (code === 'network') {
          shouldKeepListening = false;
          onListeningChange(false);
          onError('network');
          return;
        }
        shouldKeepListening = false;
        onListeningChange(false);
        onError('unknown');
      };

      recognition.onend = () => {
        if (!shouldKeepListening) {
          onListeningChange(false);
          return;
        }
        // Automatically keep hands-free session alive after silence timeout
        restartTimer = setTimeout(() => {
          if (shouldKeepListening) {
            startInstance();
          }
        }, 260);
      };

      recognition.start();
    } catch {
      shouldKeepListening = false;
      onListeningChange(false);
      onError('unknown');
    }
  };

  startInstance();

  return () => {
    shouldKeepListening = false;
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    if (recognition) {
      try {
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.stop();
      } catch {
        // ignore stop errors
      }
      recognition = null;
    }
    onListeningChange(false);
  };
}
