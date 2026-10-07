import { useEffect, useState } from 'react';
import { api, errorText } from '../api/client';
import { CurrentShift } from '../api/types';
export function useCurrentShift(
  shopId: string,
  trigger = '',
  ownerView = false,
) {
  const [current, setCurrent] = useState<CurrentShift>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    api<CurrentShift>(
      `/shops/${shopId}/pos/shifts/${ownerView ? 'active' : 'current'}`,
    )
      .then((r) => {
        if (active) {
          setCurrent(r);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [shopId, trigger, ownerView]);
  return { current, loading, error };
}
