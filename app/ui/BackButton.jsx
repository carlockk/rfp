'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BackButton({ fallback = '/' }) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCanGoBack(window.history.length > 1);
    }
  }, []);

  function handleClick() {
    if (canGoBack) {
      router.back();
    } else {
      router.replace(fallback);
    }
  }

  return (
    <button type="button" className="btn" onClick={handleClick}>
      ← Volver
    </button>
  );
}
