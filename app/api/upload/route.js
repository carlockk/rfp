
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export async function POST(req){
  const { fileBase64 } = await req.json(); // data URL o base64
  if (!fileBase64) return new Response('No file', { status:400 });
  const res = await cloudinary.uploader.upload(fileBase64, {
    folder: process.env.CLOUDINARY_FOLDER || 'flota-app'
  });
  return Response.json({ url: res.secure_url });
}
