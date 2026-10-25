import { useEffect, useRef, useState } from 'react';
import { api, ApiError, errorText } from '../api/client';
import { parseSom } from '../api/money';
import {
  Draft,
  DraftLine,
  DraftScope,
  load,
  save,
  withDraftLock,
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
    [unknownBarcode, setUnknownBarcode] = useState<string | null>(null),
    [productCreation, setProductCreation] = useState<string | null>(
      initial.draft.primaryReceiving?.barcode ?? null,
    ),
    [priceChange, setPriceChange] = useState<{
      id: string;
      price: number;
    } | null>(null);
  const ref = useRef(draft);
  ref.current = draft;
  const sending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function change(
    update: DraftLine[] | ((lines: DraftLine[]) => DraftLine[]),
  ) {
    if (ref.current.submission || blocked || sending.current) return false;
    try {
      return await withDraftLock(scope, () => {
        if (!mounted.current || ref.current.submission || sending.current)
          return false;
        const lines =
          typeof update === 'function' ? update(ref.current.lines) : update;
        const next = { ...ref.current, revision: crypto.randomUUID(), lines };
        save(next, ref.current.revision);
        ref.current = next;
        setDraft(next);
        setSuccess('');
        setError('');
        return true;
      });
    } catch (e) {
      if (mounted.current) {
        setError(errorText(e));
        setBlocked(true);
      }
      return false;
    }
  }
  async function addVariant(v: Variant) {
    const added = await change((lines) => {
      const existing = lines.find((x) => x.id === v.id);
      if (existing) {
        if (existing.quantity >= 1e9)
          throw new Error('Слишком большое количество.');
        return lines.map((x) =>
          x.id === v.id ? { ...x, quantity: x.quantity + 1 } : x,
        );
      }
      if (lines.length >= 100)
        throw new Error('В документе допускается до 100 товаров.');
      return [
        ...lines,
        {
          id: v.id,
          name: v.name,
          barcode: v.barcode,
          quantity: 1,
          priceMinor: v.salePriceMinor,
          ...(scope.kind === 'receiving' ? { unitCostText: '' } : {}),
        },
      ];
    });
    if (added) setUnknownBarcode(null);
    return added;
  }
  const queue = useRef<ReturnType<typeof createScanQueue> | null>(null);
  useEffect(() => {
    queue.current = createScanQueue(
      (code) =>
        api<Variant>(
          `/shops/${scope.shopId}/variants/by-barcode?code=${encodeURIComponent(code)}`,
        ),
      addVariant,
      (e, code) => {
        const missing = e instanceof ApiError && e.status === 404;
        setUnknownBarcode(missing && scope.kind === 'receiving' ? code : null);
        setError(
          missing
            ? 'Неизвестный штрихкод. Проверьте код товара.'
            : errorText(e),
        );
      },
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
  async function send(
    path: string,
    body: unknown,
    key?: string,
    allowProductCreation = false,
  ) {
    if (
      sending.current ||
      blocked ||
      !online ||
      (productCreation && !allowProductCreation)
    )
      return;
    sending.current = true;
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
              key: key ?? ref.current.revision,
              path,
              body,
              status: 'pending',
            },
          };
      const result = await submitDocument<{ id: string }>(
        pending,
        (key, b, savedPath) =>
          api(savedPath ?? path, { method: 'POST', key, body: b }),
        (captured) => {
          ref.current = captured;
          if (mounted.current) setDraft(captured);
        },
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
      sending.current = false;
      setBusy(false);
    }
  }
  async function receiveCreatedVariant(
    variant: Variant,
    quantity: number,
    unitCostText: string,
  ) {
    const workflow = ref.current.primaryReceiving;
    if (!workflow || !Number.isInteger(quantity) || quantity < 1)
      throw new Error('Укажите корректное количество первичной приёмки.');
    const unitCostMinor = parseSom(unitCostText);
    const line: DraftLine = {
      id: variant.id,
      name: variant.name,
      barcode: variant.barcode,
      quantity,
      priceMinor: variant.salePriceMinor,
      unitCostText,
    };
    const next = await withDraftLock(scope, () => {
      const current = ref.current;
      if (current.lines.some((item) => item.id === variant.id)) return current;
      const updated: Draft = {
        ...current,
        revision: crypto.randomUUID(),
        lines: [...current.lines, line],
      };
      save(updated, current.revision);
      ref.current = updated;
      setDraft(updated);
      return updated;
    });
    const result = await send(
      `/shops/${scope.shopId}/receivings`,
      {
        lines: next.lines.map((item) => ({
          variantId: item.id,
          quantity: item.quantity,
          unitCostMinor:
            item.id === variant.id
              ? unitCostMinor
              : parseSom(item.unitCostText ?? ''),
        })),
      },
      workflow.receivingKey,
      true,
    );
    if (result) setProductCreation(null);
    return !!result;
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
    receiveCreatedVariant,
    scan: (code: string) => {
      if (!ref.current.submission && !busy && !blocked && !productCreation)
        queue.current?.enqueue(code);
    },
    unknownBarcode,
    productCreation,
    addVariant,
    beginProductCreation: async () => {
      if (
        unknownBarcode &&
        online &&
        !busy &&
        !blocked &&
        !ref.current.submission
      ) {
        try {
          await withDraftLock(scope, () => {
            const current = ref.current;
            const workflowId = crypto.randomUUID();
            const next: Draft = {
              ...current,
              revision: crypto.randomUUID(),
              primaryReceiving: {
                workflowId,
                barcode: unknownBarcode,
                productKey: `product:${workflowId}`,
                receivingKey: `receiving:${workflowId}`,
              },
            };
            save(next, current.revision);
            ref.current = next;
            setDraft(next);
            setProductCreation(unknownBarcode);
            setError('');
          });
        } catch (e) {
          setError(errorText(e));
          setBlocked(true);
        }
      }
    },
    closeProductCreation: () => setProductCreation(null),
    finishProductCreationWithoutReceiving: () => {
      setProductCreation(null);
      setSuccess('Карточка создана без приёмки. Остаток не изменён.');
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
