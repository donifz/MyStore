import { Variant } from '../api/types';
export function createScanQueue(
  lookup: (code: string) => Promise<Variant>,
  onVariant: (v: Variant) => unknown,
  onError: (e: unknown, code: string) => void,
) {
  let chain = Promise.resolve(),
    active = true;
  return {
    enqueue(code: string) {
      if (!active) return;
      chain = chain.then(async () => {
        if (!active) return;
        try {
          const variant = await lookup(code);
          if (active) await onVariant(variant);
        } catch (e) {
          if (active) onError(e, code);
        }
      });
    },
    dispose() {
      active = false;
    },
  };
}
