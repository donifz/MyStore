import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { photoFrom, squareCropRect } from './product-photo';

type Props = {
  file: File;
  onConfirm: (dataUrl: string) => void | Promise<void>;
  onCancel: () => void;
};

export default function SquarePhotoCropper({
  file,
  onConfirm,
  onCancel,
}: Props) {
  const [preview, setPreview] = useState('');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [shiftX, setShiftX] = useState(0);
  const [shiftY, setShiftY] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    shiftX: number;
    shiftY: number;
  } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    setZoom(1);
    setShiftX(0);
    setShiftY(0);
    setError('');
    let disposed = false;
    void createImageBitmap(file)
      .then((bitmap) => {
        if (!disposed)
          setDimensions({ width: bitmap.width, height: bitmap.height });
        bitmap.close();
      })
      .catch(() => {
        if (!disposed) setError('Не удалось прочитать изображение.');
      });
    return () => {
      disposed = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const sourceSide = Math.min(dimensions.width, dimensions.height);
  const rect =
    sourceSide > 0
      ? squareCropRect(dimensions.width, dimensions.height, {
          zoom,
          shiftX,
          shiftY,
        })
      : null;
  const offsetX = rect
    ? (((rect.x + rect.side / 2 - dimensions.width / 2) * zoom) / sourceSide) *
      100
    : 0;
  const offsetY = rect
    ? (((rect.y + rect.side / 2 - dimensions.height / 2) * zoom) / sourceSide) *
      100
    : 0;

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || !frame.current || !rect) return;
    const width = frame.current.getBoundingClientRect().width;
    const maxX = (dimensions.width - rect.side) / 2;
    const maxY = (dimensions.height - rect.side) / 2;
    if (maxX > 0)
      setShiftX(
        Math.max(
          -1,
          Math.min(
            1,
            drag.current.shiftX -
              ((e.clientX - drag.current.x) * rect.side) / (width * maxX),
          ),
        ),
      );
    if (maxY > 0)
      setShiftY(
        Math.max(
          -1,
          Math.min(
            1,
            drag.current.shiftY -
              ((e.clientY - drag.current.y) * rect.side) / (width * maxY),
          ),
        ),
      );
  }

  async function confirm() {
    if (busy || !rect) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm(await photoFrom(file, { zoom, shiftX, shiftY }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обработать фото.');
    } finally {
      setBusy(false);
    }
  }

  const overlay = (
    <div
      className="product-crop-root"
      role="dialog"
      aria-modal="true"
      aria-label="Обрезка фотографии товара"
    >
      <div className="product-crop-backdrop" />
      <section className="product-crop-dialog">
        <header className="product-crop-header">
          <div>
            <h2>Фото товара · 1:1</h2>
            <p className="muted">Поместите весь товар внутрь квадрата</p>
          </div>
          <button
            type="button"
            aria-label="Отменить обрезку"
            className="product-crop-close"
            disabled={busy}
            onClick={onCancel}
          >
            ×
          </button>
        </header>
        <div
          ref={frame}
          className="product-crop-frame"
          role="img"
          aria-label="Квадратная область обрезки. Перетащите фото для перемещения."
          onPointerDown={(e) => {
            if (!rect || busy) return;
            drag.current = { x: e.clientX, y: e.clientY, shiftX, shiftY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {preview && sourceSide > 0 && (
            <img
              src={preview}
              alt=""
              draggable={false}
              style={{
                width: (dimensions.width / sourceSide) * zoom * 100 + '%',
                height: (dimensions.height / sourceSide) * zoom * 100 + '%',
                left: 50 - offsetX + '%',
                top: 50 - offsetY + '%',
              }}
            />
          )}
          <div className="product-crop-guide" aria-hidden="true" />
        </div>
        <label className="product-crop-zoom">
          <span>Масштаб</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            disabled={busy}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <p className="muted product-crop-hint">
          Переместите фото пальцем. Сохраним только квадратный сжатый JPEG,
          оригинал на сервер не отправляется.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="product-crop-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Отмена
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy || !rect}
            onClick={() => void confirm()}
          >
            {busy ? 'Сжимаем…' : 'Использовать фото'}
          </button>
        </div>
      </section>
    </div>
  );
  return createPortal(overlay, document.body);
}
