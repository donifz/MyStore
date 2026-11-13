import type { SVGProps } from 'react';
const paths: Record<string, string> = {
  search: 'm21 21-4.5-4.5 M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
  cart: 'M3 3h2l3 12h10l3-9H6 M9 20h.01 M18 20h.01',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z M3 6h18 M16 10a4 4 0 0 1-8 0',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  shop: 'M3 10V6l2-3h14l2 3v4 M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0 M4 13v8h16v-8 M10 21v-7h4v7',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2 M17 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  arrow: 'M4 12h16 m-6-6 6 6-6 6',
  arrowLeft: 'M20 12H4 m6-6-6 6 6 6',
  chevronLeft: 'm15 18-6-6 6-6',
  chevronRight: 'm9 18 6-6-6-6',
  chevronDown: 'm6 9 6 6 6-6',
  star: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z',
  flame:
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z',
  sort: 'm3 8 4-4 4 4 M7 4v16 M21 16l-4 4-4-4 M17 20V4',
  box: 'm3 6 9-4 9 4v12l-9 4-9-4Z m0-12 9 4 9-4 M12 10v12',
  shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z m-5 10 3 3 6-6',
  truck:
    'M1 4h13v13H1Z M14 9h4l4 4v4h-8 M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  grid: 'M3 3h7v7H3Z M14 3h7v7h-7Z M14 14h7v7h-7Z M3 14h7v7H3Z',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  home: 'm3 10 9-7 9 7v11h-7v-7h-4v7H3Z',
  filter: 'M4 7h16 M7 12h10 M10 17h4',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  phone:
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  clock: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 5v5l3.5 2',
  check: 'M20 6 9 17l-5-5',
  copy: 'M8 8h12v12H8Z M16 8V4H4v12h4',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z m18 2-10 7L2 6',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z',
  card: 'M2 5h20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M2 10h20 M6 15h4',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9l1-8Z',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z M7 7h.01',
  info: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 14v-4m0-4h.01',
  award:
    'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M8.21 13.89 7 23l5-3 5 3-1.21-9.12',
  headset:
    'M3 18v-6a9 9 0 0 1 18 0v6 M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3ZM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3Z',
  refresh: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5',
  share:
    'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98',
  sparkles:
    'm12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3Z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
};
export function categoryIcon(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('игруш') || c.includes('дет') || c.includes('подар'))
    return 'sparkles';
  if (c.includes('дом') || c.includes('посуд') || c.includes('интерьер'))
    return 'home';
  if (c.includes('электр') || c.includes('техн')) return 'bolt';
  if (c.includes('одежд') || c.includes('обув') || c.includes('аксесс'))
    return 'tag';
  if (c.includes('продукт') || c.includes('кофе') || c.includes('выпеч'))
    return 'bag';
  if (c.includes('стро') || c.includes('инструм')) return 'box';
  return 'box';
}

