'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

export default function GlobalSearch({
  placeholder = 'Buscar en todo el sistema',
  minChars = MIN_QUERY_LENGTH,
  className = '',
  autoFocus = false
}) {
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const trimmedQuery = query.trim();

  const minCharsToUse = Math.max(1, minChars);

  const hasEnoughChars = trimmedQuery.length >= minCharsToUse;
  const hasResults = useMemo(
    () => categories.some((category) => Array.isArray(category.items) && category.items.length > 0),
    [categories]
  );

  useEffect(() => {
    const handleClick = (event) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!hasEnoughChars) {
      setCategories([]);
      setError('');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
          cache: 'no-store'
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'No se pudo completar la búsqueda');
        }
        const payload = await response.json();
        setCategories(Array.isArray(payload?.categories) ? payload.categories : []);
        setError('');
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'No se pudo completar la búsqueda');
        setCategories([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [hasEnoughChars, trimmedQuery]);

  const handleFocus = () => {
    setOpen(true);
  };

  const handleClear = () => {
    setQuery('');
    setCategories([]);
    setError('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      handleClear();
    }
  };

  const handleNavigate = () => {
    setOpen(false);
  };

  return (
    <div className={`global-search ${className}`} ref={containerRef}>
      <div className="global-search__input">
        <span className="global-search__icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" role="presentation">
            <path
              d="M15.5 14h-.79l-.28-.27a6 6 0 10-.7.7l.27.28v.79l4.5 4.5 1.5-1.5-4.5-4.5zm-5 0a4 4 0 110-8 4 4 0 010 8z"
              fill="currentColor"
            />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={placeholder}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
        />
        {query ? (
          <button
            type="button"
            className="global-search__clear"
            onClick={handleClear}
            aria-label="Limpiar búsqueda"
          >
            ×
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="global-search__results card">
          {!hasEnoughChars ? (
            <p className="global-search__hint">
              Escribe al menos {minCharsToUse} caracter{minCharsToUse === 1 ? '' : 'es'}.
            </p>
          ) : null}

          {hasEnoughChars && loading ? (
            <p className="global-search__hint">Buscando…</p>
          ) : null}

          {hasEnoughChars && !loading && error ? (
            <p className="global-search__error">{error}</p>
          ) : null}

          {hasEnoughChars && !loading && !error && !hasResults ? (
            <p className="global-search__hint">Sin resultados para “{trimmedQuery}”.</p>
          ) : null}

          {hasEnoughChars && !loading && !error && hasResults
            ? categories
                .filter((category) => Array.isArray(category.items) && category.items.length > 0)
                .map((category) => (
                  <div key={category.key} className="global-search__group">
                    <div className="global-search__group-header">
                      <p>{category.label}</p>
                      <span className="badge">{category.items.length}</span>
                    </div>
                    <div className="global-search__group-list">
                      {category.items.map((item) => (
                        <Link
                          key={`${category.key}-${item.id}`}
                          href={item.href || '#'}
                          className="global-search__result"
                          onClick={handleNavigate}
                        >
                          <div>
                            <p className="global-search__result-title">{item.title}</p>
                            {item.subtitle ? (
                              <p className="global-search__result-subtitle">{item.subtitle}</p>
                            ) : null}
                          </div>
                          {item.badge ? <span className="badge">{item.badge}</span> : null}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
