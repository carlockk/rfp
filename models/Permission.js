import mongoose from 'mongoose';

const PermissionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  module: { type: String, default: '', trim: true }
}, { timestamps: true });

PermissionSchema.index({ key: 1 }, { unique: true });

export default mongoose.models.Permission || mongoose.model('Permission', PermissionSchema);
