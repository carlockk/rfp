
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'admin', 'tecnico'], default: 'tecnico' }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
