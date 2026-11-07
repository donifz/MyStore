import { useMemo } from 'react';
import { qrcodegen } from '../vendor/qrcodegen';

export default function BuyerInviteQr({ value }: { value: string }) {
  const { path, size } = useMemo(() => {
    const code = qrcodegen.QrCode.encodeText(
      value,
      qrcodegen.QrCode.Ecc.MEDIUM,
    );
    let path = '';
    for (let y = 0; y < code.size; y++) {
      for (let x = 0; x < code.size; x++) {
        if (code.getModule(x, y)) {
          path += `M${x + 4},${y + 4}h1v1h-1z`;
        }
      }
    }
    return { path, size: code.size + 8 };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label="QR-код одноразового приглашения в кабинет покупателя"
      viewBox={`0 0 ${size} ${size}`}
      width="208"
      height="208"
      style={{ width: 'min(208px, 100%)', height: 'auto' }}
    >
      <rect width={size} height={size} fill="white" />
      <path d={path} fill="black" />
    </svg>
  );
}
