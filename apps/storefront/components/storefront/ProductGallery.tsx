'use client';
import { useEffect, useRef, useState } from 'react';
import type { Product } from '../../lib/public-api';
import { distinctPhotoUrls } from './gallery-photos';
import FavoriteButton from './FavoriteButton';
import Icon from './Icon';
import ProductPhoto from './ProductPhoto';

export default function ProductGallery({
  photoUrl,
  photoUrls,
  name,
  category,
  product,
}: {
  photoUrl?: string;
  photoUrls?: string[];
  name: string;
  category?: string;
  product?: Product;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(0);
  const sourcePhotos = [
    ...new Set(photoUrls?.length ? photoUrls : photoUrl ? [photoUrl] : []),
  ]
    .filter(Boolean)
    .slice(0, 8);
  const photoKey = sourcePhotos.join('|');
  const [uniquePhotos, setUniquePhotos] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setUniquePhotos(null);
    if (sourcePhotos.length < 2) return;
    void distinctPhotoUrls(
      sourcePhotos,
      async (url) => {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Photo unavailable');
        return response.arrayBuffer();
      },
      (bytes) => crypto.subtle.digest('SHA-256', bytes),
    ).then((result) => {
      if (!cancelled) setUniquePhotos(result);
    });
    return () => {
      cancelled = true;
    };
  }, [photoKey]);
  const photos = uniquePhotos ?? sourcePhotos.slice(0, 1);
  const totalSlides = photos.length > 1 ? photos.length : 5;
  const currentIndex = Math.min(active, Math.max(0, totalSlides - 1));
  const photo = photos[Math.min(currentIndex, Math.max(0, photos.length - 1))];

  return (
    <div className="sf-gallery sf-gallery--with-thumbs">
      <div className="sf-gallery-thumbnails" aria-label="Фотографии товара">
        {photos.length > 1
          ? photos.map((url, index) => (
              <button
                key={url}
                type="button"
                aria-label={`Фото ${index + 1} из ${photos.length}`}
                aria-pressed={index === currentIndex}
                onClick={() => setActive(index)}
              >
                <img src={url} alt={`Фото ${index + 1}`} />
              </button>
            ))
          : [0, 1, 2, 3, 4].map((index) => (
              <button
                key={index}
                type="button"
                aria-label={`Вид ${index + 1} из 5`}
                aria-pressed={index === currentIndex}
                onClick={() => setActive(index)}
                className="sf-gallery-thumb-art"
              >
                {photo ? (
                  <img src={photo} alt={`${name} — вид ${index + 1}`} />
                ) : (
                  <ProductPhoto alt={name} category={category} />
                )}
              </button>
            ))}
      </div>
      <div className="sf-gallery-stage">
        {product && <FavoriteButton product={product} />}
        {photo ? (
          <button
            className="sf-gallery-main"
            type="button"
            aria-label="Увеличить фото товара"
            onClick={() => dialog.current?.showModal()}
          >
            <img src={photo} alt={name} />
          </button>
        ) : (
          <div className="sf-gallery-main sf-no-photo">
            <ProductPhoto alt={name} category={category} loading="eager" />
          </div>
        )}
        <button
          type="button"
          className="sf-gallery-nav sf-gallery-nav--prev"
          aria-label="Предыдущее фото"
          onClick={() =>
            setActive((currentIndex - 1 + totalSlides) % totalSlides)
          }
        >
          <Icon name="chevronLeft" width={20} height={20} />
        </button>
        <button
          type="button"
          className="sf-gallery-nav sf-gallery-nav--next"
          aria-label="Следующее фото"
          onClick={() => setActive((currentIndex + 1) % totalSlides)}
        >
          <Icon name="chevronRight" width={20} height={20} />
        </button>
        <span className="sf-gallery-counter" aria-hidden="true">
          {currentIndex + 1}/{totalSlides}
        </span>
      </div>
      {photo && (
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
      )}
    </div>
  );
}
