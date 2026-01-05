
import mongoose from 'mongoose';

const EquipmentSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true }, // código visible/QR
  type: { type: String, required: true }, // grua, camioneta, etc.
  brand: String,
  model: String,
  plate: String,
  fuel: { type: String, enum: ['diesel','bencina','electrico'], default: 'diesel' },
  adblue: { type: Boolean, default: false },
  hourmeterBase: { type: Number, default: 0 },
  odometerBase: { type: Number, default: 0 },
  notes: String,
  nextMaintenanceAt: { type: Date, default: null },
  techReviewExpiresAt: { type: Date, default: null },
  circulationPermitExpiresAt: { type: Date, default: null },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAt: { type: Date, default: null },
  operators: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      assignedAt: { type: Date, default: Date.now }
    }
  ],
  documents: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      name: { type: String, required: true },
      type: { type: String, required: true },
      url: { type: String, required: true },
      publicId: { type: String },
      size: { type: Number },
      uploadedAt: { type: Date, default: Date.now },
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  ],
  isActive: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

EquipmentSchema.index({ assignedTo: 1, isActive: 1 });
EquipmentSchema.index({ 'operators.user': 1 });

export default mongoose.models.Equipment || mongoose.model('Equipment', EquipmentSchema);
