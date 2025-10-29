import mongoose from 'mongoose';

const EquipmentTypeSchema = new mongoose.Schema(
  {
    name: { type: String, unique: true, required: true, trim: true }
  },
  { timestamps: true }
);

EquipmentTypeSchema.index({ name: 1 }, { unique: true });

export default mongoose.models.EquipmentType || mongoose.model('EquipmentType', EquipmentTypeSchema);
