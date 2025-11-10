import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import { requireRole } from '@/lib/auth';
import cloudinary from '@/lib/cloudinary';

const isSupportedDocument = (type = '') =>
  /^image\//.test(type) || type === 'application/pdf';

const populateEquipment = (query) =>
  query
    .populate('documents.uploadedBy', 'name email')
    .lean();

export async function POST(req, { params }) {
  const ses = await requireRole('admin');
  if (!ses) return new Response('Forbidden', { status: 403 });

  const id = params.id;
  if (!mongoose.isValidObjectId(id)) {
    return new Response('Invalid equipment ID', { status: 400 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid payload', { status: 400 });
  }

  const { name, url, type, size, publicId } = payload || {};
  if (!name || !url || !type) {
    return new Response('Missing document data', { status: 400 });
  }
  if (!isSupportedDocument(type)) {
    return new Response('Tipo de archivo no soportado', { status: 400 });
  }

  await dbConnect();
  const docEntry = {
    _id: new mongoose.Types.ObjectId(),
    name,
    url,
    type,
    size: typeof size === 'number' ? size : null,
    publicId: typeof publicId === 'string' && publicId ? publicId : undefined,
    uploadedAt: new Date(),
    uploadedBy: mongoose.isValidObjectId(ses.id) ? new mongoose.Types.ObjectId(ses.id) : undefined
  };

  const updated = await populateEquipment(
    Equipment.findByIdAndUpdate(
      id,
      { $push: { documents: docEntry } },
      { new: true }
    )
  );

  if (!updated) {
    return new Response('Not found', { status: 404 });
  }

  return Response.json({ documents: updated.documents });
}

export async function DELETE(req, { params }) {
  const ses = await requireRole('admin');
  if (!ses) return new Response('Forbidden', { status: 403 });

  const equipmentId = params.id;
  if (!mongoose.isValidObjectId(equipmentId)) {
    return new Response('Invalid equipment ID', { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get('documentId');
  if (!documentId || !mongoose.isValidObjectId(documentId)) {
    return new Response('Invalid document ID', { status: 400 });
  }

  await dbConnect();
  const equipment = await Equipment.findOne(
    { _id: equipmentId, 'documents._id': documentId },
    { 'documents.$': 1 }
  ).lean();

  if (!equipment || !equipment.documents?.length) {
    return new Response('Not found', { status: 404 });
  }

  const targetDoc = equipment.documents[0];

  if (targetDoc.publicId) {
    const resourceType = targetDoc.type === 'application/pdf' ? 'raw' : 'image';
    try {
      await cloudinary.uploader.destroy(targetDoc.publicId, { resource_type: resourceType });
    } catch (err) {
      console.error('No se pudo eliminar archivo en Cloudinary', err);
    }
  }

  const updated = await populateEquipment(
    Equipment.findByIdAndUpdate(
      equipmentId,
      { $pull: { documents: { _id: documentId } } },
      { new: true }
    )
  );

  if (!updated) {
    return new Response('Not found', { status: 404 });
  }

  return Response.json({ documents: updated.documents });
}
