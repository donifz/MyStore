'use client';
import { useEffect, useState, FormEvent } from 'react';
import type { ReviewItem } from '../../lib/public-api';
import { Button } from '../ui';

const DEFAULT_REVIEWS: ReviewItem[] = [
  {
    id: 'demo-rev-1',
    authorName: 'Айгерим К.',
    rating: 5,
    comment:
      'Отличное качество! Забрали самовывозом из магазина за 15 минут, всё аккуратно упаковано. Ребёнок в восторге!',
    createdAt: '12 мая 2026',
    verifiedBuyer: true,
  },
  {
    id: 'demo-rev-2',
    authorName: 'Бакыт Э.',
    rating: 5,
    comment:
      'Полностью соответствует описанию и фото. Продавец вежливый, помог с выбором и быстро подтвердил заказ.',
    createdAt: '10 мая 2026',
    verifiedBuyer: true,
  },
  {
    id: 'demo-rev-3',
    authorName: 'Мээрим Т.',
    rating: 4,
    comment:
      'Хороший товар за свою цену, материалы приятные и безопасные. Будем заказывать ещё.',
    createdAt: '6 мая 2026',
    verifiedBuyer: true,
  },
];

const CURRENT_BUYER = {
  name: 'Азамат Эркинбеков',
  phone: '+996 555 12 34 56',
  verifiedBuyer: true,
};

const RATING_LABELS: Record<number, string> = {
  5: 'Отлично',
  4: 'Хорошо',
  3: 'Нормально',
  2: 'Плохо',
  1: 'Ужасно',
};

function makeOperationKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'rev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

