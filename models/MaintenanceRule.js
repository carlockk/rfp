
import mongoose from 'mongoose';

const MaintenanceRuleSchema = new mongoose.Schema({
  equipmentType: { type: String, required: true }, // o 'all'
  title: { type: String, required: true },
  // disparadores
  everyHours: Number,
  everyKm: Number,
  everyDays: Number,
  // anticipación para alertar
  warnHours: { type: Number, default: 20 },
  warnKm: { type: Number, default: 200 },
  warnDays: { type: Number, default: 15 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.models.MaintenanceRule || mongoose.model('MaintenanceRule', MaintenanceRuleSchema);
