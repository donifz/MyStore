import Link from 'next/link';
import type { Product } from '../../lib/public-api';
import Icon from './Icon';
import ProductPhoto from './ProductPhoto';

export default function MarketplaceHero({
  products = [],
  shops = false,
  compact = false,
}: {
  products?: Product[];
  shops?: boolean;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <section className="sf-home-hero">
        <span
          className="sf-hero-carousel-btn sf-hero-carousel-btn--prev"
          aria-hidden="true"
        >
          <Icon name="chevronLeft" width={18} height={18} />
        </span>
        <div className="sf-home-hero__copy">
          <span className="sf-hero-tag">МАРКЕТПЛЕЙС МАГАЗИНОВ</span>
          <h1>Товары рядом</h1>
          <p>Смотрите наличие и забирайте в магазине</p>
          <Link className="sf-button sf-button--primary" href="#catalog">
            Смотреть товары <Icon name="arrow" width={18} height={18} />
          </Link>
        </div>
        <div className="sf-home-hero__scene" aria-hidden="true">
          <svg viewBox="0 0 560 250" className="sf-home-hero__svg" fill="none">
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
            {/* Studio floor reflection */}
            <ellipse
              cx="290"
              cy="222"
              rx="235"
              ry="18"
              fill="#93c5fd"
              opacity="0.35"
            />
            {/* Colorful stack pyramid on right-back */}
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
            <rect x="428" y="88" width="28" height="18" rx="9" fill="#ef4444" />
            <circle cx="442" cy="78" r="10" fill="#fde047" />

            {/* Building blocks on left */}
            <rect x="92" y="166" width="54" height="36" rx="5" fill="#1d6bf3" />
            <rect x="100" y="159" width="14" height="8" rx="2" fill="#1557d0" />
            <rect x="122" y="159" width="14" height="8" rx="2" fill="#1557d0" />
            <rect
              x="132"
              y="176"
              width="48"
              height="30"
              rx="5"
              fill="#ef4444"
            />
            <rect x="74" y="182" width="48" height="28" rx="5" fill="#facc15" />

            {/* Center Teddy Bear */}
            <circle cx="212" cy="54" r="22" fill="url(#bearGrad)" />
            <circle cx="212" cy="54" r="12" fill="#f8d8b4" />
            <circle cx="298" cy="54" r="22" fill="url(#bearGrad)" />
            <circle cx="298" cy="54" r="12" fill="#f8d8b4" />
            <ellipse cx="255" cy="158" rx="54" ry="52" fill="url(#bearGrad)" />
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
            <path d="M235 124l20 9 20-9-6 18-14-6-14 6-6-18z" fill="#78350f" />
            <circle cx="198" cy="152" r="18" fill="url(#bearGrad)" />
            <circle cx="312" cy="152" r="18" fill="url(#bearGrad)" />
            <circle cx="216" cy="196" r="22" fill="url(#bearGrad)" />
            <circle cx="216" cy="196" r="12" fill="#f8d8b4" />
            <circle cx="294" cy="196" r="22" fill="url(#bearGrad)" />
            <circle cx="294" cy="196" r="12" fill="#f8d8b4" />

            {/* Interactive Robot */}
            <rect
              x="324"
              y="74"
              width="78"
              height="58"
              rx="26"
              fill="url(#robotBody)"
              stroke="#93c5fd"
              strokeWidth="3"
            />
            <rect
              x="335"
              y="86"
              width="56"
              height="34"
              rx="15"
              fill="#0f172a"
            />
            <path
              d="M346 102c2-4 8-4 10 0M370 102c2-4 8-4 10 0"
              stroke="#38bdf8"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M357 111c3 3 9 3 12 0"
              stroke="#38bdf8"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <rect
              x="332"
              y="136"
              width="62"
              height="56"
              rx="22"
              fill="url(#robotBody)"
              stroke="#93c5fd"
              strokeWidth="3"
            />
            <circle cx="363" cy="162" r="13" fill="#1d6bf3" />
            <circle cx="363" cy="162" r="6" fill="#93c5fd" />
            <rect
              x="340"
              y="192"
              width="18"
              height="18"
              rx="8"
              fill="#1e293b"
            />
            <rect
              x="368"
              y="192"
              width="18"
              height="18"
              rx="8"
              fill="#1e293b"
            />

            {/* Red RC Sports Car on right */}
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
        <span
          className="sf-hero-carousel-btn sf-hero-carousel-btn--next"
          aria-hidden="true"
        >
          <Icon name="chevronRight" width={18} height={18} />
        </span>
        <div className="sf-hero-dots" aria-hidden="true">
          <span className="sf-hero-dot sf-hero-dot--active" />
          <span className="sf-hero-dot" />
          <span className="sf-hero-dot" />
        </div>
      </section>
    );
  }
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
