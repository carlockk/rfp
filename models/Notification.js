import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  message: { type: String, required: true, trim: true },
  type: { type: String, enum: ['alert', 'info', 'warning'], default: 'info' },
  level: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  audience: { type: String, enum: ['admin', 'technician', 'all'], default: 'admin' },
  recipients: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
  metadata: { type: mongoose.Schema.Types.Mixed },
  readBy: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ audience: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } });

export default mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
