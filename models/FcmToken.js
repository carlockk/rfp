import mongoose from 'mongoose';

const FcmTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    platform: { type: String, default: '' },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.models.FcmToken || mongoose.model('FcmToken', FcmTokenSchema);
