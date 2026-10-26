import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
type Suggestion = {
  recognized: boolean;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  categoryMissing?: boolean;
  suggestedCategory?: string;
  confidence: 'low' | 'medium' | 'high';
  warning: string;
};
export type CategoryNode = {
  id: string;
  name: string;
  builtIn: boolean;
  children: { id: string; name: string; builtIn?: boolean }[];
};
type Info = { available: boolean; categories: CategoryNode[] };
export default function PhotoAssistant({
  shopId,
  photo,
  onApply,
  onBusyChange,
  onCategories,
}: {
  shopId: string;
  photo: string;
  onApply: (s: Suggestion) => void;
  onBusyChange: (busy: boolean) => void;
  onCategories: (categories: CategoryNode[]) => void;
}) {
  const [info, setInfo] = useState<Info | null>(null),
    [busy, setBusy] = useState(false),
    [suggestion, setSuggestion] = useState<Suggestion | null>(null),
    [error, setError] = useState(''),
    [applied, setApplied] = useState(false),
    [creatingCategory, setCreatingCategory] = useState(false);
  const current = useRef<AbortController | null>(null),
    sending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void api<Info>(`/shops/${shopId}/variants/photo-assistant`, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) {
          setInfo(value);
          onCategories(value.categories);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setInfo({ available: false, categories: [] });
      });
    return () => controller.abort();
  }, [shopId, onCategories]);
  useEffect(() => {
    setSuggestion(null);
    setApplied(false);
    setError('');
    return () => {
      current.current?.abort();
      current.current = null;
      sending.current = false;
      setBusy(false);
      onBusyChange(false);
    };
  }, [photo, onBusyChange]);
  async function addCategory() {
    if (!suggestion?.categoryMissing || !suggestion.suggestedCategory) return;
    setCreatingCategory(true);
    setError('');
    try {
      await api(`/shops/${shopId}/categories`, {
        method: 'POST',
        body: { name: suggestion.suggestedCategory },
      });
      const refreshed = await api<Info>(
        `/shops/${shopId}/variants/photo-assistant`,
      );
      setInfo(refreshed);
      onCategories(refreshed.categories);
      const matching = refreshed.categories.find(
        (category) => category.name === suggestion.suggestedCategory,
      );
      if (!matching) throw new Error('Категория не появилась в магазине.');
      const next = {
        ...suggestion,
        category: matching.name,
        subcategory: '',
        categoryMissing: false,
        suggestedCategory: '',
      };
      setSuggestion(next);
      onApply(next);
      setApplied(true);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'Не удалось создать категорию.',
      );
    } finally {
      setCreatingCategory(false);
    }
  }
  async function recognize() {
    if (!photo || !info?.available || sending.current) return;
    sending.current = true;
    const controller = new AbortController();
    current.current = controller;
    const timeout = window.setTimeout(() => controller.abort('timeout'), 30000);
    setBusy(true);
    onBusyChange(true);
    setSuggestion(null);
    setError('');
    setApplied(false);
    try {
      const value = await api<Suggestion>(
        `/shops/${shopId}/variants/photo-assistant`,
        {
          method: 'POST',
          body: { photoDataUrl: photo },
          signal: controller.signal,
        },
      );
      if (!controller.signal.aborted) setSuggestion(value);
    } catch (e) {
      if (
        current.current === controller &&
        controller.signal.reason === 'timeout'
      )
        setError(
          'Распознавание не отвечает. Заполните товар вручную или повторите попытку.',
        );
      else if (!controller.signal.aborted)
        setError(
          e instanceof ApiError
            ? e.status === 429
              ? 'Слишком много распознаваний. Повторите через минуту.'
              : e.message
            : 'Нет связи с распознаванием. Данные можно заполнить вручную.',
        );
    } finally {
      window.clearTimeout(timeout);
      if (current.current === controller) {
        current.current = null;
        sending.current = false;
        setBusy(false);
        onBusyChange(false);
      }
    }
  }
  return (
    <section className="photo-assistant" aria-label="Помощник по фото">
      <button
        type="button"
        disabled={!photo || !info?.available || busy}
        onClick={() => void recognize()}
      >
        {busy ? 'Определяем товар…' : 'Определить по фото'}
      </button>
      {busy && <p role="status">ИИ анализирует фото…</p>}
      {!info ? (
        <p className="muted">Проверяем доступность распознавания…</p>
      ) : !info.available ? (
        <p className="muted">
          Распознавание пока недоступно. Заполните товар вручную.
        </p>
      ) : (
        <p className="muted">
          Фото отправляется в Gemini. Проверьте предложение перед применением.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {suggestion && (
        <div className="panel">
          <h2>Предложение ИИ</h2>
          {suggestion.recognized && (
            <>
              <h3>{suggestion.name}</h3>
              <p>{suggestion.description}</p>
              {!suggestion.categoryMissing && (
                <p>
                  Категория: {suggestion.category}
                  {suggestion.subcategory ? ` → ${suggestion.subcategory}` : ''}
                </p>
              )}
              <p className="muted">
                Уверенность:{' '}
                {
                  { low: 'низкая', medium: 'средняя', high: 'высокая' }[
                    suggestion.confidence
                  ]
                }
              </p>
            </>
          )}
          {suggestion.categoryMissing && (
            <div role="status">
              <p>
                Подходящая категория не найдена. Товар не будет отнесён к
                случайной категории.
              </p>
              <p>Предложение: {suggestion.suggestedCategory}</p>
              <button
                type="button"
                disabled={creatingCategory}
                onClick={() => void addCategory()}
              >
                {creatingCategory
                  ? 'Создаём категорию…'
                  : 'Создать категорию и применить'}
              </button>
            </div>
          )}
          {suggestion.warning && <p>{suggestion.warning}</p>}
          {suggestion.recognized && !suggestion.categoryMissing && (
            <button
              type="button"
              onClick={() => {
                onApply(suggestion);
                setApplied(true);
              }}
            >
              Применить предложение
            </button>
          )}
          {applied && (
            <p role="status">
              Предложение применено. Проверьте поля и укажите цены.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
