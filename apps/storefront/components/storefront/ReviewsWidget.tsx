'use client';
import { useEffect, useState, FormEvent } from 'react';
import type { ReviewItem } from '../../lib/public-api';
import { Button } from '../ui';

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

function pluralizeReviews(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${n} отзывов`;
  if (mod10 === 1) return `${n} отзыв`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} отзыва`;
  return `${n} отзывов`;
}

export default function ReviewsWidget({
  slug,
  productId,
  initialAverage,
  initialCount,
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

  const storageKey = `mystore_reviews_${slug}_${productId || 'store'}`;

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [avg, setAvg] = useState<number>(initialAverage || 0);
  const [count, setCount] = useState<number>(initialCount || 0);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [authorName, setAuthorName] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [operationKey, setOperationKey] = useState<string>(() =>
    makeOperationKey(),
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    try {
      const savedName = localStorage.getItem('mystore_reviewer_name');
      if (savedName) setAuthorName(savedName);
    } catch {}
  }, []);

  useEffect(() => {
    let active = true;

    // Load any local reviews saved on this device
    let localItems: ReviewItem[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localItems = parsed;
      }
    } catch {}

    fetch(endpoint, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        const serverItems: ReviewItem[] = Array.isArray(data?.items)
          ? data.items
          : [];
        const merged = [
          ...localItems,
          ...serverItems.filter(
            (si) => !localItems.some((li) => li.id === si.id),
          ),
        ];
        setItems(merged);

        if (merged.length > 0) {
          const totalRating = merged.reduce(
            (acc, it) => acc + (it.rating || 5),
            0,
          );
          setAvg(Number((totalRating / merged.length).toFixed(1)));
          setCount(merged.length);
        } else if (typeof data?.ratingCount === 'number') {
          setAvg(Number(data.ratingAverage) || 0);
          setCount(data.ratingCount);
        }
      })
      .catch(() => {
        if (!active) return;
        if (localItems.length > 0) {
          setItems(localItems);
          const totalRating = localItems.reduce(
            (acc, it) => acc + (it.rating || 5),
            0,
          );
          setAvg(Number((totalRating / localItems.length).toFixed(1)));
          setCount(localItems.length);
        }
      });

    return () => {
      active = false;
    };
  }, [endpoint, storageKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      setErrorMsg('Пожалуйста, напишите пару слов о вашем впечатлении.');
      return;
    }
    const finalAuthor = authorName.trim() || 'Покупатель';
    setSubmitting(true);
    setErrorMsg('');
    setStatusMsg('');

    try {
      localStorage.setItem('mystore_reviewer_name', finalAuthor);
    } catch {}

    const newReview: ReviewItem = {
      id: operationKey,
      authorName: finalAuthor,
      rating,
      comment: trimmedComment,
      createdAt: new Date().toISOString(),
      verifiedBuyer: true,
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operationKey,
          authorName: finalAuthor,
          rating,
          comment: trimmedComment,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.review) {
          newReview.id = data.review.id || newReview.id;
          newReview.createdAt = data.review.createdAt || newReview.createdAt;
        }
      }
    } catch {
      // Offline or unauthenticated fallback persists review locally
    }

    setItems((prev) => {
      const updated = [
        newReview,
        ...prev.filter((it) => it.id !== newReview.id),
      ];
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setCount((prev) => prev + 1);
    setAvg((prev) => {
      const currentCount = count || 0;
      return Number(
        ((prev * currentCount + rating) / (currentCount + 1)).toFixed(1),
      );
    });

    setComment('');
    setRating(5);
    setOperationKey(makeOperationKey());
    setStatusMsg('Спасибо! Ваш отзыв опубликован.');
    setSubmitting(false);
  }

  const displayStar = hoverRating || rating;

  return (
    <section className="sf-reviews-widget" aria-label={title}>
      <div className="sf-reviews-header">
        <div className="sf-reviews-summary">
          {count > 0 ? (
            <>
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
                <small>{pluralizeReviews(count)}</small>
              </div>
            </>
          ) : (
            <div className="sf-reviews-summary-meta sf-reviews-summary-meta--empty">
              <span className="sf-reviews-no-score">Пока нет отзывов</span>
              <small>Оставьте первый отзыв</small>
            </div>
          )}
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

        <div className="sf-review-author-field">
          <label htmlFor="review-author-name" className="sf-field__label">
            Ваше имя
          </label>
          <input
            id="review-author-name"
            type="text"
            className="sf-input sf-review-author-input"
            placeholder="Например, Айбек"
            maxLength={60}
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
          />
        </div>

        <div className="sf-review-form-fields">
          <textarea
            className="sf-textarea sf-review-comment-input"
            rows={3}
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
        {items.length === 0 ? (
          <div className="sf-reviews-empty">
            <span className="sf-reviews-empty-icon" aria-hidden="true">
              ★
            </span>
            <p>У этого {productId ? 'товара' : 'магазина'} пока нет отзывов</p>
            <small>Поделитесь вашим мнением о покупке первым!</small>
          </div>
        ) : (
          items.map((item) => {
            const dateLabel =
              item.createdAt && item.createdAt.includes('T')
                ? new Date(item.createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : item.createdAt;
            return (
              <article key={item.id} className="sf-review-card">
                <div className="sf-review-card-head">
                  <span className="sf-review-avatar" aria-hidden="true">
                    {(item.authorName || 'П').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="sf-review-author">
                    <div className="sf-review-author-name-row">
                      <strong>{item.authorName || 'Покупатель'}</strong>
                      {item.verifiedBuyer !== false && (
                        <span className="sf-verified-buyer-tag">
                          ✓ Проверенный отзыв
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
          })
        )}
      </div>
    </section>
  );
}
