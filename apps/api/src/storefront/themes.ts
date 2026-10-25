import { BadRequestException } from '@nestjs/common';
import { normalizeProductPhoto } from '../catalog/product-photo';

export const themeIds = ['base', 'new-year', 'womens-day', 'nooruz'] as const;
export type ThemeId = (typeof themeIds)[number];
export type ThemeBlock = {
  imageDataUrl?: string;
  imageAlt?: string;
  title?: string;
  text?: string;
  link?: string;
  buttonLabel?: string;
};
export type ThemePresentation = {
  id: ThemeId;
  startsAt: string | null;
  endsAt: string | null;
  hero?: ThemeBlock;
  info?: ThemeBlock;
};

const limits: Record<keyof ThemeBlock, number> = {
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

async function block(value: unknown): Promise<ThemeBlock | undefined> {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid theme block');
  const input = value as Record<string, unknown>;
  const result: ThemeBlock = {};
  for (const key of Object.keys(limits) as (keyof ThemeBlock)[]) {
    const raw = input[key];
    if (raw === undefined || raw === null || raw === '') continue;
    if (typeof raw !== 'string' || raw.length > limits[key])
      throw new BadRequestException(`Invalid theme ${key}`);
    result[key] = raw.trim();
  }
  if (result.link && !safeLink(result.link))
    throw new BadRequestException('Theme link must be internal or HTTPS');
  if (result.imageDataUrl) {
    const normalized = await normalizeProductPhoto(result.imageDataUrl);
    result.imageDataUrl = `data:image/jpeg;base64,${normalized.toString('base64')}`;
  }
  return Object.keys(result).length ? result : undefined;
}

export async function validatePresentation(
  value: unknown,
): Promise<ThemePresentation> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid storefront theme');
  const input = value as Record<string, unknown>;
  if (!themeIds.includes(input.id as ThemeId))
    throw new BadRequestException('Unknown storefront theme');
  const startsAt = input.startsAt ? new Date(String(input.startsAt)) : null;
  const endsAt = input.endsAt ? new Date(String(input.endsAt)) : null;
  if (
    Boolean(startsAt) !== Boolean(endsAt) ||
    (startsAt &&
      endsAt &&
      (!Number.isFinite(startsAt.getTime()) ||
        !Number.isFinite(endsAt.getTime()) ||
        startsAt >= endsAt))
  )
    throw new BadRequestException('Theme start must be before its end');
  return {
    id: input.id as ThemeId,
    startsAt: startsAt?.toISOString() ?? null,
    endsAt: endsAt?.toISOString() ?? null,
    ...(await block(input.hero).then((hero) => (hero ? { hero } : {}))),
    ...(await block(input.info).then((info) => (info ? { info } : {}))),
  };
}

export function savedPresentation(row: any): ThemePresentation {
  return {
    id: row.theme as ThemeId,
    startsAt: row.themeStartsAt
      ? new Date(row.themeStartsAt).toISOString()
      : null,
    endsAt: row.themeEndsAt ? new Date(row.themeEndsAt).toISOString() : null,
    ...(row.themeContent || {}),
  };
}

export function activePresentation(row: any, now = new Date()) {
  const saved = savedPresentation(row);
  const active =
    (!saved.startsAt && !saved.endsAt) ||
    (saved.startsAt &&
      saved.endsAt &&
      now >= new Date(saved.startsAt) &&
      now < new Date(saved.endsAt));
  return active ? saved : { id: 'base' as const };
}
