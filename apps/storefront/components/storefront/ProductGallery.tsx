'use client';
import { useRef, useState } from 'react';
import Icon from './Icon';
export default function ProductGallery({
  photoUrl,
  photoUrls,
  name,
}: {
  photoUrl?: string;
  photoUrls?: string[];
  name: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(0);
  const photos = [...new Set([...(photoUrls ?? []), ...(photoUrl ? [photoUrl] : [])])]
    .filter(Boolean)
    .slice(0, 8);
  const photo = photos[Math.min(active, photos.length - 1)];
  return (
    <div className="sf-gallery">
      {photo ? (
        <>
          <button
            className="sf-gallery-main"
            type="button"
            aria-label="Увеличить фото товара"
            onClick={() => dialog.current?.showModal()}
          >
            <img src={photo} alt={name} />
          </button>
          <div className="sf-gallery-thumbnails" aria-label="Фотографии товара">
            {photos.map((url, index) => (
              <button
                key={url}
                type="button"
                aria-label={`Фото ${index + 1} из ${photos.length}`}
                aria-pressed={index === active}
                onClick={() => setActive(index)}
              >
                <img src={url} alt={`Фото ${index + 1}`} />
              </button>
            ))}
            {photos.length === 1 && <small>Нажмите на фото, чтобы рассмотреть</small>}
          </div>
          <dialog
            ref={dialog}
            className="sf-photo-dialog"
            onClick={(e) => {
              if (e.target === e.currentTarget) dialog.current?.close();
            }}
          >
            <button
              type="button"
              className="sf-button sf-button--secondary"
              onClick={() => dialog.current?.close()}
            >
              Закрыть ×
            </button>
            <img src={photo} alt={name} />
          </dialog>
        </>
      ) : (
        <div className="sf-gallery-main sf-no-photo">
          <Icon name="box" width={80} height={80} />
          <span>Магазин пока не добавил фото</span>
        </div>
      )}
    </div>
  );
}
