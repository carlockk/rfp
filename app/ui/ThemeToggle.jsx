'use client';

import { useEffect, useState } from 'react';
import { readSetting, writeSetting } from '@/lib/offline/settings';

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
    let mounted = true;
    const loadTheme = async () => {
      let stored = await readSetting('theme');
      if (!stored && typeof window !== 'undefined') {
        stored = window.localStorage?.getItem('theme');
      }
      const initial = stored === 'dark' ? 'dark' : 'light';
      if (mounted) {
        setTheme(initial);
        applyTheme(initial);
      }
    };
    loadTheme();
    return () => {
      mounted = false;
    };
  }, []);

  async function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    await writeSetting('theme', next);
  }

  const icon = ICONS[theme] || ICONS.light;
  const label = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  return (
    <button type="button" className="icon-button theme-toggle" onClick={toggleTheme} aria-label={label}>
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}




