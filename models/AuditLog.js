import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true, trim: true },
  module: { type: String, default: '', trim: true },
  subject: { type: String, default: '', trim: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId },
  permission: { type: mongoose.Schema.Types.ObjectId, ref: 'Permission' },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

export default mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
