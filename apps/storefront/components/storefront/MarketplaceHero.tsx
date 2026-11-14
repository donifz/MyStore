'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Product, HeroSlide } from '../../lib/public-api';
import Icon from './Icon';
import ProductPhoto from './ProductPhoto';

const GRADIENTS: Record<string, string> = {
  blue: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
  indigo: 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)',
  emerald: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
  amber: 'linear-gradient(135deg, #92400e 0%, #f59e0b 100%)',
  rose: 'linear-gradient(135deg, #9f1239 0%, #f43f5e 100%)',
  purple: 'linear-gradient(135deg, #581c87 0%, #9333ea 100%)',
};

const DEFAULT_SLIDES: HeroSlide[] = [
  {
    sortOrder: 0,
    isActive: true,
    badge: 'МАРКЕТПЛЕЙС МАГАЗИНОВ',
    title: 'Товары рядом',
    subtitle: 'Смотрите наличие и забирайте в магазине',
    buttonText: 'Смотреть товары',
    buttonUrl: '#catalog',
    imageUrl: '/banners/banner-shops.jpg',
    bgGradient: 'blue',
  },
  {
    sortOrder: 1,
    isActive: true,
    badge: 'СКИДКИ И АКЦИИ',
    title: 'Скидки до 50%',
    subtitle: 'Сезонные предложения от магазинов вашего города',
    buttonText: 'Смотреть скидки',
    buttonUrl: '#catalog',
    imageUrl: '/banners/banner-sale.jpg',
    bgGradient: 'indigo',
  },
  {
    sortOrder: 2,
    isActive: true,
    badge: 'БЫСТРАЯ ВЫДАЧА',
    title: 'Быстрая доставка',
    subtitle: 'Забирайте сами или закажите курьером прямо до двери',
    buttonText: 'Магазины рядом',
    buttonUrl: '/shops',
    imageUrl: '/banners/banner-delivery.jpg',
    bgGradient: 'emerald',
  },
];

