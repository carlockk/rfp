'use client';

import { useEffect, useRef } from 'react';

export default function SlidingPanel({ open, title, onClose, children, footer }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleKey(e) {
      if (e.key === 'Escape') onClose?.('escape');
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  function onOverlayMouseDown(e) {
    if (e.target === e.currentTarget) {
      onClose?.('backdrop');
    }
  }

  return (
    <div className="panel-overlay" onMouseDown={onOverlayMouseDown}>
      <aside
        className="panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="panel__header">
          <h2 className="panel__title">{title}</h2>
          <button type="button" className="icon-button panel__close" onClick={() => onClose?.('close-button')}>
            <span aria-hidden="true">×</span>
            <span className="sr-only">Cerrar</span>
          </button>
        </header>
        <div className="panel__body">{children}</div>
        {footer ? <div className="panel__footer">{footer}</div> : null}
      </aside>
    </div>
  );
}

