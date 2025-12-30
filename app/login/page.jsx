'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import flotaLogo from '@/public/log.png';
import { isValidLoginId, isValidPassword, sanitizeLoginId } from '@/lib/validation';

export default function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(null);

  // Tema
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null;
    const target = stored === 'dark' ? 'dark' : 'light';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', target);
    }
  }, []);

  // Reloj (se actualiza cada 30 segundos)
  useEffect(() => {
    // Sincroniza el reloj sólo en el cliente para evitar desajustes de SSR.
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const dateStr = now
    ? now.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    : '--/--/----';

  const timeStr = now
    ? now.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : '--:--';

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('Autenticando...');

    const normalizedLoginId = sanitizeLoginId(loginId);
    if (!isValidLoginId(normalizedLoginId)) {
      setMessage('Ingresa un usuario o correo valido.');
      setLoading(false);
      return;
    }
    if (!isValidPassword(password, { minLength: 6, maxLength: 120 })) {
      setMessage('La contraseña debe tener entre 6 y 120 caracteres.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedLoginId, password })
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
      {/* Barra superior */}
      <div className="login-topbar" aria-live="polite">
        <div className="login-topbar__left">
          <span className="login-topbar__title">Logística</span>
        </div>
        <div className="login-topbar__right">
          <span className="login-topbar__date">{dateStr}</span>
          <span className="login-topbar__sep">•</span>
          <span className="login-topbar__time">{timeStr}</span>
        </div>
      </div>

      {/* Panel de login */}
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
          <span className="login-panel__brand">Logística</span>
          <h1 className="login-panel__title">Iniciar sesión</h1>
        </div>

        <p className="login-panel__intro">
          Administra tu flota, asigna técnicos y sigue el consumo de cada equipo desde un solo lugar.
        </p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label className="label" htmlFor="login-id">Usuario o correo</label>
            <input
              id="login-id"
              className="input login-input"
              type="text"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              required
              maxLength={120}
            />
          </div>

          {/* Campo contraseña con ojito */}
          <div style={{ display: 'grid', gap: 6, position: 'relative' }}>
            <label className="label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="input login-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              maxLength={120}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="toggle-password"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <button className="btn login" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
            <span style={{ color: 'var(--muted)', minHeight: 20 }}>{message}</span>
          </div>
        </form>
      </div>
    </div>
  );
}
