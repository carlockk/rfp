
import BackButton from '@/app/ui/BackButton';
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import QRCode from 'qrcode';

export default async function Page({ params }) {
  await dbConnect();
  const eq = await Equipment.findById(params.id).lean();
  if (!eq) {
    return (
      <div className="card">
        <BackButton fallback="/admin/equipos" />
        <p style={{ marginTop: 12 }}>No encontrado</p>
      </div>
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000');
  const url = `${origin}/equipo/${eq._id}`;
  const dataUrl = await QRCode.toDataURL(url);

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>QR de {eq.code}</h3>
        <BackButton fallback="/admin/equipos" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt="qr" style={{ background: '#fff', padding: 16, borderRadius: 12 }} />
      <p className="label">
        Apunta a: <code>{url}</code>
      </p>
    </div>
  );
}
