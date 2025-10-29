'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BackButton({ fallback = '/' }) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasHistory = window.history.length > 1;
    const referrer = document.referrer || '';
    const sameOrigin = referrer.startsWith(window.location.origin);
    setCanGoBack(hasHistory && sameOrigin);
  }, []);

  function handleClick() {
    if (typeof window === 'undefined') return;
    const snapshot = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (canGoBack) {
      router.back();
      setTimeout(() => {
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (current === snapshot) {
          router.replace(fallback);
        }
      }, 400);
    } else {
      router.replace(fallback);
    }
  }

  return (
    <button type="button" className="btn" onClick={handleClick}>
      {String.fromCharCode(0x2190)} Volver
    </button>
  );
}
