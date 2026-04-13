/**
 * Server-side Provider Configuration
 *
 * Loads provider configs from YAML (primary) + environment variables (fallback).
 * Keys never leave the server — only provider IDs and metadata are exposed via API.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { createLogger } from '@/lib/logger';
import { PROVIDERS } from '@/lib/ai/providers';

const log = createLogger('ServerProviderConfig');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServerProviderEntry {
  apiKey: string;
  baseUrl?: string;
  models?: string[];
  proxy?: string;
}

interface ServerConfig {
  providers: Record<string, ServerProviderEntry>;
  tts: Record<string, ServerProviderEntry>;
  asr: Record<string, ServerProviderEntry>;
  pdf: Record<string, ServerProviderEntry>;
  image: Record<string, ServerProviderEntry>;
  video: Record<string, ServerProviderEntry>;
  webSearch: Record<string, ServerProviderEntry>;
}

// ---------------------------------------------------------------------------
// Env-var prefix mappings
// ---------------------------------------------------------------------------

const LLM_ENV_MAP: Record<string, string> = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  DEEPSEEK: 'deepseek',
  QWEN: 'qwen',
  KIMI: 'kimi',
  MINIMAX: 'minimax',
  GLM: 'glm',
  SILICONFLOW: 'siliconflow',
  DOUBAO: 'doubao',
  GROK: 'grok',
  OLLAMA: 'ollama',
};

const ASR_ENV_MAP: Record<string, string> = {
  ASR_OPENAI: 'openai-whisper',
  ASR_QWEN: 'qwen-asr',
};

const PDF_ENV_MAP: Record<string, string> = {
  PDF_UNPDF: 'unpdf',
  PDF_MINERU: 'mineru',
};

const IMAGE_ENV_MAP: Record<string, string> = {
  IMAGE_SEEDREAM: 'seedream',
  IMAGE_QWEN_IMAGE: 'qwen-image',
  IMAGE_NANO_BANANA: 'nano-banana',
  IMAGE_MINIMAX: 'minimax-image',
  IMAGE_GROK: 'grok-image',
};

const VIDEO_ENV_MAP: Record<string, string> = {
  VIDEO_SEEDANCE: 'seedance',
  VIDEO_KLING: 'kling',
  VIDEO_VEO: 'veo',
  VIDEO_SORA: 'sora',
  VIDEO_MINIMAX: 'minimax-video',
  VIDEO_GROK: 'grok-video',
};

const WEB_SEARCH_ENV_MAP: Record<string, string> = {
  TAVILY: 'tavily',
};

// ---------------------------------------------------------------------------
// YAML loading
// ---------------------------------------------------------------------------

type YamlData = Partial<{
  providers: Record<string, Partial<ServerProviderEntry>>;
  tts: Record<string, Partial<ServerProviderEntry>>;
  asr: Record<string, Partial<ServerProviderEntry>>;
  pdf: Record<string, Partial<ServerProviderEntry>>;
  image: Record<string, Partial<ServerProviderEntry>>;
  video: Record<string, Partial<ServerProviderEntry>>;
  'web-search': Record<string, Partial<ServerProviderEntry>>;
}>;

const SERVER_PROVIDERS_FILE = 'server-providers.yml';

function loadYamlFile(): YamlData {
  try {
    const filePath = path.join(process.cwd(), SERVER_PROVIDERS_FILE);
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.load(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as YamlData;
  } catch (e) {
    log.warn(`[ServerProviderConfig] Failed to load ${SERVER_PROVIDERS_FILE}:`, e);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Env-var helpers
// ---------------------------------------------------------------------------

function loadEnvSection(
  envMap: Record<string, string>,
  yamlSection: Record<string, Partial<ServerProviderEntry>> | undefined,
  {
    requiresBaseUrl = false,
    keylessProviders = new Set<string>(),
  }: { requiresBaseUrl?: boolean; keylessProviders?: Set<string> } = {},
): Record<string, ServerProviderEntry> {
  const result: Record<string, ServerProviderEntry> = {};

  // First, add everything from YAML as defaults
  if (yamlSection) {
    for (const [id, entry] of Object.entries(yamlSection)) {
      if (
        requiresBaseUrl
          ? !!entry?.baseUrl
          : entry?.apiKey || (entry?.baseUrl && keylessProviders.has(id))
      ) {
        result[id] = {
          apiKey: entry.apiKey || '',
          baseUrl: entry.baseUrl,
          models: entry.models,
          proxy: entry.proxy,
        };
      }
    }
  }

  // Then, apply env vars (env takes priority over YAML)
  for (const [prefix, providerId] of Object.entries(envMap)) {
    const envApiKey = process.env[`${prefix}_API_KEY`] || undefined;
    const envBaseUrl = process.env[`${prefix}_BASE_URL`] || undefined;
    const envModelsStr = process.env[`${prefix}_MODELS`];
    const envModels = envModelsStr
      ? envModelsStr
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
      : undefined;

    if (result[providerId]) {
      // YAML entry exists — env vars override individual fields
      if (envApiKey) result[providerId].apiKey = envApiKey;
      if (envBaseUrl) result[providerId].baseUrl = envBaseUrl;
      if (envModels) result[providerId].models = envModels;
      continue;
    }

    // Activate on API key, or base URL alone for keyless providers (e.g. Ollama)
    if (
      requiresBaseUrl
        ? !envBaseUrl
        : !(envApiKey || (envBaseUrl && keylessProviders.has(providerId)))
    )
      continue;
    result[providerId] = {
      apiKey: envApiKey || '',
      baseUrl: envBaseUrl,
      models: envModels,
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// API-key rotation helpers
// ---------------------------------------------------------------------------

const keyRotationCursor = new Map<string, number>();

function splitApiKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function pickRotatingApiKey(scope: string, raw: string | undefined): string {
  const keys = splitApiKeys(raw);
  if (keys.length === 0) return '';

  const cursor = keyRotationCursor.get(scope) ?? 0;
  const selected = keys[cursor % keys.length];
  keyRotationCursor.set(scope, (cursor + 1) % keys.length);
  return selected;
}

function pickDefaultProvider(
  section: Record<string, ServerProviderEntry>,
  preferredEnvName?: string,
): string | undefined {
  const ids = Object.keys(section);
  if (ids.length === 0) return undefined;

  const preferred = preferredEnvName ? process.env[preferredEnvName] : undefined;
  if (preferred && section[preferred]) return preferred;
  return ids[0];
}

// ---------------------------------------------------------------------------
// Module-level cache (process singleton)
// ---------------------------------------------------------------------------

let _config: ServerConfig | null = null;

function buildConfig(yamlData: YamlData): ServerConfig {
  return {
    providers: loadEnvSection(LLM_ENV_MAP, yamlData.providers, {
      keylessProviders: new Set(['ollama']),
    }),
    // TTS now defaults to edge-tts-universal and does not require server API keys.
    tts: {},
    asr: loadEnvSection(ASR_ENV_MAP, yamlData.asr),
    pdf: loadEnvSection(PDF_ENV_MAP, yamlData.pdf, { requiresBaseUrl: true }),
    image: loadEnvSection(IMAGE_ENV_MAP, yamlData.image),
    video: loadEnvSection(VIDEO_ENV_MAP, yamlData.video),
    webSearch: loadEnvSection(WEB_SEARCH_ENV_MAP, yamlData['web-search']),
  };
}

function logConfig(config: ServerConfig, label: string): void {
  const counts = [
    Object.keys(config.providers).length,
    Object.keys(config.tts).length,
    Object.keys(config.asr).length,
    Object.keys(config.pdf).length,
    Object.keys(config.image).length,
    Object.keys(config.video).length,
    Object.keys(config.webSearch).length,
  ];
  if (counts.some((c) => c > 0)) {
    log.info(
      `[ServerProviderConfig] Loaded (${label}): ${counts[0]} LLM, ${counts[1]} TTS, ${counts[2]} ASR, ${counts[3]} PDF, ${counts[4]} Image, ${counts[5]} Video, ${counts[6]} WebSearch providers`,
    );
  }
}

function getConfig(): ServerConfig {
  if (_config) return _config;

  const yamlData = loadYamlFile();
  const config = buildConfig(yamlData);
  logConfig(config, SERVER_PROVIDERS_FILE);
  _config = config;
  return config;
}

// ---------------------------------------------------------------------------
// Public API — LLM
// ---------------------------------------------------------------------------

/** Returns server-configured LLM providers (no apiKeys) */
export function getServerProviders(): Record<string, { models?: string[]; baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { models?: string[]; baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.providers)) {
    result[id] = {};
    if (entry.models && entry.models.length > 0) result[id].models = entry.models;
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

export function getDefaultLLMProviderId(): string | undefined {
  return pickDefaultProvider(getConfig().providers, 'DEFAULT_LLM_PROVIDER');
}

export function getDefaultLLMModelId(providerId: string): string | undefined {
  const configured = getConfig().providers[providerId];
  if (configured?.models?.length) return configured.models[0];

  const builtIn = PROVIDERS[providerId as keyof typeof PROVIDERS];
  return builtIn?.models?.[0]?.id;
}

/** Resolve API key from server config only, with comma-separated round-robin support. */
export function resolveApiKey(providerId: string): string {
  return pickRotatingApiKey(`llm:${providerId}`, getConfig().providers[providerId]?.apiKey);
}

/** Resolve base URL from server config only. */
export function resolveBaseUrl(providerId: string): string | undefined {
  return getConfig().providers[providerId]?.baseUrl;
}

/** Resolve proxy URL for a provider (server config only) */
export function resolveProxy(providerId: string): string | undefined {
  return getConfig().providers[providerId]?.proxy;
}

// ---------------------------------------------------------------------------
// Public API — TTS
// ---------------------------------------------------------------------------

export function getServerTTSProviders(): Record<string, { baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.tts)) {
    result[id] = {};
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API — ASR
// ---------------------------------------------------------------------------

export function getServerASRProviders(): Record<string, { baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.asr)) {
    result[id] = {};
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

export function getDefaultASRProviderId(): string | undefined {
  return pickDefaultProvider(getConfig().asr, 'DEFAULT_ASR_PROVIDER');
}

export function resolveASRApiKey(providerId: string): string {
  return pickRotatingApiKey(`asr:${providerId}`, getConfig().asr[providerId]?.apiKey);
}

export function resolveASRBaseUrl(providerId: string): string | undefined {
  return getConfig().asr[providerId]?.baseUrl;
}

// ---------------------------------------------------------------------------
// Public API — PDF
// ---------------------------------------------------------------------------

export function getServerPDFProviders(): Record<string, { baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.pdf)) {
    result[id] = {};
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

export function getDefaultPDFProviderId(): string | undefined {
  return pickDefaultProvider(getConfig().pdf, 'DEFAULT_PDF_PROVIDER');
}

export function resolvePDFApiKey(providerId: string): string {
  return pickRotatingApiKey(`pdf:${providerId}`, getConfig().pdf[providerId]?.apiKey);
}

export function resolvePDFBaseUrl(providerId: string): string | undefined {
  return getConfig().pdf[providerId]?.baseUrl;
}

// ---------------------------------------------------------------------------
// Public API — Image Generation
// ---------------------------------------------------------------------------

export function getServerImageProviders(): Record<string, Record<string, never>> {
  const cfg = getConfig();
  const result: Record<string, Record<string, never>> = {};
  for (const id of Object.keys(cfg.image)) {
    result[id] = {};
  }
  return result;
}

export function getDefaultImageProviderId(): string | undefined {
  return pickDefaultProvider(getConfig().image, 'DEFAULT_IMAGE_PROVIDER');
}

export function resolveImageApiKey(providerId: string): string {
  return pickRotatingApiKey(`image:${providerId}`, getConfig().image[providerId]?.apiKey);
}

export function resolveImageBaseUrl(providerId: string): string | undefined {
  return getConfig().image[providerId]?.baseUrl;
}

// ---------------------------------------------------------------------------
// Public API — Video Generation
// ---------------------------------------------------------------------------

export function getServerVideoProviders(): Record<string, Record<string, never>> {
  const cfg = getConfig();
  const result: Record<string, Record<string, never>> = {};
  for (const id of Object.keys(cfg.video)) {
    result[id] = {};
  }
  return result;
}

export function getDefaultVideoProviderId(): string | undefined {
  return pickDefaultProvider(getConfig().video, 'DEFAULT_VIDEO_PROVIDER');
}

export function resolveVideoApiKey(providerId: string): string {
  return pickRotatingApiKey(`video:${providerId}`, getConfig().video[providerId]?.apiKey);
}

export function resolveVideoBaseUrl(providerId: string): string | undefined {
  return getConfig().video[providerId]?.baseUrl;
}

// ---------------------------------------------------------------------------
// Public API — Web Search (Tavily)
// ---------------------------------------------------------------------------

/** Returns server-configured web search providers (no apiKeys exposed) */
export function getServerWebSearchProviders(): Record<string, { baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.webSearch)) {
    result[id] = {};
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

export function getDefaultWebSearchProviderId(): string | undefined {
  return pickDefaultProvider(getConfig().webSearch, 'DEFAULT_WEB_SEARCH_PROVIDER') || 'tavily';
}

/** Resolve Tavily API key from server config only, with comma-separated round-robin support. */
export function resolveWebSearchApiKey(): string {
  const serverKey = getConfig().webSearch.tavily?.apiKey;
  return pickRotatingApiKey('web-search:tavily', serverKey || process.env.TAVILY_API_KEY);
}
