/**
 * Verify Video Provider API
 *
 * Lightweight endpoint that validates provider credentials without generating video.
 *
 * POST /api/verify-video-provider
 *
 * Headers:
 *   x-video-provider: VideoProviderId
 *   x-video-model: string (optional)
 *   x-api-key: string (optional, server fallback)
 *   x-base-url: string (optional, server fallback)
 *
 * Response: { success: boolean, message: string }
 */

import { NextRequest } from 'next/server';
import { testVideoConnectivity } from '@/lib/media/video-providers';
import {
  getDefaultVideoProviderId,
  resolveVideoApiKey,
  resolveVideoBaseUrl,
} from '@/lib/server/provider-config';
import type { VideoProviderId } from '@/lib/media/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('VerifyVideoProvider');

export async function POST(request: NextRequest) {
  try {
    const providerId =
      (getDefaultVideoProviderId() as VideoProviderId | undefined) || ('seedance' as VideoProviderId);
    const apiKey = resolveVideoApiKey(providerId);
    const baseUrl = resolveVideoBaseUrl(providerId);

    if (!apiKey) {
      return apiError('MISSING_API_KEY', 400, 'No API key configured');
    }

    const result = await testVideoConnectivity({
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
      `Video provider verification failed [provider=${request.headers.get('x-video-provider') ?? 'seedance'}]:`,
      err,
    );
    return apiError('INTERNAL_ERROR', 500, `Connectivity test error: ${err}`);
  }
}
