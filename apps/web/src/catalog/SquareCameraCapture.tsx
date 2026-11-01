import { useEffect, useRef, useState } from 'react';
import { photoFrom } from './product-photo';

type Props = {
  onPhoto: (dataUrl: string) => void;
  onClose: () => void;
  onFallback: () => void;
};

export default function SquareCameraCapture({
  onPhoto,
  onClose,
  onFallback,
}: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Камера недоступна. Попробуйте системную камеру.');
    } else {
      void navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        })
        .then(async (media) => {
          if (stopped) {
            media.getTracks().forEach((track) => track.stop());
            return;
          }
          stream = media;
          if (video.current) {
            video.current.srcObject = media;
            await video.current.play();
            if (!stopped) setReady(true);
          }
        })
        .catch(() => {
          if (!stopped)
            setError(
              'Не удалось включить камеру. Проверьте разрешение или откройте системную камеру.',
            );
        });
    }
    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
      document.body.style.overflow = previous;
    };
  }, []);

  async function capture() {
    const source = video.current;
    if (!source?.videoWidth || !source.videoHeight || busy) return;
    setBusy(true);
    setError('');
    try {
      const side = Math.min(source.videoWidth, source.videoHeight);
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Обработка фото недоступна.');
      ctx.drawImage(
        source,
        (source.videoWidth - side) / 2,
        (source.videoHeight - side) / 2,
        side,
        side,
        0,
        0,
        1024,
        1024,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error('Не удалось сделать снимок.')),
          'image/jpeg',
          0.85,
        ),
      );
      const data = await photoFrom(
        new File([blob], 'product-square.jpg', { type: 'image/jpeg' }),
      );
      onPhoto(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сделать снимок.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="product-crop-root"
      role="dialog"
      aria-modal="true"
      aria-label="Камера товара"
    >
      <div className="product-crop-backdrop" />
      <section className="product-crop-dialog">
        <header className="product-crop-header">
          <div>
            <h2>Сфотографировать товар</h2>
            <p className="muted">Поместите товар целиком в квадрат</p>
          </div>
          <button
            type="button"
            className="product-crop-close"
            aria-label="Закрыть камеру"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="product-camera-frame">
          <video ref={video} muted playsInline autoPlay />
          <div className="product-camera-guide" aria-hidden="true" />
          {!ready && !error && (
            <span className="product-camera-loading">Включаем камеру…</span>
          )}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="product-crop-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              onClose();
              onFallback();
            }}
          >
            Системная камера
          </button>
          <button
            type="button"
            className="primary"
            disabled={!ready || busy}
            onClick={() => void capture()}
          >
            {busy ? 'Сжимаем…' : 'Сфотографировать'}
          </button>
        </div>
      </section>
    </div>
  );
}
