import 'dotenv/config';
import express, { type Request } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, type Content, type GenerateContentResponse } from '@google/genai';
import type {
  AppPreferences,
  ChatMessage,
  ScannerConfig,
  SosSettings,
} from './src/types.ts';
import {
  calculateCycleDurationMs,
  encodeMessageToSosSteps,
} from './src/utils/sosPatterns.ts';
import { parseVoiceCommand } from './src/utils/voiceControl.ts';
import { sanitizeClientId, torchStore } from './server/store.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePort(): number {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--port' && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) return parsed;
    } else if (arg.startsWith('--port=')) {
      const parsed = Number(arg.slice('--port='.length));
      if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) return parsed;
    }
  }
  const envDefault = Number(process.env.DEFAULT_APP_PORT);
  if (Number.isInteger(envDefault) && envDefault > 0 && envDefault < 65536) {
    return envDefault;
  }
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  if (
    Number.isInteger(envPort) &&
    envPort > 0 &&
    envPort < 65536 &&
    envPort !== nginxPort
  ) {
    return envPort;
  }
  return 3000;
}

const PORT = resolvePort();
const IS_PROD = process.env.NODE_ENV === 'production';

const FREE_CHAT_MODEL = 'gemini-3.1-flash-lite';

function getClientId(req: Request): string {
  const fromHeader = req.header('x-client-id');
  const fromQuery = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
  return sanitizeClientId(fromHeader ?? fromQuery);
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'GEMINI_API_KEY is not configured. Please add your API key in Settings > Secrets.',
    ) as Error & { status?: number };
    err.status = 500;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isRetryableError(err: unknown): boolean {
  const status =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 0;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('DEADLINE_EXCEEDED')
  );
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const statusFromErr =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 500;

  if (rawMessage.includes('GEMINI_API_KEY is not configured')) {
    return { status: 500, message: rawMessage };
  }
  if (
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('API_KEY_INVALID') ||
    statusFromErr === 403
  ) {
    return {
      status: statusFromErr === 403 ? 403 : 400,
      message:
        'API key permission denied or invalid. Please check or select your Gemini API key in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('RESOURCE_EXHAUSTED') || statusFromErr === 429) {
    return {
      status: 429,
      message:
        'Free tier rate limit reached. Please wait a moment and try again, or check your Gemini API key in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('NOT_FOUND') || statusFromErr === 404) {
    return {
      status: 404,
      message: 'Requested assistant model is currently unavailable.',
    };
  }
  return {
    status: statusFromErr >= 400 && statusFromErr < 600 ? statusFromErr : 500,
    message: rawMessage || 'Unexpected Gemini API error.',
  };
}

interface IncomingChatTurn {
  role: 'user' | 'model';
  text: string;
}

async function startServer() {
  try {
    await torchStore.isReady();
  } catch (err) {
    console.warn('Storage initialization warning (using in-memory fallback):', err);
  }

  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Health & diagnostics
  app.get('/api/health', async (_req, res) => {
    const storageReady = await torchStore.isReady();
    res.json({
      ok: true,
      storageReady,
      assistantModel: FREE_CHAT_MODEL,
    });
  });

  // Homescreen Widget Adaptive Card Template & Live Data (PWA Widgets API)
  app.get('/widget/torch-template.json', (_req, res) => {
    res.json({
      type: 'AdaptiveCard',
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.5',
      body: [
        {
          type: 'TextBlock',
          text: '${title}',
          weight: 'Bolder',
          size: 'Medium',
        },
        {
          type: 'TextBlock',
          text: '${subtitle}',
          isSubtle: true,
          spacing: 'None',
        },
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: '${toggleLabel}',
          url: '${instantTorchUrl}',
        },
        {
          type: 'Action.OpenUrl',
          title: 'Emergency SOS',
          url: '${sosUrl}',
        },
      ],
    });
  });

  app.get('/widget/torch-data.json', async (req, res) => {
    try {
      const prefs = await torchStore.getPreferences(getClientId(req));
      const pct = Math.round(prefs.torchIntensity * 100);
      res.json({
        title: 'Torch Light',
        subtitle: `Quick Shortcut · ${pct}% LED`,
        toggleLabel: 'Instant Torch ON',
        layout: prefs.widgetLayout,
        autoStart: prefs.widgetAutoStart,
        intensityPercent: pct,
        instantTorchUrl: '/?widget=torch&autostart=1',
        widgetUrl: '/?widget=torch',
        sosUrl: '/?mode=sos&autostart=1',
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load widget data.',
      });
    }
  });

  // Single-roundtrip hydration for all UI features on initial load
  app.get('/api/bootstrap', async (req, res) => {
    try {
      const clientId = getClientId(req);
      const data = await torchStore.getBootstrap(clientId);
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load application state.',
      });
    }
  });

  // 1. User Preferences (Torch, Strobe, Screen Light, Night Mode, Audio/Haptics, Shake, Proximity)
  app.get('/api/settings', async (req, res) => {
    try {
      const preferences = await torchStore.getPreferences(getClientId(req));
      res.json({ preferences });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to read settings.',
      });
    }
  });

  app.patch('/api/settings', async (req, res) => {
    try {
      const patch = req.body as Partial<AppPreferences>;
      const preferences = await torchStore.patchPreferences(getClientId(req), patch);
      res.json({ preferences });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to update settings.',
      });
    }
  });

  // 2. Named Torch Lighting Presets CRUD
  app.get('/api/presets', async (req, res) => {
    try {
      const presets = await torchStore.getLightingPresets(getClientId(req));
      res.json({ presets });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load lighting presets.',
      });
    }
  });

  app.post('/api/presets', async (req, res) => {
    try {
      const { name, intensity } = req.body as { name?: unknown; intensity?: unknown };
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Preset name is required.' });
        return;
      }
      if (typeof intensity !== 'number' || !Number.isFinite(intensity)) {
        res.status(400).json({ error: 'Valid numeric brightness intensity is required.' });
        return;
      }
      const result = await torchStore.upsertLightingPreset(
        getClientId(req),
        name,
        intensity,
      );
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to save lighting preset.',
      });
    }
  });

  app.delete('/api/presets/:id', async (req, res) => {
    try {
      const presetId = req.params.id;
      if (!presetId) {
        res.status(400).json({ error: 'Preset ID is required.' });
        return;
      }
      const presets = await torchStore.deleteLightingPreset(getClientId(req), presetId);
      res.json({ presets });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to delete lighting preset.',
      });
    }
  });

  // 3. Emergency SOS Settings, Custom Sequences & International Morse Encoder
  app.get('/api/sos/settings', async (req, res) => {
    try {
      const sosSettings = await torchStore.getSosSettings(getClientId(req));
      res.json({
        sosSettings,
        cycleDurationMs: calculateCycleDurationMs(sosSettings),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load SOS settings.',
      });
    }
  });

  app.put('/api/sos/settings', async (req, res) => {
    try {
      const candidate = req.body as Partial<SosSettings>;
      const sosSettings = await torchStore.setSosSettings(getClientId(req), candidate);
      res.json({
        sosSettings,
        cycleDurationMs: calculateCycleDurationMs(sosSettings),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to save SOS settings.',
      });
    }
  });

  app.delete('/api/sos/settings', async (req, res) => {
    try {
      const sosSettings = await torchStore.resetSosSettings(getClientId(req));
      res.json({
        sosSettings,
        cycleDurationMs: calculateCycleDurationMs(sosSettings),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to reset SOS settings.',
      });
    }
  });

  app.post('/api/sos/encode', async (req, res) => {
    try {
      const { text } = req.body as { text?: unknown };
      if (typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Message text is required for Morse encoding.' });
        return;
      }
      const encoded = encodeMessageToSosSteps(text);
      if (encoded.steps.length === 0) {
        res.status(400).json({
          error: 'Message must include at least one supported Morse character (A-Z, 0-9).',
        });
        return;
      }
      const currentSettings = await torchStore.getSosSettings(getClientId(req));
      const estimatedCycleMs = calculateCycleDurationMs({
        ...currentSettings,
        steps: encoded.steps,
      });
      res.json({
        ...encoded,
        estimatedCycleMs,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to encode Morse message.',
      });
    }
  });

  // 4. Torch Usage History & Active Session Analytics
  app.get('/api/usage', async (req, res) => {
    try {
      const usageHistory = await torchStore.getUsageHistory(getClientId(req));
      res.json(usageHistory);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load usage history.',
      });
    }
  });

  app.post('/api/usage/sessions', async (req, res) => {
    try {
      const { startedAt, endedAt, durationMs, intensityPercent } = req.body as {
        startedAt?: number;
        endedAt?: number;
        durationMs?: number;
        intensityPercent?: number;
      };
      if (typeof durationMs !== 'number' && typeof startedAt !== 'number') {
        res.status(400).json({ error: 'Session timing data is required.' });
        return;
      }
      const now = Date.now();
      const result = await torchStore.recordUsageSession(getClientId(req), {
        startedAt: typeof startedAt === 'number' ? startedAt : now - (durationMs ?? 1000),
        endedAt: typeof endedAt === 'number' ? endedAt : now,
        durationMs: typeof durationMs === 'number' ? durationMs : Math.max(500, now - (startedAt ?? now)),
        intensityPercent: typeof intensityPercent === 'number' ? intensityPercent : 100,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to record usage session.',
      });
    }
  });

  app.delete('/api/usage', async (req, res) => {
    try {
      const usageHistory = await torchStore.resetUsageHistory(getClientId(req));
      res.json(usageHistory);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to reset usage history.',
      });
    }
  });

  // 5. Scanner Light (QR & Code 128 Barcode) Persistent Configuration
  app.get('/api/scanner', async (req, res) => {
    try {
      const scanner = await torchStore.getScannerConfig(getClientId(req));
      res.json({ scanner });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load scanner settings.',
      });
    }
  });

  app.put('/api/scanner', async (req, res) => {
    try {
      const patch = req.body as Partial<ScannerConfig>;
      const scanner = await torchStore.setScannerConfig(getClientId(req), patch);
      res.json({ scanner });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to save scanner settings.',
      });
    }
  });

  // 6. Voice Command Natural Language Parser (English, Hindi & Hinglish)
  app.post('/api/voice/parse', (req, res) => {
    const { transcript } = req.body as { transcript?: unknown };
    if (typeof transcript !== 'string' || !transcript.trim()) {
      res.status(400).json({ error: 'Transcript text is required.' });
      return;
    }
    const command = parseVoiceCommand(transcript);
    res.json({ command });
  });

  // 7. Persisted Gemini Assistant Chat History & SSE Streaming (Free-tier Flash Lite)
  app.get('/api/chat/history', async (req, res) => {
    try {
      const messages = await torchStore.getChatHistory(getClientId(req));
      res.json({ messages });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load chat history.',
      });
    }
  });

  app.delete('/api/chat/history', async (req, res) => {
    try {
      await torchStore.clearChatHistory(getClientId(req));
      res.json({ ok: true, messages: [] });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to clear chat history.',
      });
    }
  });

  app.post('/api/gemini/chat', async (req, res) => {
    const clientId = getClientId(req);
    try {
      const {
        systemInstruction = 'You are a helpful, calm emergency safety, lighting, and general assistant. Reply concisely in the user’s language.',
        history = [],
        message = '',
        userMessageId,
        assistantMessageId,
      } = req.body as {
        systemInstruction?: string;
        history?: IncomingChatTurn[];
        message?: string;
        userMessageId?: string;
        assistantMessageId?: string;
      };

      const trimmedMessage = typeof message === 'string' ? message.trim() : '';
      if (!trimmedMessage) {
        res.status(400).json({ error: 'Message cannot be empty.' });
        return;
      }

      const ai = getGeminiClient();

      const formattedHistory: Content[] = Array.isArray(history)
        ? history
            .filter(
              (item): item is IncomingChatTurn =>
                item !== null &&
                typeof item === 'object' &&
                (item.role === 'user' || item.role === 'model') &&
                typeof item.text === 'string' &&
                item.text.trim().length > 0,
            )
            .slice(-30)
            .map((item) => ({
              role: item.role,
              parts: [{ text: item.text }],
            }))
        : [];

      const resolvedInstruction =
        typeof systemInstruction === 'string' && systemInstruction.trim()
          ? systemInstruction.trim()
          : 'You are a helpful, calm emergency safety, lighting, and general assistant. Reply concisely in the user’s language.';

      let stream: AsyncGenerator<GenerateContentResponse> | null = null;
      let lastErr: unknown = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const chat = ai.chats.create({
            model: FREE_CHAT_MODEL,
            history: formattedHistory,
            config: {
              systemInstruction: resolvedInstruction,
            },
          });
          stream = await chat.sendMessageStream({ message: trimmedMessage });
          break;
        } catch (err) {
          lastErr = err;
          if (attempt === 0 && isRetryableError(err)) {
            await new Promise((resolve) => setTimeout(resolve, 600));
            continue;
          }
          throw err;
        }
      }

      if (!stream) {
        throw lastErr ?? new Error('Unable to open Gemini stream.');
      }

      const userTurn: ChatMessage = {
        id:
          typeof userMessageId === 'string' && userMessageId
            ? userMessageId
            : `user-${Date.now()}`,
        role: 'user',
        text: trimmedMessage,
        timestamp: Date.now(),
      };

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      let fullAssistantText = '';
      let clientAborted = false;
      req.on('close', () => {
        clientAborted = true;
      });

      for await (const chunk of stream) {
        if (clientAborted) break;
        const textChunk = chunk.text;
        if (textChunk) {
          fullAssistantText += textChunk;
          res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
        }
      }

      // Persist both user prompt and assistant response to server DB
      const messagesToPersist: ChatMessage[] = [userTurn];
      if (fullAssistantText.trim()) {
        messagesToPersist.push({
          id:
            typeof assistantMessageId === 'string' && assistantMessageId
              ? assistantMessageId
              : `model-${Date.now() + 1}`,
          role: 'model',
          text: fullAssistantText,
          timestamp: Date.now(),
        });
      }
      await torchStore.appendChatMessages(clientId, messagesToPersist);

      if (!clientAborted) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    } catch (err) {
      const formatted = formatGeminiError(err);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: formatted.message })}\n\n`);
        res.end();
      } else {
        res.status(formatted.status).json({ error: formatted.message });
      }
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    // Since HMR/WebSockets are disabled (ws: false), serve a clean no-WS @vite/client
    // module that keeps CSS injection (updateStyle/removeStyle) and HMR stubs working
    // without attempting a failing WebSocket connection in the browser.
    const NO_WS_VITE_CLIENT = `
const sheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
const cspNonce =
  "document" in globalThis
    ? document.querySelector("meta[property=csp-nonce]")?.nonce
    : void 0;
let lastInsertedStyle;

export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (cspNonce) {
      style.setAttribute("nonce", cspNonce);
    }
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => {
        lastInsertedStyle = void 0;
      }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}

export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}

export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}

export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") {
    return url;
  }
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}

export class ErrorOverlay extends HTMLElement {}
`;

    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(NO_WS_VITE_CLIENT);
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
