'use client';
import { useEffect, useState } from 'react';

const THEMES = ['light', 'dark'];
const ICONS = { light: '\u2600', dark: '\u263E' };

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const target = THEMES.includes(theme) ? theme : 'light';
  document.documentElement.setAttribute('data-theme', target);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('theme');
    const initial = stored === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', next);
    }
    applyTheme(next);
  }

  const icon = ICONS[theme] || ICONS.light;
  const label = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  return (
    <button type="button" className="icon-button theme-toggle" onClick={toggleTheme} aria-label={label}>
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}




