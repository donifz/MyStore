import { useRef, useState } from 'react';
import { api, ApiError, errorText } from '../api/client';
export function useAccessOperation<T = unknown>() {
  const [result, setResult] = useState<T | null>(null);
  const current = useRef<{ path: string; body: unknown; key: string } | null>(
    null,
  );
  const sending = useRef(false);
  const [busy, setBusy] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(false);
  async function run(path: string, body: unknown) {
    if (sending.current) return false;
    sending.current = true;
    setBusy(true);
    setError('');
    setSuccess(false);
    const op = current.current || { path, body, key: crypto.randomUUID() };
    current.current = op;
    try {
      const data = await api<T>(op.path, {
        method: 'POST',
        body: op.body,
        key: op.key,
      });
      setResult(data);
      current.current = null;
      setPending(false);
      setSuccess(true);
      return true;
    } catch (e) {
      const unknown = !(e instanceof ApiError) || e.status >= 500;
      if (!unknown) current.current = null;
      setPending(unknown);
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Операция недоступна. Проверьте открытую смену или обновите список.'
          : e instanceof ApiError && e.status === 400
            ? 'Проверьте данные. Ссылка могла истечь или уже быть использована.'
            : errorText(e),
      );
      return false;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function retry() {
    return current.current
      ? run(current.current.path, current.current.body)
      : false;
  }
  return { run, retry, busy, pending, error, success, result };
}
