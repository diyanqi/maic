import type {
  ImageGenerationConfig,
  ImageGenerationOptions,
  ImageGenerationResult,
} from '../types';

const DEFAULT_BASE_URL = 'https://ai.api.nvidia.com';
const DEFAULT_MODEL = 'black-forest-labs/flux.2-klein-4b';

function buildInvokeUrl(baseUrl: string, model: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return `${normalizedBase}/v1/genai/${model}`;
}

function resolveSize(options: ImageGenerationOptions): { width: number; height: number } {
  return {
    width: options.width || 1024,
    height: options.height || 1024,
  };
}

function extractResultImage(data: unknown): { url?: string; base64?: string } {
  const body = (data || {}) as Record<string, unknown>;

  const directUrl = body.url;
  if (typeof directUrl === 'string' && directUrl) {
    return { url: directUrl };
  }

  const directBase64 = body.b64_json;
  if (typeof directBase64 === 'string' && directBase64) {
    return { base64: directBase64 };
  }

  const output = body.output as Record<string, unknown> | undefined;
  if (output) {
    if (typeof output.url === 'string' && output.url) {
      return { url: output.url };
    }
    if (typeof output.image === 'string' && output.image) {
      return { base64: output.image };
    }
    if (typeof output.b64_json === 'string' && output.b64_json) {
      return { base64: output.b64_json };
    }
  }

  const artifacts = body.artifacts;
  if (Array.isArray(artifacts) && artifacts.length > 0) {
    const first = artifacts[0] as Record<string, unknown>;
    if (typeof first.url === 'string' && first.url) {
      return { url: first.url };
    }
    if (typeof first.base64 === 'string' && first.base64) {
      return { base64: first.base64 };
    }
    if (typeof first.b64_json === 'string' && first.b64_json) {
      return { base64: first.b64_json };
    }
  }

  const dataArray = body.data;
  if (Array.isArray(dataArray) && dataArray.length > 0) {
    const first = dataArray[0] as Record<string, unknown>;
    if (typeof first.url === 'string' && first.url) {
      return { url: first.url };
    }
    if (typeof first.b64_json === 'string' && first.b64_json) {
      return { base64: first.b64_json };
    }
  }

  return {};
}

export async function testNvidiaFluxConnectivity(
  config: ImageGenerationConfig,
): Promise<{ success: boolean; message: string }> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const model = config.model || DEFAULT_MODEL;

  try {
    const response = await fetch(buildInvokeUrl(baseUrl, model), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'connectivity check',
        width: 256,
        height: 256,
        seed: 0,
        steps: 1,
      }),
    });

    if (response.status === 401 || response.status === 403) {
      const text = await response.text();
      return {
        success: false,
        message: `NVIDIA auth failed (${response.status}): ${text}`,
      };
    }

    return { success: true, message: 'Connected to NVIDIA FLUX.2 Klein 4B' };
  } catch (err) {
    return { success: false, message: `NVIDIA connectivity error: ${err}` };
  }
}

export async function generateWithNvidiaFlux(
  config: ImageGenerationConfig,
  options: ImageGenerationOptions,
): Promise<ImageGenerationResult> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const model = config.model || DEFAULT_MODEL;
  const { width, height } = resolveSize(options);

  const response = await fetch(buildInvokeUrl(baseUrl, model), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: options.prompt,
      width,
      height,
      seed: 0,
      steps: 4,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NVIDIA image generation failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const image = extractResultImage(data);
  if (!image.url && !image.base64) {
    throw new Error('NVIDIA image response missing image data');
  }

  return {
    url: image.url,
    base64: image.base64,
    width,
    height,
  };
}