export function CategoryIllustration({ category }: { category: string }) {
  const c = category.toLowerCase();
  if (c.includes('конструктор') || c.includes('lego')) {
    return (
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <rect x="4" y="20" width="16" height="12" rx="3" fill="#eab308" />
        <rect x="7" y="17" width="4" height="4" rx="1" fill="#ca8a04" />
        <rect x="13" y="17" width="4" height="4" rx="1" fill="#ca8a04" />
        <rect x="18" y="18" width="18" height="14" rx="3" fill="#1d6bf3" />
        <rect x="21" y="15" width="4" height="4" rx="1" fill="#1557d0" />
        <rect x="28" y="15" width="4" height="4" rx="1" fill="#1557d0" />
        <rect x="11" y="9" width="16" height="11" rx="3" fill="#ef4444" />
      </svg>
    );
  }
  if (c.includes('машин') || c.includes('авто') || c.includes('транспорт')) {
    return (
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 25l4-8c1.2-2 3-3 5.5-3h9c2.5 0 4.3 1 5.5 3l4 5c1.2 1 2 2.5 2 4v3H4v-4h2z"
          fill="#ef4444"
        />
        <path d="M12 16h14l4 6H9l3-6z" fill="#1e293b" />
        <circle cx="12" cy="29" r="5" fill="#0f172a" />
        <circle cx="12" cy="29" r="2.2" fill="#94a3b8" />
        <circle cx="28" cy="29" r="5" fill="#0f172a" />
        <circle cx="28" cy="29" r="2.2" fill="#94a3b8" />
      </svg>
    );
  }
  if (c.includes('развив') || c.includes('пирамид') || c.includes('обуч')) {
    return (
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <rect x="6" y="28" width="28" height="6" rx="3" fill="#1d6bf3" />
        <rect x="9" y="22" width="22" height="6" rx="3" fill="#22c55e" />
        <rect x="12" y="16" width="16" height="6" rx="3" fill="#eab308" />
        <rect x="15" y="10" width="10" height="6" rx="3" fill="#f97316" />
        <circle cx="20" cy="7" r="3.5" fill="#ef4444" />
      </svg>
    );
  }
  if (c.includes('робот')) {
    return (
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="9"
          y="7"
          width="22"
          height="16"
          rx="7"
          fill="#ffffff"
          stroke="#60a5fa"
          strokeWidth="2"
        />
        <rect x="12" y="10" width="16" height="9" rx="4" fill="#0f172a" />
        <circle cx="16.5" cy="14.5" r="2" fill="#38bdf8" />
        <circle cx="23.5" cy="14.5" r="2" fill="#38bdf8" />
        <rect
          x="11"
          y="24"
          width="18"
          height="11"
          rx="5"
          fill="#ffffff"
          stroke="#60a5fa"
          strokeWidth="2"
        />
        <circle cx="20" cy="29.5" r="3" fill="#1d6bf3" />
      </svg>
    );
  }
  if (c.includes('настольн')) {
    return (
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <path d="M20 6l13 7.5v13L20 34 7 26.5v-13L20 6z" fill="#7c3aed" />
        <path d="M20 6l13 7.5-13 7.5-13-7.5L20 6z" fill="#a78bfa" />
        <path d="M20 21l13-7.5v13L20 34V21z" fill="#6d28d9" />
        <circle cx="20" cy="13.5" r="1.8" fill="#ffffff" />
        <circle cx="13" cy="22" r="1.6" fill="#ffffff" />
        <circle cx="16" cy="26" r="1.6" fill="#ffffff" />
        <circle cx="24" cy="22" r="1.6" fill="#ffffff" />
        <circle cx="27" cy="26" r="1.6" fill="#ffffff" />
      </svg>
    );
  }
  if (c.includes('кукл') || c.includes('фигурк')) {
    return (
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="14" r="4" fill="#d97706" />
        <circle cx="28" cy="14" r="4" fill="#d97706" />
        <circle cx="20" cy="15" r="7" fill="#fde68a" />
        <path
          d="M13 13c1-4 4-6 7-6s6 2 7 6c-3-2-5-2-7-2s-4 0-7 2z"
          fill="#d97706"
        />
        <circle cx="17.5" cy="15.5" r="1.2" fill="#1e293b" />
        <circle cx="22.5" cy="15.5" r="1.2" fill="#1e293b" />
        <path d="M12 33l4-11h8l4 11H12z" fill="#ec4899" />
        <path d="M15 22l5 4 5-4" fill="#fbcfe8" />
      </svg>
    );
  }
  if (c.includes('мягк') || c.includes('игруш') || c.includes('мишк')) {
    return (
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="11" r="5" fill="#c68b59" />
        <circle cx="28" cy="11" r="5" fill="#c68b59" />
        <circle cx="20" cy="18" r="10" fill="#d9a066" />
        <ellipse cx="20" cy="20" rx="5" ry="4" fill="#f6d5b0" />
        <circle cx="16.5" cy="16" r="1.5" fill="#1e293b" />
        <circle cx="23.5" cy="16" r="1.5" fill="#1e293b" />
        <ellipse cx="20" cy="19" rx="2" ry="1.5" fill="#451a03" />
        <ellipse cx="20" cy="31" rx="11" ry="7" fill="#c68b59" />
      </svg>
    );
  }
  if (
    c.includes('игр') ||
    c.includes('хобби') ||
    c.includes('робот') ||
    c.includes('электр')
  ) {
    return (
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <rect x="5" y="12" width="30" height="18" rx="9" fill="#334155" />
        <path
          d="M13 18v6M10 21h6"
          stroke="#94a3b8"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="26" cy="19" r="2" fill="#38bdf8" />
        <circle cx="29" cy="22" r="2" fill="#f43f5e" />
      </svg>
    );
  }
  if (c.includes('кофе') || c.includes('чай') || c.includes('посуд')) {
    return (
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <path d="M9 14h18v11a9 9 0 0 1-18 0V14z" fill="#1d6bf3" />
        <path
          d="M27 16h3a3.5 3.5 0 0 1 0 7h-3"
          stroke="#1d6bf3"
          strokeWidth="3"
        />
        <rect x="7" y="29" width="22" height="3" rx="1.5" fill="#93c5fd" />
      </svg>
    );
  }
  if (c.includes('выпеч') || c.includes('продукт')) {
    return (
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M7 26c2-10 8-15 13-15s11 5 13 15c-4 3-8 4-13 4s-9-1-13-4z"
          fill="#f59e0b"
        />
        <path
          d="M12 24c2-6 5-9 8-9s6 3 8 9"
          stroke="#fef3c7"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (c.includes('цвет') || c.includes('букет')) {
    return (
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="15" cy="16" r="6" fill="#f472b6" />
        <circle cx="25" cy="16" r="6" fill="#fb7185" />
        <circle cx="20" cy="12" r="6" fill="#ec4899" />
        <circle cx="20" cy="14" r="3" fill="#fef08a" />
        <path d="M15 21l5 12 5-12H15z" fill="#fbcfe8" />
      </svg>
    );
  }
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <rect x="7" y="11" width="26" height="22" rx="6" fill="#3b82f6" />
      <path
        d="M15 11V9a5 5 0 0 1 10 0v2"
        stroke="#1d4ed8"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="20" cy="22" r="5" fill="#dbeafe" />
    </svg>
  );
}
export default function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: string }) {
  if (name === 'whatsapp') {
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        {...props}
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
      </svg>
    );
  }
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.box} />
    </svg>
  );
}
