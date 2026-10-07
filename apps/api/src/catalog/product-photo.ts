import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
export async function normalizeProductPhoto(data: string) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
  if (!match) throw new BadRequestException('JPEG photo required');
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length > 524288)
    throw new BadRequestException('Photo exceeds 512 KiB');
  try {
    const image = sharp(bytes, {
        limitInputPixels: 16000000,
        failOn: 'warning',
      }),
      metadata = await image.metadata();
    if (metadata.format !== 'jpeg') throw Error('Invalid JPEG');
    const normalized = await image
      .rotate()
      .resize({
        width: 1024,
        height: 1024,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    if (normalized.length > 524288) throw Error('Photo too large');
    return normalized;
  } catch {
    throw new BadRequestException('Invalid or oversized photo');
  }
}
