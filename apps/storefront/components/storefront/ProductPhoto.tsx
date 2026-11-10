'use client';

import { useEffect, useRef, useState } from 'react';

function renderIllustration(alt: string, category?: string) {
  const name = alt.toLowerCase();
  const s = `${alt} ${category || ''}`.toLowerCase();
  if (name.includes('arduino') || name.includes('инженер')) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#f4f8ff" />
        <ellipse
          cx="100"
          cy="154"
          rx="66"
          ry="10"
          fill="#cbd5e1"
          opacity="0.5"
        />
        <rect x="46" y="76" width="108" height="44" rx="8" fill="#1d4ed8" />
        <rect x="58" y="62" width="84" height="22" rx="5" fill="#0f172a" />
        <circle
          cx="78"
          cy="73"
          r="7"
          fill="#38bdf8"
          stroke="#e2e8f0"
          strokeWidth="2.5"
        />
        <circle
          cx="100"
          cy="73"
          r="7"
          fill="#38bdf8"
          stroke="#e2e8f0"
          strokeWidth="2.5"
        />
        <rect x="118" y="67" width="16" height="12" rx="2" fill="#22c55e" />
        <path
          d="M66 62c8-16 26-20 44-10M86 62c6-12 20-14 34-6"
          stroke="#f59e0b"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle
          cx="62"
          cy="128"
          r="22"
          fill="#eab308"
          stroke="#1e293b"
          strokeWidth="7"
        />
        <circle cx="62" cy="128" r="7" fill="#1e293b" />
        <circle
          cx="138"
          cy="128"
          r="22"
          fill="#eab308"
          stroke="#1e293b"
          strokeWidth="7"
        />
        <circle cx="138" cy="128" r="7" fill="#1e293b" />
      </svg>
    );
  }
  if (name.includes('marble') || name.includes('трек')) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#f8fafc" />
        <ellipse
          cx="100"
          cy="156"
          rx="64"
          ry="9"
          fill="#cbd5e1"
          opacity="0.45"
        />
        <rect x="48" y="42" width="14" height="110" rx="5" fill="#ef4444" />
        <rect x="82" y="54" width="14" height="98" rx="5" fill="#3b82f6" />
        <rect x="116" y="34" width="14" height="118" rx="5" fill="#22c55e" />
        <rect x="144" y="64" width="14" height="88" rx="5" fill="#eab308" />
        <path
          d="M48 64h48M82 92h48M48 118h82M116 74h42"
          stroke="#f97316"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <ellipse cx="55" cy="42" rx="14" ry="6" fill="#fbbf24" />
        <ellipse cx="123" cy="34" rx="14" ry="6" fill="#38bdf8" />
      </svg>
    );
  }
  if (name.includes('спорткар') || name.includes('creator')) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#f4f8ff" />
        <ellipse
          cx="100"
          cy="154"
          rx="68"
          ry="10"
          fill="#cbd5e1"
          opacity="0.5"
        />
        <rect
          x="32"
          y="34"
          width="124"
          height="88"
          rx="8"
          fill="#1d4ed8"
          stroke="#93c5fd"
          strokeWidth="2"
        />
        <rect x="40" y="42" width="22" height="16" rx="3" fill="#ef4444" />
        <path
          d="M66 122l16-22c4-5 10-8 18-8h40c8 0 14 3 18 8l14 14v18H56v-10h10z"
          fill="#eab308"
        />
        <path d="M84 96h42l12 14H74l10-14z" fill="#0f172a" />
        <circle cx="80" cy="134" r="14" fill="#0f172a" />
        <circle cx="80" cy="134" r="6" fill="#94a3b8" />
        <circle cx="144" cy="134" r="14" fill="#0f172a" />
        <circle cx="144" cy="134" r="6" fill="#94a3b8" />
      </svg>
    );
  }
  if (name.includes('магнит')) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#f8fafc" />
        <ellipse
          cx="100"
          cy="156"
          rx="66"
          ry="9"
          fill="#cbd5e1"
          opacity="0.45"
        />
        <rect
          x="38"
          y="108"
          width="38"
          height="38"
          rx="4"
          fill="#3b82f6"
          stroke="#1d4ed8"
          strokeWidth="3"
        />
        <rect
          x="81"
          y="108"
          width="38"
          height="38"
          rx="4"
          fill="#ec4899"
          stroke="#be185d"
          strokeWidth="3"
        />
        <rect
          x="124"
          y="108"
          width="38"
          height="38"
          rx="4"
          fill="#22c55e"
          stroke="#15803d"
          strokeWidth="3"
        />
        <rect
          x="60"
          y="68"
          width="38"
          height="38"
          rx="4"
          fill="#eab308"
          stroke="#ca8a04"
          strokeWidth="3"
        />
        <rect
          x="102"
          y="68"
          width="38"
          height="38"
          rx="4"
          fill="#8b5cf6"
          stroke="#6d28d9"
          strokeWidth="3"
        />
        <path
          d="M79 34l20 32H59l20-32z"
          fill="#ef4444"
          stroke="#b91c1c"
          strokeWidth="3"
        />
        <path
          d="M121 34l20 32h-40l20-32z"
          fill="#06b6d4"
          stroke="#0e7490"
          strokeWidth="3"
        />
      </svg>
    );
  }
  if (name.includes('опыт') || name.includes('химич')) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#f5f3ff" />
        <ellipse
          cx="100"
          cy="154"
          rx="62"
          ry="10"
          fill="#cbd5e1"
          opacity="0.45"
        />
        <rect x="38" y="34" width="124" height="110" rx="12" fill="#312e81" />
        <circle cx="126" cy="76" r="16" fill="#fde68a" />
        <rect
          x="114"
          y="70"
          width="10"
          height="7"
          rx="2"
          stroke="#1e293b"
          strokeWidth="2"
        />
        <rect
          x="128"
          y="70"
          width="10"
          height="7"
          rx="2"
          stroke="#1e293b"
          strokeWidth="2"
        />
        <path d="M108 134c4-22 14-34 20-34s16 12 20 34h-40z" fill="#ffffff" />
        <path d="M58 86l-10 42h32L70 86V70h-12v16z" fill="#38bdf8" />
        <path d="M52 112h24l4 16H48l4-16z" fill="#ec4899" />
        <rect x="86" y="92" width="10" height="36" rx="5" fill="#a78bfa" />
      </svg>
    );
  }
  if (name.includes('монтессори') || name.includes('доска')) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#fffbeb" />
        <ellipse
          cx="100"
          cy="152"
          rx="68"
          ry="10"
          fill="#cbd5e1"
          opacity="0.45"
        />
        <path
          d="M36 52h128l12 84H24l12-84z"
          fill="#fcd34d"
          stroke="#d97706"
          strokeWidth="4"
        />
        <circle cx="68" cy="76" r="15" fill="#eab308" />
        <rect x="102" y="61" width="30" height="30" rx="4" fill="#ef4444" />
        <path d="M64 100l18 28H46l18-28z" fill="#22c55e" />
        <rect x="94" y="102" width="28" height="26" rx="4" fill="#3b82f6" />
        <path
          d="M144 98l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2 5-10z"
          fill="#f97316"
        />
      </svg>
    );
  }
  if (
    name.includes('ночник') ||
    name.includes('проектор') ||
    name.includes('звёзд')
  ) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <defs>
          <radialGradient id="starGlobe" cx="45%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="45%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#312e81" />
          </radialGradient>
        </defs>
        <rect width="200" height="180" rx="16" fill="#f4f7ff" />
        <ellipse
          cx="100"
          cy="156"
          rx="48"
          ry="9"
          fill="#cbd5e1"
          opacity="0.5"
        />
        <path
          d="M72 148l16-22h24l16 22M100 126v24"
          stroke="#d97706"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle cx="100" cy="86" r="48" fill="url(#starGlobe)" />
        <circle cx="82" cy="70" r="3" fill="#fef08a" />
        <circle cx="116" cy="64" r="2.5" fill="#ffffff" />
        <circle cx="102" cy="92" r="3.5" fill="#fef08a" />
        <circle cx="74" cy="98" r="2" fill="#ffffff" />
        <circle cx="124" cy="96" r="3" fill="#fef08a" />
        <path d="M96 54l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" fill="#ffffff" />
      </svg>
    );
  }
  if (name.includes('зайчик')) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#fff7ed" />
        <ellipse
          cx="100"
          cy="156"
          rx="48"
          ry="9"
          fill="#cbd5e1"
          opacity="0.45"
        />
        <ellipse cx="82" cy="46" rx="11" ry="26" fill="#f5ebe0" />
        <ellipse cx="82" cy="48" rx="6" ry="18" fill="#fbcfe8" />
        <ellipse cx="118" cy="46" rx="11" ry="26" fill="#f5ebe0" />
        <ellipse cx="118" cy="48" rx="6" ry="18" fill="#fbcfe8" />
        <ellipse cx="100" cy="122" rx="36" ry="32" fill="#f5ebe0" />
        <circle cx="100" cy="80" r="28" fill="#f5ebe0" />
        <circle cx="90" cy="76" r="3.8" fill="#1e293b" />
        <circle cx="110" cy="76" r="3.8" fill="#1e293b" />
        <ellipse cx="100" cy="84" rx="4.5" ry="3.2" fill="#f472b6" />
      </svg>
    );
  }
  if (name.includes('кубик') || name.includes('рубик')) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#f8fafc" />
        <ellipse
          cx="100"
          cy="154"
          rx="52"
          ry="9"
          fill="#cbd5e1"
          opacity="0.5"
        />
        <path
          d="M100 34l54 26v58l-54 28-54-28V60l54-26z"
          fill="#0f172a"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* Top face (blue/yellow/white) */}
        <path d="M100 38l48 23-48 23-48-23 48-23z" fill="#3b82f6" />
        {/* Left face (blue tiles) */}
        <path d="M50 64l48 23v52l-48-24V64z" fill="#1d4ed8" />
        {/* Right face (red/orange/yellow tiles) */}
        <path d="M102 87l48-23v51l-48 24V87z" fill="#ef4444" />
        <path
          d="M66 54l48 23M82 46l48 23M116 46L68 69M132 54L84 77M50 81l48 23M50 98l48 23M66 72v51M82 80v51M102 104l48-23M102 121l48-23M118 80v51M134 72v51"
          stroke="#0f172a"
          strokeWidth="3.5"
        />
      </svg>
    );
  }
  if (name.includes('головоломк')) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#fffbeb" />
        <ellipse
          cx="100"
          cy="152"
          rx="62"
          ry="9"
          fill="#cbd5e1"
          opacity="0.45"
        />
        <rect
          x="36"
          y="78"
          width="48"
          height="48"
          rx="6"
          fill="#e6b88a"
          stroke="#b07d4f"
          strokeWidth="3"
        />
        <rect
          x="86"
          y="52"
          width="46"
          height="46"
          rx="6"
          fill="#deb887"
          stroke="#a47148"
          strokeWidth="3"
        />
        <rect
          x="116"
          y="96"
          width="46"
          height="40"
          rx="6"
          fill="#d2a679"
          stroke="#8c5a32"
          strokeWidth="3"
        />
        <circle cx="52" cy="94" r="4" fill="#7f4f24" />
        <circle cx="68" cy="110" r="4" fill="#7f4f24" />
        <circle cx="102" cy="68" r="4" fill="#7f4f24" />
        <circle cx="118" cy="82" r="4" fill="#7f4f24" />
      </svg>
    );
  }
  if (name.includes('мишк') || name.includes('плюш')) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <defs>
          <radialGradient id="bgBear" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#fff7ed" />
            <stop offset="100%" stopColor="#eef4ff" />
          </radialGradient>
          <linearGradient id="furMain" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e0a96d" />
            <stop offset="100%" stopColor="#b87d42" />
          </linearGradient>
        </defs>
        <rect width="200" height="180" rx="16" fill="url(#bgBear)" />
        <ellipse
          cx="100"
          cy="158"
          rx="54"
          ry="10"
          fill="#cbd5e1"
          opacity="0.45"
        />
        <circle cx="66" cy="46" r="18" fill="url(#furMain)" />
        <circle cx="66" cy="46" r="10" fill="#f6d5b0" />
        <circle cx="134" cy="46" r="18" fill="url(#furMain)" />
        <circle cx="134" cy="46" r="10" fill="#f6d5b0" />
        <ellipse cx="100" cy="122" rx="42" ry="38" fill="url(#furMain)" />
        <ellipse cx="100" cy="126" rx="24" ry="22" fill="#f6d5b0" />
        <circle cx="100" cy="72" r="34" fill="url(#furMain)" />
        <ellipse cx="100" cy="80" rx="16" ry="13" fill="#f6d5b0" />
        <circle cx="88" cy="66" r="4.5" fill="#1e293b" />
        <circle cx="112" cy="66" r="4.5" fill="#1e293b" />
        <ellipse cx="100" cy="76" rx="6" ry="4.5" fill="#451a03" />
        <path
          d="M94 83c3 3 9 3 12 0"
          stroke="#451a03"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path d="M84 98l16 7 16-7-5 14-11-5-11 5-5-14z" fill="#854d0e" />
        <circle cx="62" cy="118" r="14" fill="url(#furMain)" />
        <circle cx="138" cy="118" r="14" fill="url(#furMain)" />
        <circle cx="74" cy="148" r="16" fill="url(#furMain)" />
        <circle cx="74" cy="148" r="9" fill="#f6d5b0" />
        <circle cx="126" cy="148" r="16" fill="url(#furMain)" />
        <circle cx="126" cy="148" r="9" fill="#f6d5b0" />
      </svg>
    );
  }
  if (s.includes('машин') || s.includes('авто') || s.includes('внедорож')) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#f1f6ff" />
        <ellipse
          cx="100"
          cy="146"
          rx="68"
          ry="11"
          fill="#cbd5e1"
          opacity="0.5"
        />
        <path
          d="M34 114l16-30c4-7 11-11 19-11h54c8 0 15 4 20 11l19 16c6 4 10 10 10 17v11c0 5-4 9-9 9H37c-5 0-9-4-9-9v-14z"
          fill="#ef4444"
        />
        <path d="M58 79h56l18 22H46l12-22z" fill="#1e293b" />
        <rect x="26" y="118" width="148" height="14" rx="6" fill="#b91c1c" />
        <circle cx="62" cy="134" r="20" fill="#1e293b" />
        <circle cx="62" cy="134" r="10" fill="#94a3b8" />
        <circle cx="142" cy="134" r="20" fill="#1e293b" />
        <circle cx="142" cy="134" r="10" fill="#94a3b8" />
      </svg>
    );
  }
  if (s.includes('робот') || s.includes('электрон') || s.includes('arduino')) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#eef5ff" />
        <ellipse
          cx="100"
          cy="156"
          rx="48"
          ry="9"
          fill="#cbd5e1"
          opacity="0.5"
        />
        <rect
          x="64"
          y="34"
          width="72"
          height="54"
          rx="24"
          fill="#ffffff"
          stroke="#93c5fd"
          strokeWidth="3"
        />
        <rect x="74" y="46" width="52" height="30" rx="13" fill="#0f172a" />
        <circle cx="88" cy="60" r="6" fill="#38bdf8" />
        <circle cx="112" cy="60" r="6" fill="#38bdf8" />
        <path
          d="M94 69c3 2.5 9 2.5 12 0"
          stroke="#38bdf8"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <rect
          x="68"
          y="92"
          width="64"
          height="52"
          rx="20"
          fill="#ffffff"
          stroke="#93c5fd"
          strokeWidth="3"
        />
        <circle cx="100" cy="116" r="12" fill="#1d6bf3" />
        <circle cx="100" cy="116" r="6" fill="#93c5fd" />
        <rect x="46" y="98" width="16" height="36" rx="8" fill="#60a5fa" />
        <rect x="138" y="98" width="16" height="36" rx="8" fill="#60a5fa" />
        <rect x="76" y="142" width="18" height="14" rx="6" fill="#1e293b" />
        <rect x="106" y="142" width="18" height="14" rx="6" fill="#1e293b" />
      </svg>
    );
  }
  if (s.includes('конструктор') || s.includes('lego') || s.includes('детал')) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#f0f7ff" />
        <ellipse
          cx="100"
          cy="154"
          rx="62"
          ry="10"
          fill="#cbd5e1"
          opacity="0.45"
        />
        <rect x="44" y="96" width="56" height="44" rx="6" fill="#ef4444" />
        <rect x="52" y="88" width="14" height="10" rx="3" fill="#dc2626" />
        <rect x="76" y="88" width="14" height="10" rx="3" fill="#dc2626" />
        <rect x="96" y="96" width="60" height="44" rx="6" fill="#eab308" />
        <rect x="106" y="88" width="14" height="10" rx="3" fill="#ca8a04" />
        <rect x="132" y="88" width="14" height="10" rx="3" fill="#ca8a04" />
        <rect x="68" y="54" width="64" height="42" rx="6" fill="#1d6bf3" />
        <rect x="78" y="46" width="16" height="10" rx="3" fill="#1557d0" />
        <rect x="106" y="46" width="16" height="10" rx="3" fill="#1557d0" />
      </svg>
    );
  }
  if (
    s.includes('кофе') ||
    s.includes('чай') ||
    s.includes('чашк') ||
    s.includes('посуд')
  ) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#f4f8ff" />
        <ellipse
          cx="100"
          cy="150"
          rx="56"
          ry="10"
          fill="#cbd5e1"
          opacity="0.45"
        />
        <path
          d="M132 82h14c10 0 18 8 18 18s-8 18-18 18h-14"
          stroke="#1d6bf3"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M58 68h80v46c0 18-15 32-33 32H91c-18 0-33-14-33-32V68z"
          fill="#ffffff"
          stroke="#1d6bf3"
          strokeWidth="4"
        />
        <rect x="58" y="78" width="80" height="14" fill="#dbeafe" />
        <path
          d="M84 44c0 8 6 10 6 18M102 40c0 8 6 10 6 18M118 46c0 8 6 10 6 18"
          stroke="#93c5fd"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (
    s.includes('выпеч') ||
    s.includes('круассан') ||
    s.includes('хлеб') ||
    s.includes('тартин')
  ) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#fffbeb" />
        <ellipse
          cx="100"
          cy="146"
          rx="60"
          ry="10"
          fill="#fde68a"
          opacity="0.5"
        />
        <path
          d="M42 112c4-32 28-54 58-54s54 22 58 54c-14 10-34 12-58 12s-44-2-58-12z"
          fill="#f59e0b"
        />
        <path
          d="M62 108c6-24 20-38 38-38s32 14 38 38"
          stroke="#fef3c7"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (
    s.includes('цвет') ||
    s.includes('букет') ||
    s.includes('роз') ||
    s.includes('пион')
  ) {
    return (
      <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
        <rect width="200" height="180" rx="16" fill="#fdf2f8" />
        <path
          d="M78 106l22 46 22-46H78z"
          fill="#fbcfe8"
          stroke="#f472b6"
          strokeWidth="3"
        />
        <circle cx="84" cy="76" r="20" fill="#f472b6" />
        <circle cx="116" cy="76" r="20" fill="#fb7185" />
        <circle cx="100" cy="60" r="22" fill="#ec4899" />
        <circle cx="100" cy="60" r="9" fill="#fef08a" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 180" fill="none" aria-hidden="true">
      <rect width="200" height="180" rx="16" fill="#eef5ff" />
      <ellipse cx="100" cy="150" rx="52" ry="9" fill="#cbd5e1" opacity="0.45" />
      <rect x="58" y="62" width="84" height="78" rx="16" fill="#1d6bf3" />
      <path
        d="M80 62V50a20 20 0 0 1 40 0v12"
        stroke="#1043a6"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="100" cy="102" r="18" fill="#ffffff" />
      <path
        d="M93 102l5 5 10-10"
        stroke="#1d6bf3"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function getCategoryPlaceholder(
  category?: string,
  name?: string,
): string {
  const s = `${name || ''} ${category || ''}`.toLowerCase();
  if (
    s.includes('электроник') ||
    s.includes('смартфон') ||
    s.includes('телефон') ||
    s.includes('ноутбук') ||
    s.includes('компьютер') ||
    s.includes('аудио') ||
    s.includes('наушник') ||
    s.includes('гаджет') ||
    s.includes('бытовая техник')
  ) {
    return '/placeholders/electronics.jpg';
  }
  if (
    s.includes('одежд') ||
    s.includes('обувь') ||
    s.includes('мужск') ||
    s.includes('женск') ||
    s.includes('детская одежд') ||
    s.includes('кроссовк') ||
    s.includes('футболк') ||
    s.includes('джинс') ||
    s.includes('куртк') ||
    s.includes('плать')
  ) {
    return '/placeholders/fashion.jpg';
  }
  if (
    s.includes('товары для дома') ||
    s.includes('посуд') ||
    s.includes('мебель') ||
    s.includes('текстиль') ||
    s.includes('декор') ||
    s.includes('кухонн') ||
    s.includes('столов')
  ) {
    return '/placeholders/home.jpg';
  }
  if (s.includes('конструктор') || s.includes('lego')) {
    return '/placeholders/constructors.jpg';
  }
  if (
    s.includes('машин') ||
    s.includes('авто') ||
    s.includes('транспорт') ||
    s.includes('запчаст') ||
    s.includes('автотовар') ||
    s.includes('toy-car') ||
    s.includes('toy-rc')
  ) {
    return '/placeholders/cars.jpg';
  }
  if (
    s.includes('развив') ||
    s.includes('монтессори') ||
    s.includes('пирамид') ||
    s.includes('обуч') ||
    s.includes('робот') ||
    s.includes('arduino') ||
    s.includes('инженер') ||
    s.includes('опыт') ||
    s.includes('доска') ||
    s.includes('звёзд') ||
    s.includes('настольн') ||
    s.includes('пазл') ||
    s.includes('логическ') ||
    s.includes('stem')
  ) {
    return '/placeholders/educational.jpg';
  }
  if (
    s.includes('мягк') ||
    s.includes('мишк') ||
    s.includes('плюш') ||
    s.includes('игрушк') ||
    s.includes('кукл') ||
    s.includes('фигурк') ||
    s.includes('малыш')
  ) {
    return '/placeholders/plush.jpg';
  }
  if (s.includes('кофе') || s.includes('чай') || s.includes('напит')) {
    return '/placeholders/coffee.jpg';
  }
  if (
    s.includes('выпеч') ||
    s.includes('хлеб') ||
    s.includes('круассан') ||
    s.includes('десерт') ||
    s.includes('пекар') ||
    s.includes('продукт') ||
    s.includes('бакале')
  ) {
    return '/placeholders/bakery.jpg';
  }
  if (
    s.includes('цвет') ||
    s.includes('букет') ||
    s.includes('роз') ||
    s.includes('пион')
  ) {
    return '/placeholders/flowers.jpg';
  }
  return '/placeholders/default.jpg';
}

// Never show a browser's broken-image glyph when a photo disappears or fails.
export default function ProductPhoto({
  src,
  alt,
  category,
  loading = 'lazy',
}: {
  src?: string;
  alt: string;
  category?: string;
  loading?: 'lazy' | 'eager';
}) {
  const targetSrc = src || getCategoryPlaceholder(category, alt);
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // A broken data URL may fail during SSR, before React hydrates and
  // attaches onError. Also check the completed image on mount/source change.
  useEffect(() => {
    const image = imageRef.current;
    setFailed(Boolean(image?.complete && image.naturalWidth === 0));
  }, [targetSrc]);

  if (failed) {
    return (
      <span className="sf-product-placeholder" role="img" aria-label={alt}>
        {renderIllustration(alt, category)}
      </span>
    );
  }

  return (
    <img
      ref={imageRef}
      src={targetSrc}
      alt={alt}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
