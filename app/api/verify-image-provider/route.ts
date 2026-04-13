/**
 * Verify Image Provider API
 *
 * Lightweight endpoint that validates provider credentials without generating images.
 *
 * POST /api/verify-image-provider
 *
 * Provider and credentials are resolved from server-side env/YAML config.
 *
 * Response: { success: boolean, message: string }
 */

import { NextRequest } from 'next/server';
import { testImageConnectivity } from '@/lib/media/image-providers';
import {
  getDefaultImageProviderId,
  resolveImageApiKey,
  resolveImageBaseUrl,
} from '@/lib/server/provider-config';
import type { ImageProviderId } from '@/lib/media/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('VerifyImageProvider');

export async function POST(request: NextRequest) {
  try {
    const providerId =
      (getDefaultImageProviderId() as ImageProviderId | undefined) ||
      ('nvidia-flux' as ImageProviderId);
    const apiKey = resolveImageApiKey(providerId);
    const baseUrl = resolveImageBaseUrl(providerId);

    if (!apiKey) {
      return apiError('MISSING_API_KEY', 400, 'No API key configured');
    }

    const result = await testImageConnectivity({
      providerId,
      apiKey,
      baseUrl,
    });

    if (!result.success) {
      return apiError('UPSTREAM_ERROR', 500, result.message);
    }

    return apiSuccess({ message: result.message });
  } catch (err) {
    log.error(
      `Image provider verification failed [provider=${request.headers.get('x-image-provider') ?? 'nvidia-flux'}]:`,
      err,
    );
    return apiError('INTERNAL_ERROR', 500, `Connectivity test error: ${err}`);
  }
}
