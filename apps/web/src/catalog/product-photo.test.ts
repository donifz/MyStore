import { describe, expect, it, vi } from 'vitest';
import { photoFrom, squareCropRect } from './product-photo';

describe('square product photos', () => {
  it('centers portrait and landscape images in a square', () => {
    expect(squareCropRect(3000, 4000)).toEqual({
      x: 0,
      y: 500,
      side: 3000,
    });
    expect(squareCropRect(4000, 3000)).toEqual({
      x: 500,
      y: 0,
      side: 3000,
    });
  });

  it('allows moving and zooming the crop without exceeding image bounds', () => {
    expect(squareCropRect(4000, 3000, { shiftX: 1 })).toEqual({
      x: 1000,
      y: 0,
      side: 3000,
    });
    expect(squareCropRect(4000, 3000, { shiftX: -1 })).toEqual({
      x: 0,
      y: 0,
      side: 3000,
    });
    const zoomed = squareCropRect(4000, 3000, {
      zoom: 2,
      shiftX: 1,
      shiftY: 1,
    });
    expect(zoomed).toEqual({ x: 2500, y: 1500, side: 1500 });
    expect(squareCropRect(1000, 1000, { zoom: 0.1 })).toEqual({
      x: 0,
      y: 0,
      side: 1000,
    });
  });

  it('encodes only the centered square as a compressed JPEG', async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage,
        fillRect,
        fillStyle: '',
      } as unknown as CanvasRenderingContext2D);
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/jpeg;base64,abcd');
    vi.stubGlobal('createImageBitmap', async () => ({
      width: 3000,
      height: 4000,
      close,
    }));
    try {
      const file = new File(['image'], 'portrait.jpg', { type: 'image/jpeg' });
      await expect(photoFrom(file)).resolves.toBe(
        'data:image/jpeg;base64,abcd',
      );
      expect(drawImage).toHaveBeenCalledWith(
        expect.anything(),
        0,
        500,
        3000,
        3000,
        0,
        0,
        1024,
        1024,
      );
      expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
      expect(close).toHaveBeenCalledOnce();
    } finally {
      getContext.mockRestore();
      toDataURL.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('rejects unsupported input before decoding', async () => {
    const file = new File(['image'], 'photo.gif', { type: 'image/gif' });
    await expect(photoFrom(file)).rejects.toThrow('JPEG, PNG или WebP');
  });
});
