'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function base64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = typeof window !== 'undefined' ? window.atob(normalized) : Buffer.from(normalized, 'base64').toString('binary');
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

export default function PushRegistration({ role }) {
  const [status, setStatus] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);

  const shouldRender = useMemo(() => {
    if (!PUBLIC_KEY || !role) return false;
    return ['admin', 'superadmin', 'tecnico'].includes(role);
  }, [role]);

  const syncSubscription = useCallback(
    async (subscription) => {
      if (!subscription) return;
      const json = subscription.toJSON();
      try {
        await fetch('/api/push/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: json.keys,
            platform: navigator.userAgent || ''
          })
        });
        setRegistered(true);
        setError('');
      } catch (err) {
        console.error('No se pudo registrar la subscripcion push', err);
        setError('No se pudo registrar la subscripcion push.');
      }
    },
    []
  );

  const ensureSubscription = useCallback(async () => {
    if (!isSupported()) {
      setStatus('unsupported');
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        setRegistered(true);
        await syncSubscription(existing);
        return;
      }
      const convertedKey = base64ToUint8Array(PUBLIC_KEY);
      const created = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
      await syncSubscription(created);
    } catch (err) {
      console.error('Error suscribiendo push', err);
      setError('No se pudo activar las notificaciones push.');
    }
  }, [syncSubscription]);

  useEffect(() => {
    if (!shouldRender || !isSupported()) return;
    if (Notification.permission === 'granted') {
      ensureSubscription();
    }
  }, [ensureSubscription, shouldRender]);

  if (!shouldRender || !isSupported()) {
    return null;
  }

  if (status === 'denied') {
    return (
      <div className="push-banner push-banner--danger">
        Notificaciones bloqueadas. Habilita los permisos del navegador para recibir alertas.
      </div>
    );
  }

  if (registered && status === 'granted') {
    return null;
  }

  const handleRequest = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await Notification.requestPermission();
      setStatus(response);
      if (response === 'granted') {
        await ensureSubscription();
      }
    } catch (err) {
      console.error('No se pudo solicitar permisos de notificacion', err);
      setError('No se pudo solicitar permisos de notificacion.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="push-banner">
      <div>
        {status === 'default'
          ? 'Activa las notificaciones para recibir alertas en tiempo real.'
          : 'Habilita las notificaciones para completar la configuracion.'}
        {error ? <span style={{ color: 'var(--danger)', marginLeft: 8 }}>{error}</span> : null}
      </div>
      <button className="btn primary" type="button" onClick={handleRequest} disabled={busy}>
        {busy ? 'Enviando...' : 'Activar alertas'}
      </button>
    </div>
  );
}
