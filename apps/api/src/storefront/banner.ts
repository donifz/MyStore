import { BadRequestException } from '@nestjs/common';
import { normalizeProductPhoto } from '../catalog/product-photo';

export type StorefrontBanner = {
  imageDataUrl?: string;
};

export async function validateBanner(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid storefront banner');
  const input = value as Record<string, unknown>;
  const imageDataUrl = input.imageDataUrl;
  if (
    imageDataUrl === undefined ||
    imageDataUrl === null ||
    imageDataUrl === ''
  )
    return null;
  if (typeof imageDataUrl !== 'string' || imageDataUrl.length > 700_000)
    throw new BadRequestException('Invalid banner image');
  const normalized = await normalizeProductPhoto(imageDataUrl);
  return {
    imageDataUrl: `data:image/jpeg;base64,${normalized.toString('base64')}`,
  };
}
