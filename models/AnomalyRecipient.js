import mongoose from 'mongoose';

const AnomalyRecipientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

AnomalyRecipientSchema.index({ email: 1 }, { unique: true, sparse: true });

export default mongoose.models.AnomalyRecipient || mongoose.model('AnomalyRecipient', AnomalyRecipientSchema);
