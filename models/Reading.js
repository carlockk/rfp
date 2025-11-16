
import mongoose from 'mongoose';

const ReadingSchema = new mongoose.Schema({
  equipmentId: { type: mongoose.Types.ObjectId, ref: 'Equipment', required: true },
  userId: { type: mongoose.Types.ObjectId, ref: 'User' },
  kind: { type: String, enum: ['uso','combustible','adblue','kwh','fin_uso'], default: 'uso' },
  hourmeter: Number,
  odometer: Number,
  liters: Number,
  adblueLiters: Number,
  kwh: Number,
  note: String,
  photoUrl: String
}, { timestamps: true });

ReadingSchema.index({ equipmentId: 1, createdAt: -1 });
ReadingSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.Reading || mongoose.model('Reading', ReadingSchema);
