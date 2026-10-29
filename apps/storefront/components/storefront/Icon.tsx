import type { SVGProps } from 'react';
const paths: Record<string, string> = {
  search: 'm21 21-4.5-4.5 M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
  cart: 'M3 3h2l3 12h10l3-9H6 M9 20h.01 M18 20h.01',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  shop: 'M3 10V6l2-3h14l2 3v4 M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0 M4 13v8h16v-8 M10 21v-7h4v7',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2 M17 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  arrow: 'M4 12h16 m-6-6 6 6-6 6',
  box: 'm3 6 9-4 9 4v12l-9 4-9-4Z m0-12 9 4 9-4 M12 10v12',
  shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z m-5 10 3 3 6-6',
  truck:
    'M1 4h13v13H1Z M14 9h4l4 4v4h-8 M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  filter: 'M4 7h16 M7 12h10 M10 17h4',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  phone:
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  clock: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 5v5l3.5 2',
};
export default function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.box} />
    </svg>
  );
}
