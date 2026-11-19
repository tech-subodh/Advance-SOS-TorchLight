import {
  AppPreferences,
  BootstrapPayload,
  ScannerConfig,
  SosSettings,
  TorchLightingPreset,
  TorchUsageEntry,
  UsageHistoryState,
} from '../types';

const CLIENT_ID_STORAGE_KEY = 'torch-app-client-id';

function generateClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `dev_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getClientId(): string {
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (existing && existing.length >= 6) return existing;
    const created = generateClientId();
    window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return 'default';
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('x-client-id', getClientId());
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let msg = `API request failed (${response.status})`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      // ignore json parse failure
    }
    throw new Error(msg);
  }

  return (await response.json()) as T;
}

export async function fetchBootstrap(): Promise<BootstrapPayload> {
  return apiRequest<BootstrapPayload>('/api/bootstrap', { method: 'GET' });
}

export async function patchSettings(
  patch: Partial<AppPreferences>,
): Promise<AppPreferences> {
  const res = await apiRequest<{ preferences: AppPreferences }>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.preferences;
}

export async function upsertLightingPresetApi(
  name: string,
  intensity: number,
): Promise<{ preset: TorchLightingPreset; presets: TorchLightingPreset[] }> {
  return apiRequest<{ preset: TorchLightingPreset; presets: TorchLightingPreset[] }>(
    '/api/presets',
    {
      method: 'POST',
      body: JSON.stringify({ name, intensity }),
    },
  );
}

export async function deleteLightingPresetApi(
  presetId: string,
): Promise<TorchLightingPreset[]> {
  const res = await apiRequest<{ presets: TorchLightingPreset[] }>(
    `/api/presets/${encodeURIComponent(presetId)}`,
    { method: 'DELETE' },
  );
  return res.presets;
}

export async function saveSosSettingsApi(
  settings: SosSettings,
): Promise<{ sosSettings: SosSettings; cycleDurationMs: number }> {
  return apiRequest<{ sosSettings: SosSettings; cycleDurationMs: number }>(
    '/api/sos/settings',
    {
      method: 'PUT',
      body: JSON.stringify(settings),
    },
  );
}

export async function resetSosSettingsApi(): Promise<{
  sosSettings: SosSettings;
  cycleDurationMs: number;
}> {
  return apiRequest<{ sosSettings: SosSettings; cycleDurationMs: number }>(
    '/api/sos/settings',
    { method: 'DELETE' },
  );
}

export async function recordUsageSessionApi(payload: {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  intensityPercent: number;
}): Promise<{ entry: TorchUsageEntry; usageHistory: UsageHistoryState }> {
  return apiRequest<{ entry: TorchUsageEntry; usageHistory: UsageHistoryState }>(
    '/api/usage/sessions',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function recordUsageSessionKeepalive(payload: {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  intensityPercent: number;
}): void {
  try {
    void fetch('/api/usage/sessions', {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': getClientId(),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignore unload errors
  }
}

export async function resetUsageHistoryApi(): Promise<UsageHistoryState> {
  return apiRequest<UsageHistoryState>('/api/usage', { method: 'DELETE' });
}

export async function saveScannerConfigApi(
  patch: Partial<ScannerConfig>,
): Promise<ScannerConfig> {
  const res = await apiRequest<{ scanner: ScannerConfig }>('/api/scanner', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  return res.scanner;
}

export async function clearChatHistoryApi(): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/chat/history', { method: 'DELETE' });
}
