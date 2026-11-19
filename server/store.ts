import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  AppPreferences,
  BootstrapPayload,
  ChatMessage,
  ScannerConfig,
  SosSettings,
  TimerDuration,
  TorchLightingPreset,
  TorchUsageEntry,
  UsageHistoryState,
} from '../src/types.ts';
import {
  DEFAULT_SOS_SETTINGS,
  clampSosSettings,
  cloneSosSettings,
} from '../src/utils/sosPatterns.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '..', '.data');
const DB_PATH = path.join(DATA_DIR, 'torch-db.json');

const MAX_CUSTOM_PRESETS = 9;
const MAX_USAGE_ENTRIES = 50;
const MAX_CHAT_MESSAGES = 100;
const MAX_PROFILES = 200;

const VALID_TIMERS: ReadonlySet<number> = new Set([0, 60, 300, 600, 900, 1800]);
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export interface StoredProfile extends BootstrapPayload {
  updatedAt: number;
}

interface DatabaseSchema {
  version: number;
  profiles: Record<string, StoredProfile>;
}

export function createDefaultPreferences(): AppPreferences {
  return {
    language: 'hi',
    soundEnabled: true,
    hapticEnabled: true,
    uiTheme: 'standard',
    torchIntensity: 1.0,
    activeTimer: 0,
    shakeSensitivity: 'medium',
    proximityAutoOffEnabled: false,
    strobeFrequency: 6,
    strobePattern: 'constant',
    screenColor: '#FFFFFF',
    screenBrightness: 1.0,
    widgetLayout: 'controls-2x2',
    widgetAutoStart: true,
    sosToneMuted: false,
    sosSyncSystemVolume: true,
    sosToneVolume: 0.85,
    torchHapticPattern: 'standard',
  };
}

export function createDefaultScannerConfig(): ScannerConfig {
  return {
    patternType: 'qr',
    payload: 'EMERGENCY-ICE-TORCH-01',
    brightness: 1.0,
    verticalBarcode: false,
    showHumanText: true,
  };
}

function createDefaultProfile(): StoredProfile {
  return {
    preferences: createDefaultPreferences(),
    lightingPresets: [],
    sosSettings: cloneSosSettings(DEFAULT_SOS_SETTINGS),
    usageHistory: {
      accumulatedMs: 0,
      entries: [],
    },
    scanner: createDefaultScannerConfig(),
    chatHistory: [],
    updatedAt: Date.now(),
  };
}

export function sanitizeClientId(raw: unknown): string {
  if (typeof raw !== 'string') return 'default';
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned.length >= 3 ? cleaned : 'default';
}

export function sanitizePreferencesPatch(
  current: AppPreferences,
  patch: Partial<AppPreferences> | null | undefined,
): AppPreferences {
  if (!patch || typeof patch !== 'object') return current;
  const next: AppPreferences = { ...current };

  if (patch.language === 'hi' || patch.language === 'en') {
    next.language = patch.language;
  }
  if (typeof patch.soundEnabled === 'boolean') {
    next.soundEnabled = patch.soundEnabled;
  }
  if (typeof patch.hapticEnabled === 'boolean') {
    next.hapticEnabled = patch.hapticEnabled;
  }
  if (
    patch.uiTheme === 'standard' ||
    patch.uiTheme === 'red-night' ||
    patch.uiTheme === 'sepia-night'
  ) {
    next.uiTheme = patch.uiTheme;
  }
  if (typeof patch.torchIntensity === 'number' && Number.isFinite(patch.torchIntensity)) {
    next.torchIntensity = Math.min(1, Math.max(0.1, Number(patch.torchIntensity.toFixed(2))));
  }
  if (typeof patch.activeTimer === 'number' && VALID_TIMERS.has(patch.activeTimer)) {
    next.activeTimer = patch.activeTimer as TimerDuration;
  }
  if (
    patch.shakeSensitivity === 'low' ||
    patch.shakeSensitivity === 'medium' ||
    patch.shakeSensitivity === 'high'
  ) {
    next.shakeSensitivity = patch.shakeSensitivity;
  }
  if (typeof patch.proximityAutoOffEnabled === 'boolean') {
    next.proximityAutoOffEnabled = patch.proximityAutoOffEnabled;
  }
  if (typeof patch.strobeFrequency === 'number' && Number.isFinite(patch.strobeFrequency)) {
    next.strobeFrequency = Math.min(25, Math.max(1, Math.round(patch.strobeFrequency)));
  }
  if (
    patch.strobePattern === 'constant' ||
    patch.strobePattern === 'flicker' ||
    patch.strobePattern === 'pulse' ||
    patch.strobePattern === 'heartbeat'
  ) {
    next.strobePattern = patch.strobePattern;
  }
  if (typeof patch.screenColor === 'string') {
    const trimmed = patch.screenColor.trim();
    if (trimmed.toLowerCase() === '#police' || HEX_COLOR_RE.test(trimmed)) {
      next.screenColor = trimmed.toLowerCase() === '#police' ? '#police' : trimmed.toUpperCase();
    }
  }
  if (typeof patch.screenBrightness === 'number' && Number.isFinite(patch.screenBrightness)) {
    next.screenBrightness = Math.min(1, Math.max(0.1, Number(patch.screenBrightness.toFixed(2))));
  }
  if (
    patch.widgetLayout === 'compact-2x1' ||
    patch.widgetLayout === 'controls-2x2' ||
    patch.widgetLayout === 'dock-4x1'
  ) {
    next.widgetLayout = patch.widgetLayout;
  }
  if (typeof patch.widgetAutoStart === 'boolean') {
    next.widgetAutoStart = patch.widgetAutoStart;
  }
  if (typeof patch.sosToneMuted === 'boolean') {
    next.sosToneMuted = patch.sosToneMuted;
  }
  if (typeof patch.sosSyncSystemVolume === 'boolean') {
    next.sosSyncSystemVolume = patch.sosSyncSystemVolume;
  }
  if (typeof patch.sosToneVolume === 'number' && Number.isFinite(patch.sosToneVolume)) {
    next.sosToneVolume = Math.min(1, Math.max(0, Number(patch.sosToneVolume.toFixed(2))));
  }
  if (
    patch.torchHapticPattern === 'subtle' ||
    patch.torchHapticPattern === 'standard' ||
    patch.torchHapticPattern === 'intense'
  ) {
    next.torchHapticPattern = patch.torchHapticPattern;
  }

  return next;
}

