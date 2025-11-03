import mongoose from 'mongoose';

const EvaluationResponseSchema = new mongoose.Schema({
  itemKey: { type: String, required: true, trim: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  note: { type: String, default: '' }
}, { _id: false });

const EvaluationSchema = new mongoose.Schema({
  checklist: { type: mongoose.Schema.Types.ObjectId, ref: 'Checklist', required: true },
  equipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true },
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['ok', 'observado', 'critico'], default: 'ok' },
  responses: { type: [EvaluationResponseSchema], default: [] },
  observations: { type: String, default: '' },
  startedAt: { type: Date, default: Date.now },
  finishedAt: { type: Date, default: Date.now },
  durationSeconds: { type: Number, default: 0 },
  formData: { type: mongoose.Schema.Types.Mixed },
  checklistVersion: { type: Number, default: 1 },
  completedAt: { type: Date, default: Date.now }
}, { timestamps: true });

EvaluationSchema.index({ completedAt: -1 });
EvaluationSchema.index({ equipment: 1, technician: 1, completedAt: -1 });

export default mongoose.models.Evaluation || mongoose.model('Evaluation', EvaluationSchema);