export default function MarketplaceHero({
  products = [],
  shops = false,
  compact = false,
  slides,
}: {
  products?: Product[];
  shops?: boolean;
  compact?: boolean;
  slides?: HeroSlide[];
}) {
  const activeSlides = (
    slides && slides.length > 0 ? slides : DEFAULT_SLIDES
  ).filter((s) => s.isActive !== false);
  const slideList = activeSlides.length > 0 ? activeSlides : DEFAULT_SLIDES;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentIdx >= slideList.length) {
      setCurrentIdx(Math.max(0, slideList.length - 1));
    }
  }, [slideList.length, currentIdx]);

  const nextSlide = useCallback(() => {
    setCurrentIdx((prev) => (prev + 1) % slideList.length);
  }, [slideList.length]);

  const prevSlide = useCallback(() => {
    setCurrentIdx((prev) => (prev - 1 + slideList.length) % slideList.length);
  }, [slideList.length]);

  useEffect(() => {
    if (isPaused || slideList.length <= 1) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused, slideList.length, nextSlide]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    if (deltaX < -40) {
      nextSlide();
    } else if (deltaX > 40) {
      prevSlide();
    }
    touchStartXRef.current = null;
  };

  if (compact) {
    const current = slideList[currentIdx] || slideList[0];
    const isCustomGradient =
      current.bgGradient &&
      current.bgGradient !== 'studio' &&
      GRADIENTS[current.bgGradient];
    const hasImage = Boolean(current.imageUrl);
    const hasMobileImage = Boolean(current.mobileImageUrl);
    const hideOverlay = Boolean(current.hideOverlay);
    const onlyImage = Boolean(current.onlyImage);
    const isLightText = (hasImage || isCustomGradient) && !hideOverlay;

    const desktopBg = hasImage
      ? hideOverlay
        ? `url("${current.imageUrl}")`
        : `linear-gradient(rgba(15, 23, 42, 0.65), rgba(15, 23, 42, 0.70)), url("${current.imageUrl}")`
      : isCustomGradient
        ? GRADIENTS[current.bgGradient]
        : undefined;

    const mobileBg = hasMobileImage
      ? hideOverlay
        ? `url("${current.mobileImageUrl}")`
        : `linear-gradient(rgba(15, 23, 42, 0.65), rgba(15, 23, 42, 0.70)), url("${current.mobileImageUrl}")`
      : desktopBg;

    const customBgStyle: React.CSSProperties &
      Record<
        '--sf-hero-bg-desktop' | '--sf-hero-bg-mobile',
        string | undefined
      > = {} as any;
    if (desktopBg) {
      customBgStyle['--sf-hero-bg-desktop'] = desktopBg;
      customBgStyle['--sf-hero-bg-mobile'] = mobileBg || desktopBg;
      customBgStyle.backgroundImage = desktopBg;
      customBgStyle.backgroundSize = 'cover';
      customBgStyle.backgroundPosition = 'center';
      customBgStyle.backgroundRepeat = 'no-repeat';
    }

    return (
      <section
        className={`sf-home-hero ${isLightText ? 'sf-home-hero--light-text' : ''} ${onlyImage ? 'sf-home-hero--only-image' : ''} ${hideOverlay ? 'sf-home-hero--no-overlay' : ''} ${hasImage || hasMobileImage ? 'sf-home-hero--has-image' : ''}`}
        style={desktopBg ? customBgStyle : undefined}
        data-has-custom-bg={Boolean(desktopBg)}
        data-has-image={Boolean(hasImage || hasMobileImage)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="region"
        aria-roledescription="carousel"
        aria-label="Промо-баннеры"
      >
        {slideList.length > 1 && (
          <button
            type="button"
            className="sf-hero-carousel-btn sf-hero-carousel-btn--prev"
            aria-label="Предыдущий слайд"
            onClick={prevSlide}
          >
            <Icon name="chevronLeft" width={18} height={18} />
          </button>
        )}

        {onlyImage ? (
          <Link
            href={current.buttonUrl || '#catalog'}
            className="sf-home-hero__pure-link"
            aria-label={current.title || 'Перейти к покупкам'}
          />
        ) : (
          <div
            key={currentIdx}
            className="sf-home-hero__copy sf-home-hero__slide-fade"
          >
            {current.badge && (
              <span className="sf-hero-tag">{current.badge}</span>
            )}
            <h1>{current.title}</h1>
            <p>{current.subtitle}</p>
            {current.buttonText && current.buttonUrl && (
              <Link
                className="sf-button sf-button--primary"
                href={current.buttonUrl}
              >
                {current.buttonText}{' '}
                <Icon name="arrow" width={18} height={18} />
              </Link>
            )}
          </div>
        )}

        {!hasImage &&
          !hasMobileImage &&
          !onlyImage &&
          (!isCustomGradient || current.bgGradient === 'studio') && (
            <div className="sf-home-hero__scene" aria-hidden="true">
              <svg
                viewBox="0 0 560 250"
                className="sf-home-hero__svg"
                fill="none"
              >
                <defs>
                  <radialGradient id="heroGlow" cx="55%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#dbeafe" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="bearGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#e5b074" />
                    <stop offset="100%" stopColor="#b97d3e" />
                  </linearGradient>
                  <linearGradient id="robotBody" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#dbeafe" />
                  </linearGradient>
                  <linearGradient id="carBody" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#b91c1c" />
                  </linearGradient>
                </defs>
                <ellipse
                  cx="300"
                  cy="125"
                  rx="240"
                  ry="115"
                  fill="url(#heroGlow)"
                />
                <ellipse
                  cx="290"
                  cy="222"
                  rx="235"
                  ry="18"
                  fill="#93c5fd"
                  opacity="0.35"
                />
                <rect
                  x="404"
                  y="160"
                  width="76"
                  height="18"
                  rx="9"
                  fill="#3b82f6"
                />
                <rect
                  x="410"
                  y="142"
                  width="64"
                  height="18"
                  rx="9"
                  fill="#22c55e"
                />
                <rect
                  x="416"
                  y="124"
                  width="52"
                  height="18"
                  rx="9"
                  fill="#eab308"
                />
                <rect
                  x="422"
                  y="106"
                  width="40"
                  height="18"
                  rx="9"
                  fill="#f97316"
                />
                <rect
                  x="428"
                  y="88"
                  width="28"
                  height="18"
                  rx="9"
                  fill="#ef4444"
                />
                <circle cx="442" cy="78" r="10" fill="#fde047" />

                <rect
                  x="92"
                  y="166"
                  width="54"
                  height="36"
                  rx="5"
                  fill="#1d6bf3"
                />
                <rect
                  x="100"
                  y="159"
                  width="14"
                  height="8"
                  rx="2"
                  fill="#1557d0"
                />
                <rect
                  x="122"
                  y="159"
                  width="14"
                  height="8"
                  rx="2"
                  fill="#1557d0"
                />
                <rect
                  x="132"
                  y="176"
                  width="48"
                  height="30"
                  rx="5"
                  fill="#ef4444"
                />
                <rect
                  x="74"
                  y="182"
                  width="48"
                  height="28"
                  rx="5"
                  fill="#facc15"
                />

                <circle cx="212" cy="54" r="22" fill="url(#bearGrad)" />
                <circle cx="212" cy="54" r="12" fill="#f8d8b4" />
                <circle cx="298" cy="54" r="22" fill="url(#bearGrad)" />
                <circle cx="298" cy="54" r="12" fill="#f8d8b4" />
                <ellipse
                  cx="255"
                  cy="158"
                  rx="54"
                  ry="52"
                  fill="url(#bearGrad)"
                />
                <ellipse cx="255" cy="164" rx="32" ry="30" fill="#f8d8b4" />
                <circle cx="255" cy="90" r="44" fill="url(#bearGrad)" />
                <ellipse cx="255" cy="100" rx="20" ry="16" fill="#f8d8b4" />
                <circle cx="239" cy="82" r="5.5" fill="#1e293b" />
                <circle cx="271" cy="82" r="5.5" fill="#1e293b" />
                <ellipse cx="255" cy="95" rx="8" ry="5.5" fill="#451a03" />
                <path
                  d="M247 104c4 4 12 4 16 0"
                  stroke="#451a03"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <path
                  d="M235 124l20 9 20-9-6 18-14-6-14 6-6-18z"
                  fill="#78350f"
                />
                <circle cx="198" cy="152" r="18" fill="url(#bearGrad)" />
                <circle cx="312" cy="152" r="18" fill="url(#bearGrad)" />
                <circle cx="216" cy="196" r="22" fill="url(#bearGrad)" />
                <circle cx="216" cy="196" r="12" fill="#f8d8b4" />
                <circle cx="294" cy="196" r="22" fill="url(#bearGrad)" />
                <circle cx="294" cy="196" r="12" fill="#f8d8b4" />

                <rect
                  x="324"
                  y="74"
                  width="78"
                  height="58"
                  rx="26"
                  fill="url(#robotBody)"
                  stroke="#93c5fd"
                  strokeWidth="2"
                />
                <rect
                  x="338"
                  y="88"
                  width="50"
                  height="26"
                  rx="8"
                  fill="#1e293b"
                />
                <circle cx="350" cy="101" r="5" fill="#38bdf8" />
                <circle cx="376" cy="101" r="5" fill="#38bdf8" />
                <rect
                  x="358"
                  y="58"
                  width="10"
                  height="16"
                  rx="4"
                  fill="#93c5fd"
                />
                <circle cx="363" cy="54" r="6" fill="#f43f5e" />
                <rect
                  x="332"
                  y="136"
                  width="62"
                  height="66"
                  rx="16"
                  fill="url(#robotBody)"
                  stroke="#93c5fd"
                  strokeWidth="2"
                />
                <circle cx="363" cy="164" r="12" fill="#38bdf8" opacity="0.8" />

                <path
                  d="M412 186l16-24c4-6 11-9 18-9h48c7 0 14 3 18 9l16 14c5 4 8 9 8 15v9c0 4-3 7-7 7H415c-4 0-7-3-7-7v-14z"
                  fill="url(#carBody)"
                />
                <path d="M434 158h46l14 18h-70l10-18z" fill="#1e293b" />
                <circle cx="436" cy="204" r="17" fill="#0f172a" />
                <circle cx="436" cy="204" r="8" fill="#cbd5e1" />
                <circle cx="506" cy="204" r="17" fill="#0f172a" />
                <circle cx="506" cy="204" r="8" fill="#cbd5e1" />
              </svg>
            </div>
          )}

        {slideList.length > 1 && (
          <button
            type="button"
            className="sf-hero-carousel-btn sf-hero-carousel-btn--next"
            aria-label="Следующий слайд"
            onClick={nextSlide}
          >
            <Icon name="chevronRight" width={18} height={18} />
          </button>
        )}

        {slideList.length > 1 && (
          <div className="sf-hero-dots" role="tablist" aria-label="Слайды">
            {slideList.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === currentIdx}
                aria-label={`Слайд ${i + 1}`}
                className={`sf-hero-dot ${i === currentIdx ? 'sf-hero-dot--active' : ''}`}
                onClick={() => setCurrentIdx(i)}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  // Non-compact (full page / shops view)
  const photos = products.filter((p) => p.photoUrl).slice(0, 3);
  return (
    <div className="sf-hero-layout">
      <section className="sf-market-hero">
        <div className="sf-market-hero-copy">
          <p className="sf-eyebrow">
            {shops
              ? 'Локальный бизнес. Большой выбор.'
              : 'Покупайте у местных магазинов'}
          </p>
          <h1>
            {shops ? (
              <>
                Магазины рядом.
                <br />
                <em>Находки для вас.</em>
              </>
            ) : (
              <>
                Товары рядом
                <br />
                <em>от разных магазинов</em>
              </>
            )}
          </h1>
          <p>
            {shops
              ? 'Знакомьтесь с продавцами вашего города, смотрите ассортимент и выбирайте удобный способ получения.'
              : 'Всё, что нужно, — в одном месте. Выбирайте, сравнивайте цены и заказывайте у магазинов рядом.'}
          </p>
          <Link
            className="sf-button sf-button--primary"
            href={shops ? '#shops' : '#catalog'}
          >
            {shops ? 'Выбрать магазин' : 'Перейти к товарам'}
            <Icon name="arrow" />
          </Link>
        </div>
        <div className="sf-market-art" aria-hidden="true">
          <div className="sf-art-orbit" />
          <div className="sf-shopping-bag">
            <span>
              <Icon name="bag" width={54} height={54} />
            </span>
            <strong>MyStore</strong>
            <small>Хорошие находки рядом</small>
          </div>
          {!photos.length ? (
            <div className="sf-art-showcase">
              <div className="sf-art-chip sf-art-chip--1">
                <span className="sf-art-chip-icon">
                  <Icon name="shop" width={16} height={16} />
                </span>
                <div>
                  <strong>Реальные магазины</strong>
                  <small>Витрины вашего города</small>
                </div>
              </div>
              <div className="sf-art-chip sf-art-chip--2">
                <span className="sf-art-chip-icon">
                  <Icon name="box" width={16} height={16} />
                </span>
                <div>
                  <strong>Честный остаток</strong>
                  <small>Данные из кассы</small>
                </div>
              </div>
              <div className="sf-art-chip sf-art-chip--3">
                <span className="sf-art-chip-icon">
                  <Icon name="truck" width={16} height={16} />
                </span>
                <div>
                  <strong>Быстрое получение</strong>
                  <small>Самовывоз и доставка</small>
                </div>
              </div>
            </div>
          ) : (
            photos.map((p, i) => (
              <div key={p.id} className={`sf-art-product sf-art-product--${i}`}>
                <ProductPhoto src={p.photoUrl} alt="" />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
