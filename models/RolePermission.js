import mongoose from 'mongoose';

const RolePermissionSchema = new mongoose.Schema({
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  permission: { type: mongoose.Schema.Types.ObjectId, ref: 'Permission', required: true }
}, { timestamps: true });

RolePermissionSchema.index({ role: 1, permission: 1 }, { unique: true });

export default mongoose.models.RolePermission || mongoose.model('RolePermission', RolePermissionSchema);
