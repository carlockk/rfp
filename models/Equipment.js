
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
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.models.Equipment || mongoose.model('Equipment', EquipmentSchema);
