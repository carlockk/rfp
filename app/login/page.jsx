'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import flotaLogo from '@/public/log.png';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null;
    const target = stored === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', target);
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('Autenticando...');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        setMessage('Ingreso correcto, redirigiendo...');
        window.location.href = '/';
      } else {
        setMessage('Credenciales inválidas');
      }
    } catch {
      setMessage('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-hero">
      <div className="login-panel">
        <div className="login-panel__header">
          <Image
            src={flotaLogo}
            alt="Flota"
            width={96}
            height={96}
            priority
            style={{ borderRadius: '50%' }}
          />
          <span className="login-panel__brand">R F P</span>
          <h1 className="login-panel__title">Iniciar sesión</h1>
        </div>
        <p className="login-panel__intro">
          Administra tu flota, asigna técnicos y sigue el consumo de cada equipo desde un solo lugar.
        </p>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              className="input login-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label className="label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="input login-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <button className="btn primary" disabled={loading}>
              {loading ? 'Ingresando...' : 'Entrar'}
            </button>
            <span style={{ color: 'var(--muted)', minHeight: 20 }}>{message}</span>
          </div>
        </form>
      </div>
    </div>
  );
}
