export type SquareCrop = {
  zoom?: number;
  shiftX?: number;
  shiftY?: number;
};

export function squareCropRect(
  width: number,
  height: number,
  options: SquareCrop = {},
) {
  if (!width || !height) throw new Error('Не удалось прочитать фото.');
  const zoom = Math.min(3, Math.max(1, options.zoom ?? 1));
  const side = Math.min(width, height) / zoom;
  const maxX = (width - side) / 2;
  const maxY = (height - side) / 2;
  const x = maxX * (1 + Math.min(1, Math.max(-1, options.shiftX ?? 0)));
  const y = maxY * (1 + Math.min(1, Math.max(-1, options.shiftY ?? 0)));
  return { x, y, side };
}

export async function photoFrom(file: File, crop: SquareCrop = {}) {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw Error('Выберите JPEG, PNG или WebP размером до 20 МБ.');
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > 64000000)
      throw Error('Фото слишком большое. Выберите снимок до 64 мегапикселей.');
    const { x, y, side } = squareCropRect(image.width, image.height, crop);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('Обработка фото недоступна в этом браузере.');

    // The API stores JPEG. Only the cropped/compressed result is uploaded.
    for (const outputSize of [1024, 896, 768, 640]) {
      canvas.width = Math.min(outputSize, Math.round(side));
      canvas.height = canvas.width;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, x, y, side, side, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.7, 0.6]) {
        const data = canvas.toDataURL('image/jpeg', quality);
        // 512 KiB decoded JPEG limit, including data-URL/base64 overhead.
        if (data.length <= 699074) return data;
      }
    }
    throw Error(
      'Фото слишком большое даже после сжатия. Выберите другой снимок.',
    );
  } finally {
    image.close();
  }
}
