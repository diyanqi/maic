/**
 * Image Generation API
 *
 * Generates an image from a text prompt using the specified provider.
 * Called by the client during media generation after slides are produced.
 *
 * POST /api/generate/image
 *
 * Provider and credentials are resolved from server-side env/YAML config.
 *
 * Body: { prompt, negativePrompt?, width?, height?, aspectRatio?, style? }
 * Response: { success: boolean, result?: ImageGenerationResult, error?: string }
 */

import { NextRequest } from 'next/server';
import { generateImage, aspectRatioToDimensions } from '@/lib/media/image-providers';
import {
  getDefaultImageProviderId,
  resolveImageApiKey,
  resolveImageBaseUrl,
} from '@/lib/server/provider-config';
import type { ImageProviderId, ImageGenerationOptions } from '@/lib/media/types';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';

const log = createLogger('ImageGeneration API');

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ImageGenerationOptions;

    if (!body.prompt) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing prompt');
    }

    const providerId =
      (getDefaultImageProviderId() as ImageProviderId | undefined) ||
      ('nvidia-flux' as ImageProviderId);
    const apiKey = resolveImageApiKey(providerId);
    if (!apiKey) {
      return apiError(
        'MISSING_API_KEY',
        401,
        `No API key configured for image provider: ${providerId}`,
      );
    }

    const baseUrl = resolveImageBaseUrl(providerId);

    // Resolve dimensions from aspect ratio if not explicitly set
    if (!body.width && !body.height && body.aspectRatio) {
      const dims = aspectRatioToDimensions(body.aspectRatio);
      body.width = dims.width;
      body.height = dims.height;
    }

    log.info(
      `Generating image: provider=${providerId}, model=default, ` +
        `prompt="${body.prompt.slice(0, 80)}...", size=${body.width ?? 'auto'}x${body.height ?? 'auto'}`,
    );

    const result = await generateImage({ providerId, apiKey, baseUrl }, body);

    return apiSuccess({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Detect provider-side content safety rejections.
    if (message.includes('SensitiveContent') || message.includes('sensitive information')) {
      log.warn(`Image blocked by content safety filter: ${message}`);
      return apiError('CONTENT_SENSITIVE', 400, message);
    }
    log.error(
      `Image generation failed [provider=${request.headers.get('x-image-provider') ?? 'nvidia-flux'}, model=${request.headers.get('x-image-model') ?? 'default'}]:`,
      error,
    );
    return apiError('INTERNAL_ERROR', 500, message);
  }
}