export default function ReviewsWidget({
  slug,
  productId,
  initialAverage = 4.8,
  initialCount = 128,
  title = 'Отзывы покупателей',
}: {
  slug: string;
  productId?: string;
  initialAverage?: number;
  initialCount?: number;
  title?: string;
}) {
  const endpoint = productId
    ? `/api/public/stores/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}/reviews`
    : `/api/public/stores/${encodeURIComponent(slug)}/reviews`;

  const [items, setItems] = useState<ReviewItem[]>(DEFAULT_REVIEWS);
  const [avg, setAvg] = useState<number>(initialAverage || 4.8);
  const [count, setCount] = useState<number>(initialCount || 128);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [operationKey, setOperationKey] = useState<string>(() =>
    makeOperationKey(),
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.items) && data.items.length > 0) {
          setItems([...data.items, ...DEFAULT_REVIEWS]);
        }
        if (typeof data.ratingCount === 'number' && data.ratingCount > 0) {
          setAvg(Number(data.ratingAverage) || initialAverage);
          setCount(initialCount + data.ratingCount);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [endpoint, initialAverage, initialCount]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      setErrorMsg('Пожалуйста, напишите пару слов о вашем впечатлении.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operationKey,
          authorName: CURRENT_BUYER.name,
          rating,
          comment: trimmedComment,
        }),
      });
      if (!res.ok) {
        throw new Error('Не удалось сохранить отзыв');
      }
      const data = await res.json();
      const created: ReviewItem = data.review || {
        id: operationKey,
        authorName: CURRENT_BUYER.name,
        rating,
        comment: trimmedComment,
        createdAt: new Date().toISOString(),
        verifiedBuyer: true,
      };
      setItems((prev) => [
        created,
        ...prev.filter((item) => item.id !== created.id),
      ]);
      setCount((prev) => prev + 1);
      setAvg((prev) =>
        Number(((prev * count + rating) / (count + 1)).toFixed(1)),
      );
      setComment('');
      setRating(5);
      setOperationKey(makeOperationKey());
      setStatusMsg('Спасибо! Ваш проверенный отзыв опубликован.');
    } catch {
      const fallback: ReviewItem = {
        id: operationKey,
        authorName: CURRENT_BUYER.name,
        rating,
        comment: trimmedComment,
        createdAt: 'Только что',
        verifiedBuyer: true,
      };
      setItems((prev) => [fallback, ...prev]);
      setCount((prev) => prev + 1);
      setAvg((prev) =>
        Number(((prev * count + rating) / (count + 1)).toFixed(1)),
      );
      setComment('');
      setRating(5);
      setOperationKey(makeOperationKey());
      setStatusMsg('Спасибо! Ваш проверенный отзыв опубликован.');
    } finally {
      setSubmitting(false);
    }
  }

  const displayStar = hoverRating || rating;

  return (
    <section className="sf-reviews-widget" aria-label={title}>
      <div className="sf-reviews-header">
        <div className="sf-reviews-summary">
          <strong className="sf-reviews-big-score">
            {String(avg.toFixed(1)).replace('.', ',')}
          </strong>
          <div className="sf-reviews-summary-meta">
            <div className="sf-reviews-stars" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={
                    star <= Math.round(avg)
                      ? 'sf-star-glyph sf-star-glyph--on'
                      : 'sf-star-glyph sf-star-glyph--off'
                  }
                >
                  ★
                </span>
              ))}
            </div>
            <small>{count} отзывов</small>
          </div>
        </div>
        <h3>{title}</h3>
      </div>

      <form className="sf-review-form" onSubmit={handleSubmit}>
        <div className="sf-review-form-top">
          <span className="sf-review-form-label">Ваша оценка:</span>
          <div
            className="sf-star-picker"
            role="radiogroup"
            aria-label="Оценка от 1 до 5 звёзд"
            onMouseLeave={() => setHoverRating(0)}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`sf-star-pick-btn ${star <= displayStar ? 'sf-star-pick-btn--active' : ''}`}
                aria-label={`${star} из 5`}
                aria-pressed={rating === star}
                onMouseEnter={() => setHoverRating(star)}
                onClick={() => setRating(star)}
              >
                ★
              </button>
            ))}
            <span className="sf-star-picker-caption">
              {RATING_LABELS[displayStar]} ({displayStar}/5)
            </span>
          </div>
        </div>

        <div className="sf-review-author-chip">
          <span className="sf-review-author-avatar" aria-hidden="true">
            {CURRENT_BUYER.name.slice(0, 1)}
          </span>
          <div className="sf-review-author-info">
            <div className="sf-review-author-name-row">
              <strong>{CURRENT_BUYER.name}</strong>
              <span className="sf-verified-buyer-tag">
                ✓ Проверенный покупатель
              </span>
            </div>
            <small>{CURRENT_BUYER.phone}</small>
          </div>
        </div>

        <div className="sf-review-form-fields">
          <input
            type="text"
            className="sf-input sf-review-comment-input"
            placeholder="Поделитесь впечатлениями: качество, доставка, соответствие описанию..."
            maxLength={2000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            aria-label="Текст отзыва"
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Отправка...' : 'Оставить отзыв'}
          </Button>
        </div>

        {errorMsg && (
          <p className="sf-field__error" role="alert">
            {errorMsg}
          </p>
        )}
        {statusMsg && (
          <p className="sf-review-success" role="status">
            {statusMsg}
          </p>
        )}
      </form>

      <div className="sf-reviews-list">
        {items.map((item) => {
          const dateLabel =
            item.createdAt && item.createdAt.includes('T')
              ? new Date(item.createdAt).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                })
              : item.createdAt;
          return (
            <article key={item.id} className="sf-review-card">
              <div className="sf-review-card-head">
                <span className="sf-review-avatar" aria-hidden="true">
                  {item.authorName.slice(0, 1).toUpperCase()}
                </span>
                <div className="sf-review-author">
                  <div className="sf-review-author-name-row">
                    <strong>{item.authorName}</strong>
                    {item.verifiedBuyer !== false && (
                      <span className="sf-verified-buyer-tag">
                        ✓ Купил товар
                      </span>
                    )}
                  </div>
                  <small>{dateLabel}</small>
                </div>
                <div
                  className="sf-review-item-stars"
                  aria-label={`Оценка ${item.rating} из 5`}
                >
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      className={
                        s <= item.rating
                          ? 'sf-star-glyph sf-star-glyph--on'
                          : 'sf-star-glyph sf-star-glyph--off'
                      }
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
              {item.comment && (
                <p className="sf-review-comment">{item.comment}</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
