import BackButton from '@/app/ui/BackButton';
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import QRCode from 'qrcode';
import mongoose from 'mongoose';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function Page({ params }) {
  await dbConnect();

  const { id } = params || {};
  if (!id || !mongoose.isValidObjectId(id)) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>QR de equipo</h3>
        <p style={{ marginTop: 12, color: 'var(--danger)' }}>ID inválido.</p>
        <div className="back-button-row">
          <BackButton fallback="/admin/equipos" />
        </div>
      </div>
    );
  }

  const eq = await Equipment.findById(id).lean();
  if (!eq) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>QR de equipo</h3>
        <p style={{ marginTop: 12 }}>No encontrado</p>
        <div className="back-button-row">
          <BackButton fallback="/admin/equipos" />
        </div>
      </div>
    );
  }

  // Determina el origen de forma robusta (env > encabezados > localhost)
  const h = headers();
  const forwardedProto = h.get('x-forwarded-proto') || 'http';
  const forwardedHost = h.get('x-forwarded-host') || h.get('host');

  const origin =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : 'http://localhost:3000');

  const url = `${origin}/equipo/${eq._id.toString()}`;

  const dataUrl = await QRCode.toDataURL(url, {
    margin: 1,
    scale: 8,
    errorCorrectionLevel: 'M'
  });

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h3 style={{ marginTop: 0 }}>QR de {eq.code}</h3>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt="qr" style={{ background: '#fff', padding: 16, borderRadius: 12 }} />
      <p className="label" style={{ marginTop: 12 }}>
        Apunta a: <code>{url}</code>
      </p>
      <div className="back-button-row" style={{ justifyContent: 'center' }}>
        <BackButton fallback="/admin/equipos" />
      </div>
    </div>
  );
}
