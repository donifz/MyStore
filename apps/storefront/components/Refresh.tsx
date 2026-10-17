'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function Refresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [router]);
  return null;
}
