import { useEffect, useRef } from 'react';
import { api } from '../api/client';

/**
 * Polls the shop customer record while an invite QR is visible so the cashier
 * immediately sees when the buyer has opened the link and linked their cabinet.
 */
export function useCustomerActivationPoll(
  shopId?: string,
  customerId?: string,
  onActivated?: () => void,
) {
  const onActivatedRef = useRef(onActivated);
  onActivatedRef.current = onActivated;

  const hasCallback = Boolean(onActivated);

  useEffect(() => {
    if (!shopId || !customerId || !hasCallback) return;
    let active = true;
    const interval = setInterval(() => {
      void api<{ linked: boolean }>(`/shops/${shopId}/customers/${customerId}`)
        .then((res) => {
          if (active && res.linked) {
            clearInterval(interval);
            onActivatedRef.current?.();
          }
        })
        .catch(() => {
          // Ignore transient polling errors while waiting for buyer scan.
        });
    }, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [shopId, customerId, hasCallback]);
}
