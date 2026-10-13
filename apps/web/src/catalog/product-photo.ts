export async function photoFrom(file: File) {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw Error('Выберите JPEG, PNG или WebP размером до 20 МБ.');
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > 16000000)
      throw Error('Фото слишком большое. Выберите снимок до 16 мегапикселей.');
    const canvas = document.createElement('canvas'),
      scale = Math.min(1, 1024 / image.width, 1024 / image.height);
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('Камера недоступна в этом браузере.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.8);
    if (data.length > 699074)
      throw Error('Фото слишком большое. Сделайте более простой снимок.');
    return data;
  } finally {
    image.close();
  }
}
