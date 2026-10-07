import { useEffect, useRef, useState } from 'react';
import { api, ApiError, errorText } from '../api/client';
import {
  Draft,
  DraftLine,
  DraftScope,
  load,
  save,
  storageKey,
} from './draft-store';
import { submitDocument } from './document-state';
import { Variant } from '../api/types';
import { createScanQueue } from '../scanner/scan-queue';
export function freshDraft(scope: DraftScope): Draft {
  return {
    version: 1,
    scope,
    revision: crypto.randomUUID(),
    lines: [],
    submission: null,
  };
}
export function useDocument(scope: DraftScope) {
  const [initial] = useState(() => {
    try {
      return { draft: load(scope) ?? freshDraft(scope), error: '' };
    } catch (e) {
      return { draft: freshDraft(scope), error: errorText(e) };
    }
  });
  const [draft, setDraft] = useState(initial.draft),
    [error, setError] = useState(initial.error),
    [blocked, setBlocked] = useState(!!initial.error),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(''),
    [online, setOnline] = useState(navigator.onLine),
    [priceChange, setPriceChange] = useState<{
      id: string;
      price: number;
    } | null>(null);
  const ref = useRef(draft);
  ref.current = draft;
  function change(lines: DraftLine[]) {
    if (ref.current.submission || blocked || busy) return;
    try {
      const next = { ...ref.current, revision: crypto.randomUUID(), lines };
      save(next, ref.current.revision);
      ref.current = next;
      setDraft(next);
      setSuccess('');
      setError('');
    } catch (e) {
      setError(errorText(e));
      setBlocked(true);
    }
  }
  const queue = useRef<ReturnType<typeof createScanQueue> | null>(null);
  useEffect(() => {
    queue.current = createScanQueue(
      (code) =>
        api<Variant>(
          `/shops/${scope.shopId}/variants/by-barcode?code=${encodeURIComponent(code)}`,
        ),
      (v) => {
        const lines = ref.current.lines;
        const existing = lines.find((x) => x.id === v.id);
        if (existing) {
          if (existing.quantity >= 1e9) {
            setError('Слишком большое количество.');
            return;
          }
          change(
            lines.map((x) =>
              x.id === v.id ? { ...x, quantity: x.quantity + 1 } : x,
            ),
          );
        } else if (lines.length >= 100)
          setError('В документе допускается до 100 товаров.');
        else
          change([
            ...lines,
            {
              id: v.id,
              name: v.name,
              barcode: v.barcode,
              quantity: 1,
              priceMinor: v.salePriceMinor,
              ...(scope.kind === 'receiving' ? { unitCostText: '' } : {}),
            },
          ]);
      },
      (e) =>
        setError(
          e instanceof ApiError && e.status === 404
            ? 'Неизвестный штрихкод. Проверьте код товара.'
            : errorText(e),
        ),
    );
    return () => queue.current?.dispose();
  }, [scope.shopId, scope.userId, scope.kind, blocked, busy]);
  useEffect(() => {
    const network = () => setOnline(navigator.onLine);
    const storage = (e: StorageEvent) => {
      if (e.key === storageKey(scope)) {
        setBlocked(true);
        setError('Черновик изменён в другом окне. Обновите его.');
      }
    };
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
      window.removeEventListener('storage', storage);
    };
  }, [scope.shopId, scope.userId, scope.kind]);
  function reload() {
    try {
      const d = load(scope) ?? freshDraft(scope);
      setDraft(d);
      ref.current = d;
      setError('');
      setBlocked(false);
    } catch (e) {
      setError(errorText(e));
      setBlocked(true);
    }
  }
  async function send(path: string, body: unknown) {
    if (busy || blocked || !online) return;
    setBusy(true);
    setError('');
    setSuccess('');
    let pending: Draft;
    try {
      pending = ref.current.submission
        ? ref.current
        : {
            ...ref.current,
            submission: {
              key: crypto.randomUUID(),
              path,
              body,
              status: 'pending',
            },
          };
      save(pending);
      setDraft(pending);
      ref.current = pending;
      const result = await submitDocument<{ id: string }>(pending, (key, b) =>
        api(pending.submission!.path ?? path, { method: 'POST', key, body: b }),
      );
      const next = load(scope) ?? freshDraft(scope);
      setDraft(next);
      ref.current = next;
      setSuccess('Документ проведён: ' + result.id);
      return result;
    } catch (e) {
      setError(errorText(e));
      if (
        e instanceof ApiError &&
        e.details?.currentUnitPriceMinor !== undefined
      )
        setPriceChange({
          id: e.details.variantId,
          price: e.details.currentUnitPriceMinor,
        });
      try {
        const stored = load(scope);
        if (stored) {
          setDraft(stored);
          ref.current = stored;
        }
      } catch {
        setBlocked(true);
      }
    } finally {
      setBusy(false);
    }
  }
  return {
    draft,
    change,
    error,
    setError,
    busy,
    success,
    online,
    blocked,
    reload,
    send,
    scan: (code: string) => {
      if (!ref.current.submission && !busy && !blocked)
        queue.current?.enqueue(code);
    },
    priceChange,
    acceptPrice: () => {
      if (priceChange) {
        change(
          ref.current.lines.map((l) =>
            l.id === priceChange.id
              ? { ...l, priceMinor: priceChange.price }
              : l,
          ),
        );
        setPriceChange(null);
      }
    },
  };
}
