import { useEffect, useState } from 'react';
import { api, errorText } from '../api/client';
export function useResource<T>(path: string | null, refresh = false) {
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(!!path),
    [error, setError] = useState(''),
    [status, setStatus] = useState(0);
  useEffect(() => {
    let alive = true,
      sequence = 0,
      controller: AbortController | undefined;
    setData(null);
    setError('');
    setStatus(0);
    if (!path) {
      setLoading(false);
      return;
    }
    async function load() {
      const request = ++sequence;
      controller?.abort();
      controller = new AbortController();
      setLoading(true);
      try {
        const result = await api<T>(path!, { signal: controller.signal });
        if (alive && request === sequence) {
          setData(result);
          setError('');
          setStatus(0);
        }
      } catch (e) {
        if (alive && request === sequence) {
          setError(errorText(e));
          setStatus((e as { status?: number }).status ?? 0);
        }
      } finally {
        if (alive && request === sequence) setLoading(false);
      }
    }
    void load();
    const focus = () => {
      void load();
    };
    const timer = refresh ? window.setInterval(focus, 30000) : undefined;
    if (refresh) window.addEventListener('focus', focus);
    return () => {
      alive = false;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [path, refresh]);
  return { data, loading, error, status };
}
