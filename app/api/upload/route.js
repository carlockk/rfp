import cloudinary from '@/lib/cloudinary';
import { getSession } from '@/lib/auth';

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
  'image/heic',
  'image/heif'
]);

const resolveUploadOptions = (fileType = '') => {
  const normalized = (fileType || '').toLowerCase();
  const isPdf = normalized === 'application/pdf';

  const options = {
    folder: process.env.CLOUDINARY_FOLDER || 'flota-app',
    resource_type: 'auto'
  };

  if (isPdf) {
    options.resource_type = 'raw';
    options.format = 'pdf';
  }

  return options;
};

const inferMimeType = (fileType = '', fileBase64 = '') => {
  if (fileType) return fileType;
  if (fileBase64.startsWith('data:')) {
    const parts = fileBase64.split(';', 2);
    if (parts[0]) {
      const maybeType = parts[0].replace('data:', '');
      if (maybeType) return maybeType;
    }
  }
  return '';
};

const estimateSize = (base64 = '') => {
  const trimmed = base64.trim();
  const commaIndex = trimmed.indexOf(',');
  const payload = commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
  const padding = (payload.match(/=+$/) || [''])[0].length;
  return Math.floor(payload.length * 3 / 4) - padding;
};

export async function POST(req) {
  const session = await getSession();
  if (!session?.id) {
    return new Response('No autenticado', { status: 401 });
  }

  let payload;
  try {
    payload = await req.json(); // data URL o base64
  } catch {
    return new Response('Payload invalido', { status: 400 });
  }

  const { fileBase64, fileType } = payload || {};
  if (typeof fileBase64 !== 'string' || !fileBase64.trim()) {
    return new Response('Archivo requerido', { status: 400 });
  }

  const size = estimateSize(fileBase64);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    return new Response('Archivo demasiado grande', { status: 413 });
  }

  const normalizedType = inferMimeType(fileType, fileBase64);
  if (!ALLOWED_TYPES.has(normalizedType)) {
    return new Response('Tipo de archivo no permitido', { status: 400 });
  }

  try {
    const uploadOptions = resolveUploadOptions(normalizedType);
    const res = await cloudinary.uploader.upload(fileBase64, uploadOptions);
    return Response.json({
      url: res.secure_url,
      publicId: res.public_id,
      resourceType: res.resource_type
    });
  } catch (err) {
    console.error('Cloudinary upload failed', err);
    return new Response('No se pudo subir el archivo', { status: 500 });
  }
}
