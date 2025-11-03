import mongoose from 'mongoose';

const RoleSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  isSystem: { type: Boolean, default: false }
}, { timestamps: true });

RoleSchema.index({ key: 1 }, { unique: true });

export default mongoose.models.Role || mongoose.model('Role', RoleSchema);
