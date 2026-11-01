import { useState } from 'react';
import SquarePhotoCropper from './SquarePhotoCropper';

export function usePhotoCropQueue(onComplete: (photos: string[]) => void) {
  const [pending, setPending] = useState<File[]>([]);
  const [prepared, setPrepared] = useState<string[]>([]);

  function choose(files?: FileList | null) {
    if (!files?.length) return;
    setPending(Array.from(files));
    setPrepared([]);
  }

  function cancel() {
    setPending([]);
    setPrepared([]);
  }

  function confirm(photo: string) {
    const next = [...prepared, photo];
    if (pending.length > 1) {
      setPrepared(next);
      setPending(pending.slice(1));
      return;
    }
    onComplete(next);
    cancel();
  }

  const cropDialog = pending[0] ? (
    <SquarePhotoCropper
      key={pending[0].name + pending.length}
      file={pending[0]}
      onConfirm={confirm}
      onCancel={cancel}
    />
  ) : null;

  return { choose, cropDialog, cropping: pending.length > 0 };
}
