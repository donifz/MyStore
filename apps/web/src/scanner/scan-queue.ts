import { Variant } from '../api/types';
export function createScanQueue(
  lookup: (code: string) => Promise<Variant>,
  onVariant: (v: Variant) => void,
  onError: (e: unknown) => void,
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
          if (active) onVariant(variant);
        } catch (e) {
          if (active) onError(e);
        }
      });
    },
    dispose() {
      active = false;
    },
  };
}