export function sanitizeScannerConfig(
  current: ScannerConfig,
  patch: Partial<ScannerConfig> | null | undefined,
): ScannerConfig {
  if (!patch || typeof patch !== 'object') return current;
  const next: ScannerConfig = { ...current };

  if (patch.patternType === 'qr' || patch.patternType === 'barcode') {
    next.patternType = patch.patternType;
  }
  if (typeof patch.payload === 'string') {
    next.payload = patch.payload.slice(0, 120);
  }
  if (typeof patch.brightness === 'number' && Number.isFinite(patch.brightness)) {
    next.brightness = Math.min(1, Math.max(0.5, Number(patch.brightness.toFixed(2))));
  }
  if (typeof patch.verticalBarcode === 'boolean') {
    next.verticalBarcode = patch.verticalBarcode;
  }
  if (typeof patch.showHumanText === 'boolean') {
    next.showHumanText = patch.showHumanText;
  }

  return next;
}

class TorchPersistenceStore {
  private db: DatabaseSchema | null = null;
  private loadPromise: Promise<DatabaseSchema> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  private async ensureLoaded(): Promise<DatabaseSchema> {
    if (this.db) return this.db;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const raw = await fs.readFile(DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
        if (parsed && typeof parsed === 'object' && parsed.profiles && typeof parsed.profiles === 'object') {
          this.db = {
            version: 1,
            profiles: parsed.profiles,
          };
          return this.db;
        }
      } catch {
        // Fresh database on first run or corrupted file recovery
      }

      this.db = {
        version: 1,
        profiles: {},
      };
      await this.flush();
      return this.db;
    })();

    return this.loadPromise;
  }

  private flush(): Promise<void> {
    const snapshot = this.db ? JSON.stringify(this.db, null, 2) : '{"version":1,"profiles":{}}';
    this.writeQueue = this.writeQueue
      .then(async () => {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const tempPath = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;
        await fs.writeFile(tempPath, snapshot, 'utf-8');
        await fs.rename(tempPath, DB_PATH);
      })
      .catch((err) => {
        console.error('Failed to persist database:', err);
      });
    return this.writeQueue;
  }

  private pruneIfNeeded(db: DatabaseSchema): void {
    const keys = Object.keys(db.profiles);
    if (keys.length <= MAX_PROFILES) return;
    keys
      .sort((a, b) => (db.profiles[a]?.updatedAt ?? 0) - (db.profiles[b]?.updatedAt ?? 0))
      .slice(0, keys.length - MAX_PROFILES)
      .forEach((oldestKey) => {
        delete db.profiles[oldestKey];
      });
  }

  private async getOrCreateProfile(clientId: string): Promise<StoredProfile> {
    const db = await this.ensureLoaded();
    const id = sanitizeClientId(clientId);
    const existing = db.profiles[id];
    if (existing) {
      // Ensure forward compatibility for any newly added fields
      existing.preferences = sanitizePreferencesPatch(
        createDefaultPreferences(),
        existing.preferences,
      );
      existing.scanner = sanitizeScannerConfig(
        createDefaultScannerConfig(),
        existing.scanner,
      );
      existing.sosSettings = clampSosSettings(existing.sosSettings);
      if (!Array.isArray(existing.lightingPresets)) existing.lightingPresets = [];
      if (!existing.usageHistory || !Array.isArray(existing.usageHistory.entries)) {
        existing.usageHistory = { accumulatedMs: 0, entries: [] };
      }
      if (!Array.isArray(existing.chatHistory)) existing.chatHistory = [];
      return existing;
    }

    const fresh = createDefaultProfile();
    db.profiles[id] = fresh;
    this.pruneIfNeeded(db);
    await this.flush();
    return fresh;
  }

  async isReady(): Promise<boolean> {
    await this.ensureLoaded();
    return true;
  }

  async getBootstrap(clientId: string): Promise<BootstrapPayload> {
    const profile = await this.getOrCreateProfile(clientId);
    return {
      preferences: { ...profile.preferences },
      lightingPresets: profile.lightingPresets.map((p) => ({ ...p })),
      sosSettings: cloneSosSettings(profile.sosSettings),
      usageHistory: {
        accumulatedMs: profile.usageHistory.accumulatedMs,
        entries: profile.usageHistory.entries.map((e) => ({ ...e })),
      },
      scanner: { ...profile.scanner },
      chatHistory: profile.chatHistory.map((m) => ({ ...m })),
    };
  }

  async getPreferences(clientId: string): Promise<AppPreferences> {
    const profile = await this.getOrCreateProfile(clientId);
    return { ...profile.preferences };
  }

  async patchPreferences(
    clientId: string,
    patch: Partial<AppPreferences>,
  ): Promise<AppPreferences> {
    const profile = await this.getOrCreateProfile(clientId);
    profile.preferences = sanitizePreferencesPatch(profile.preferences, patch);
    profile.updatedAt = Date.now();
    await this.flush();
    return { ...profile.preferences };
  }

  async getLightingPresets(clientId: string): Promise<TorchLightingPreset[]> {
    const profile = await this.getOrCreateProfile(clientId);
    return profile.lightingPresets.map((p) => ({ ...p }));
  }

  async upsertLightingPreset(
    clientId: string,
    name: string,
    intensity: number,
  ): Promise<{ preset: TorchLightingPreset; presets: TorchLightingPreset[] }> {
    const profile = await this.getOrCreateProfile(clientId);
    const trimmed = name.trim().slice(0, 24);
    const normalized = Math.min(1, Math.max(0.1, Number(intensity.toFixed(2))));

    const existingIdx = profile.lightingPresets.findIndex(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    );

    let savedPreset: TorchLightingPreset;
    if (existingIdx >= 0) {
      savedPreset = {
        ...profile.lightingPresets[existingIdx],
        name: trimmed,
        intensity: normalized,
        isBuiltIn: false,
      };
      profile.lightingPresets[existingIdx] = savedPreset;
    } else {
      savedPreset = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: trimmed,
        intensity: normalized,
        isBuiltIn: false,
      };
      profile.lightingPresets = [...profile.lightingPresets, savedPreset].slice(
        -MAX_CUSTOM_PRESETS,
      );
    }

    profile.updatedAt = Date.now();
    await this.flush();
    return {
      preset: { ...savedPreset },
      presets: profile.lightingPresets.map((p) => ({ ...p })),
    };
  }

  async deleteLightingPreset(
    clientId: string,
    presetId: string,
  ): Promise<TorchLightingPreset[]> {
    const profile = await this.getOrCreateProfile(clientId);
    profile.lightingPresets = profile.lightingPresets.filter((p) => p.id !== presetId);
    profile.updatedAt = Date.now();
    await this.flush();
    return profile.lightingPresets.map((p) => ({ ...p }));
  }

  async getSosSettings(clientId: string): Promise<SosSettings> {
    const profile = await this.getOrCreateProfile(clientId);
    return cloneSosSettings(profile.sosSettings);
  }

  async setSosSettings(
    clientId: string,
    candidate: Partial<SosSettings>,
  ): Promise<SosSettings> {
    const profile = await this.getOrCreateProfile(clientId);
    profile.sosSettings = clampSosSettings(candidate);
    profile.updatedAt = Date.now();
    await this.flush();
    return cloneSosSettings(profile.sosSettings);
  }

  async resetSosSettings(clientId: string): Promise<SosSettings> {
    const profile = await this.getOrCreateProfile(clientId);
    profile.sosSettings = cloneSosSettings(DEFAULT_SOS_SETTINGS);
    profile.updatedAt = Date.now();
    await this.flush();
    return cloneSosSettings(profile.sosSettings);
  }

  async getUsageHistory(clientId: string): Promise<UsageHistoryState> {
    const profile = await this.getOrCreateProfile(clientId);
    return {
      accumulatedMs: profile.usageHistory.accumulatedMs,
      entries: profile.usageHistory.entries.map((e) => ({ ...e })),
    };
  }

  async recordUsageSession(
    clientId: string,
    payload: {
      startedAt: number;
      endedAt: number;
      durationMs: number;
      intensityPercent: number;
    },
  ): Promise<{ entry: TorchUsageEntry; usageHistory: UsageHistoryState }> {
    const profile = await this.getOrCreateProfile(clientId);
    const now = Date.now();
    const endedAt =
      typeof payload.endedAt === 'number' && Number.isFinite(payload.endedAt)
        ? Math.min(now + 60_000, Math.max(0, Math.round(payload.endedAt)))
        : now;
    const rawDuration =
      typeof payload.durationMs === 'number' && Number.isFinite(payload.durationMs)
        ? Math.round(payload.durationMs)
        : Math.max(0, endedAt - payload.startedAt);
    const durationMs = Math.min(24 * 60 * 60 * 1000, Math.max(500, rawDuration));
    const startedAt =
      typeof payload.startedAt === 'number' && Number.isFinite(payload.startedAt)
        ? Math.max(0, Math.round(payload.startedAt))
        : Math.max(0, endedAt - durationMs);
    const intensityPercent =
      typeof payload.intensityPercent === 'number' && Number.isFinite(payload.intensityPercent)
        ? Math.min(100, Math.max(10, Math.round(payload.intensityPercent)))
        : 100;

    const entry: TorchUsageEntry = {
      id: `usage-${endedAt}-${Math.random().toString(36).slice(2, 6)}`,
      startedAt,
      endedAt,
      durationMs,
      intensityPercent,
    };

    profile.usageHistory.accumulatedMs += durationMs;
    profile.usageHistory.entries = [entry, ...profile.usageHistory.entries].slice(
      0,
      MAX_USAGE_ENTRIES,
    );
    profile.updatedAt = now;
    await this.flush();

    return {
      entry: { ...entry },
      usageHistory: {
        accumulatedMs: profile.usageHistory.accumulatedMs,
        entries: profile.usageHistory.entries.map((e) => ({ ...e })),
      },
    };
  }

  async resetUsageHistory(clientId: string): Promise<UsageHistoryState> {
    const profile = await this.getOrCreateProfile(clientId);
    profile.usageHistory = {
      accumulatedMs: 0,
      entries: [],
    };
    profile.updatedAt = Date.now();
    await this.flush();
    return {
      accumulatedMs: 0,
      entries: [],
    };
  }

  async getScannerConfig(clientId: string): Promise<ScannerConfig> {
    const profile = await this.getOrCreateProfile(clientId);
    return { ...profile.scanner };
  }

  async setScannerConfig(
    clientId: string,
    patch: Partial<ScannerConfig>,
  ): Promise<ScannerConfig> {
    const profile = await this.getOrCreateProfile(clientId);
    profile.scanner = sanitizeScannerConfig(profile.scanner, patch);
    profile.updatedAt = Date.now();
    await this.flush();
    return { ...profile.scanner };
  }

  async getChatHistory(clientId: string): Promise<ChatMessage[]> {
    const profile = await this.getOrCreateProfile(clientId);
    return profile.chatHistory.map((m) => ({ ...m }));
  }

  async appendChatMessages(
    clientId: string,
    messages: ChatMessage[],
  ): Promise<ChatMessage[]> {
    const profile = await this.getOrCreateProfile(clientId);
    const valid = messages.filter(
      (m) =>
        m &&
        typeof m.id === 'string' &&
        (m.role === 'user' || m.role === 'model') &&
        typeof m.text === 'string' &&
        m.text.trim().length > 0,
    );
    if (valid.length === 0) return profile.chatHistory.map((m) => ({ ...m }));

    profile.chatHistory = [...profile.chatHistory, ...valid].slice(-MAX_CHAT_MESSAGES);
    profile.updatedAt = Date.now();
    await this.flush();
    return profile.chatHistory.map((m) => ({ ...m }));
  }

  async clearChatHistory(clientId: string): Promise<void> {
    const profile = await this.getOrCreateProfile(clientId);
    profile.chatHistory = [];
    profile.updatedAt = Date.now();
    await this.flush();
  }
}

export const torchStore = new TorchPersistenceStore();
