import { useEffect, useState } from 'react';
export function useMemoryToken() {
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get('token') || '',
  );
  useEffect(() => {
    if (window.location.search)
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname,
      );
  }, []);
  return token;
}
