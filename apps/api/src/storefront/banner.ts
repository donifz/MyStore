import { BadRequestException } from '@nestjs/common';
import { normalizeProductPhoto } from '../catalog/product-photo';

export type StorefrontBanner = {
  imageDataUrl?: string;
  imageAlt?: string;
  title?: string;
  text?: string;
  link?: string;
  buttonLabel?: string;
};

const limits: Record<keyof StorefrontBanner, number> = {
  imageDataUrl: 700_000,
  imageAlt: 160,
  title: 160,
  text: 1000,
  link: 1000,
  buttonLabel: 80,
};

function safeLink(value: string) {
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function validateBanner(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid storefront banner');
  const input = value as Record<string, unknown>;
  const banner: StorefrontBanner = {};
  for (const key of Object.keys(limits) as (keyof StorefrontBanner)[]) {
    const raw = input[key];
    if (raw === undefined || raw === null || raw === '') continue;
    if (typeof raw !== 'string' || raw.length > limits[key])
      throw new BadRequestException(`Invalid banner ${key}`);
    banner[key] = raw.trim();
  }
  if (banner.link && !safeLink(banner.link))
    throw new BadRequestException('Banner link must be internal or HTTPS');
  if (banner.imageDataUrl) {
    const normalized = await normalizeProductPhoto(banner.imageDataUrl);
    banner.imageDataUrl = `data:image/jpeg;base64,${normalized.toString('base64')}`;
  }
  return Object.keys(banner).length ? banner : null;
}
