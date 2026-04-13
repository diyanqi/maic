/**
 * Image Generation Service -- routes to provider adapters
 */

import type {
  ImageProviderId,
  ImageGenerationConfig,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageProviderConfig,
} from './types';
import {
  generateWithNvidiaFlux,
  testNvidiaFluxConnectivity,
} from './adapters/nvidia-flux-adapter';

export const IMAGE_PROVIDERS: Record<ImageProviderId, ImageProviderConfig> = {
  'nvidia-flux': {
    id: 'nvidia-flux',
    name: 'NVIDIA FLUX.2 Klein 4B',
    requiresApiKey: true,
    defaultBaseUrl: 'https://ai.api.nvidia.com',
    models: [
      {
        id: 'black-forest-labs/flux.2-klein-4b',
        name: 'black-forest-labs/flux.2-klein-4b',
      },
    ],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
  },
};

export async function testImageConnectivity(
  config: ImageGenerationConfig,
): Promise<{ success: boolean; message: string }> {
  switch (config.providerId) {
    case 'nvidia-flux':
      return testNvidiaFluxConnectivity(config);
    default:
      return {
        success: false,
        message: `Unsupported image provider: ${config.providerId}`,
      };
  }
}

export async function generateImage(
  config: ImageGenerationConfig,
  options: ImageGenerationOptions,
): Promise<ImageGenerationResult> {
  switch (config.providerId) {
    case 'nvidia-flux':
      return generateWithNvidiaFlux(config, options);
    default:
      throw new Error(`Unsupported image provider: ${config.providerId}`);
  }
}

export function aspectRatioToDimensions(
  ratio: string,
  maxWidth = 1024,
): { width: number; height: number } {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return { width: maxWidth, height: Math.round((maxWidth * 9) / 16) };
  return { width: maxWidth, height: Math.round((maxWidth * h) / w) };
}
