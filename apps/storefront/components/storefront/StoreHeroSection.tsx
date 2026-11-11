'use client';
import { useState, useEffect } from 'react';
import type { Store } from '../../lib/public-api';
import Icon from './Icon';

export default function StoreHeroSection({
  store,
  hasBanner,
  children,
}: {
  store: Store;
  hasBanner: boolean;
  children?: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<'catalog' | 'about' | 'reviews'>(
    'catalog',
  );
  const [isFollowed, setIsFollowed] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mystore_followed_shops');
      if (stored) {
        const list: string[] = JSON.parse(stored);
        if (Array.isArray(list) && list.includes(store.slug)) {
          setIsFollowed(true);
        }
      }
    } catch {}
  }, [store.slug]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const toggleFollow = () => {
    try {
      const stored = localStorage.getItem('mystore_followed_shops');
      let list: string[] = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(list)) list = [];
      if (isFollowed) {
        list = list.filter((s) => s !== store.slug);
        setIsFollowed(false);
        showToast('Вы отписались от магазина');
      } else {
        if (!list.includes(store.slug)) list.push(store.slug);
        setIsFollowed(true);
        showToast('Вы подписались на обновления магазина');
      }
      localStorage.setItem('mystore_followed_shops', JSON.stringify(list));
    } catch {}
  };

  const shareShop = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: store.name,
          text: store.description || `Магазин ${store.name} на MyStore`,
          url,
        });
        return;
      } catch {}
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        showToast('Ссылка на магазин скопирована в буфер!');
      } catch {
        showToast('Не удалось скопировать ссылку');
      }
    }
  };

  const phone = store.phone?.replace(/[^\d+]/g, '');

  return (
    <div
      className={`sf-store-header-container ${hasBanner ? 'sf-store-header-container--with-banner' : ''}`}
    >
      {hasBanner && <h1 className="sf-store-sr-heading">{store.name}</h1>}
      {children}
      {!hasBanner && (
        <div className="sf-store-identity-bar">
          <div className="sf-store-identity-copy">
            <div className="sf-store-title-row">
              <h1 className="sf-store-visible-heading">{store.name}</h1>
              <span
                className="sf-verified-badge"
                title="Проверенный магазин"
                aria-hidden="true"
              >
                <Icon name="check" width={14} height={14} />
              </span>
            </div>
            {store.description && (
              <p className="sf-store-subtitle">{store.description}</p>
            )}
            {store.ratingCount && store.ratingCount > 0 ? (
              <div className="sf-store-rating-row">
                <span className="sf-star-glyph" aria-hidden="true">
                  ★
                </span>
                <strong>
                  {(store.ratingAverage || 5).toFixed(1).replace('.', ',')}
                </strong>
                <span>({store.ratingCount} отзывов)</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
      <div className="sf-store-hero-bar">
        <div
          className="sf-store-tabs"
          role="tablist"
          aria-label="Разделы магазина"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'catalog'}
            className={`sf-store-tab ${activeTab === 'catalog' ? 'sf-store-tab--active' : ''}`}
            onClick={() => {
              setActiveTab('catalog');
              const el = document.getElementById('catalog');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Товары
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'about'}
            className={`sf-store-tab ${activeTab === 'about' ? 'sf-store-tab--active' : ''}`}
            onClick={() =>
              setActiveTab((prev) => (prev === 'about' ? 'catalog' : 'about'))
            }
          >
            О магазине
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reviews'}
            className={`sf-store-tab ${activeTab === 'reviews' ? 'sf-store-tab--active' : ''}`}
            onClick={() => {
              setActiveTab('reviews');
              const el = document.getElementById('store-reviews');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Отзывы{' '}
            {store.ratingCount && store.ratingCount > 0
              ? `(${store.ratingCount})`
              : ''}
          </button>
        </div>
        <div className="sf-store-bar-actions">
          {phone && (
            <a
              className="sf-store-phone-link"
              href={'tel:' + phone}
              aria-label={`Позвонить в ${store.name}`}
              title={store.phone}
            >
              <Icon name="phone" width={16} height={16} />
            </a>
          )}
          <button
            type="button"
            className={`sf-store-follow-btn ${isFollowed ? 'sf-store-follow-btn--active' : ''}`}
            onClick={toggleFollow}
            aria-pressed={isFollowed}
          >
            <Icon
              name={isFollowed ? 'check' : 'heart'}
              width={16}
              height={16}
            />
            <span>{isFollowed ? 'Вы подписаны' : 'Подписаться'}</span>
          </button>
          <button
            type="button"
            className="sf-store-share-btn"
            onClick={shareShop}
            aria-label="Поделиться магазином"
            title="Поделиться"
          >
            <Icon name="share" width={16} height={16} />
          </button>
        </div>
      </div>
      {activeTab === 'about' && (
        <div id="store-about" className="sf-store-info-drawer">
          <div className="sf-store-info-grid">
            {store.description && (
              <div className="sf-store-info-item">
                <span className="sf-store-info-label">Описание</span>
                <p>{store.description}</p>
              </div>
            )}
            <div className="sf-store-info-item">
              <span className="sf-store-info-label">Город и адрес</span>
              <p>
                <Icon name="pin" width={15} height={15} />
                <span>
                  {store.city}
                  {store.address ? `, ${store.address}` : ''}
                </span>
              </p>
            </div>
            <div className="sf-store-info-item">
              <span className="sf-store-info-label">Режим работы</span>
              <p>
                <Icon name="clock" width={15} height={15} />
                <span>{store.hours || 'Пн-Вс: 10:00 — 21:00'}</span>
              </p>
            </div>
            {store.phone && (
              <div className="sf-store-info-item">
                <span className="sf-store-info-label">Телефон</span>
                <p>
                  <Icon name="phone" width={15} height={15} />
                  <a href={'tel:' + phone}>{store.phone}</a>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {toastMessage && (
        <div className="sf-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
