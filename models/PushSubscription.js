import mongoose from 'mongoose';

const PushSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpoint: { type: String, required: true, unique: true, trim: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  userAgent: { type: String, default: '' },
  platform: { type: String, default: '' },
  subscribedAt: { type: Date, default: Date.now }
}, { timestamps: true });

PushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });
PushSubscriptionSchema.index({ createdAt: -1 });

export default mongoose.models.PushSubscription || mongoose.model('PushSubscription', PushSubscriptionSchema);
