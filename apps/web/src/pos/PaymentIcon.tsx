import type { ReactNode } from 'react';

type PaymentIconName =
  | 'cash'
  | 'card'
  | 'sparkle'
  | 'clock'
  | 'chevron'
  | 'close'
  | 'check'
  | 'user'
  | 'user-plus'
  | 'qr'
  | 'copy'
  | 'share'
  | 'cart'
  | 'tag'
  | 'gift'
  | 'coins'
  | 'search'
  | 'wallet'
  | 'percent';

const paths: Record<PaymentIconName, ReactNode> = {
  cash: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.7" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19M6.5 14.5h4" />
    </>
  ),
  sparkle: (
    <path
      d="M12 2c1.5 6.5 3.5 8.5 10 10-6.5 1.5-8.5 3.5-10 10-1.5-6.5-3.5-8.5-10-10 6.5-1.5 8.5-3.5 10-10Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="m5 12 4 4L19 6" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  'user-plus': (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M2 21v-2a8 8 0 0 1 13-6M19 15v6M16 18h6" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM21 14v3M17 21h4M14 21v-2" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1" />
      <circle cx="19" cy="20" r="1" />
      <path d="M2 3h3l2.5 12h12l2-9H6" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="1" />
      <path d="M2 7h20v4H2zM12 7v14" />
      <path d="M12 7C6 7 5 2 8 2c2 0 4 3 4 5Zm0 0c6 0 7-5 4-5-2 0-4 3-4 5Z" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5M4 10.5v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5M4 15.5v3c0 1.7 3.6 3 8 3s8-1.3 8-3v-3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.7" cy="10.7" r="7" />
      <path d="m16 16 5 5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="15" rx="2" />
      <path d="M3 10h18M6 6V4h12" />
      <circle cx="17" cy="15.5" r="1" />
    </>
  ),
  percent: (
    <>
      <circle cx="7" cy="7" r="2" />
      <circle cx="17" cy="17" r="2" />
      <path d="M5 19 19 5" />
    </>
  ),
  share: (
    <>
      <path d="M12 16V3m0 0-4 4m4-4 4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </>
  ),
};

export default function PaymentIcon({
  name,
  size = 21,
}: {
  name: PaymentIconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
