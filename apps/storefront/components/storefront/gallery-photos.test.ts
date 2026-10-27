import { describe, expect, it } from 'vitest';
import { distinctPhotoUrls } from './gallery-photos';

const bytes = (value: string) => new TextEncoder().encode(value).buffer;
const digest = async (buffer: ArrayBuffer) => buffer;

describe('product gallery photos', () => {
  it('shows one photo when separate URLs return identical images', async () => {
    const result = await distinctPhotoUrls(
      ['/photo?index=0', '/photo?index=1', '/photo'],
      async () => bytes('same-image'),
      digest,
    );
    expect(result).toEqual(['/photo?index=0']);
  });

  it('retains distinct images and keeps original ordering', async () => {
    const result = await distinctPhotoUrls(
      ['/photo?index=0', '/photo?index=1', '/photo?index=2'],
      async (url) => bytes(url.endsWith('2') ? 'second' : 'first'),
      digest,
    );
    expect(result).toEqual(['/photo?index=0', '/photo?index=2']);
  });

  it('retains an inaccessible image rather than discarding it', async () => {
    const result = await distinctPhotoUrls(
      ['/first', '/unavailable'],
      async (url) => {
        if (url === '/unavailable') throw new Error('network error');
        return bytes('first');
      },
      digest,
    );
    expect(result).toEqual(['/first', '/unavailable']);
  });
});
