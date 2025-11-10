import cloudinary from '@/lib/cloudinary';

const resolveUploadOptions = (fileType = '', fileBase64 = '') => {
  const normalized = (fileType || '').toLowerCase();
  const base64 = (fileBase64 || '').trim().toLowerCase();
  const isPdf =
    normalized === 'application/pdf' ||
    base64.startsWith('data:application/pdf');

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

export async function POST(req) {
  let payload;
  try {
    payload = await req.json(); // data URL o base64
  } catch {
    return new Response('Payload invalido', { status: 400 });
  }

  const { fileBase64, fileType } = payload || {};
  if (!fileBase64) return new Response('No file', { status: 400 });

  try {
    const uploadOptions = resolveUploadOptions(fileType, fileBase64);
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
