import mongoose from 'mongoose';

const EvaluationResponseSchema = new mongoose.Schema({
  itemKey: { type: String, required: true, trim: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  note: { type: String, default: '' }
}, { _id: false });

const EvaluationSchema = new mongoose.Schema({
  checklist: { type: mongoose.Schema.Types.ObjectId, ref: 'Checklist', default: null },
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
  completedAt: { type: Date, default: Date.now },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvaluationTemplate', default: null },
  templateName: { type: String, default: '' },
  templateValues: { type: mongoose.Schema.Types.Mixed },
  templateFields: { type: mongoose.Schema.Types.Mixed },
  templateAttachments: {
    type: [
      {
        name: { type: String, required: true },
        size: { type: Number, required: true },
        type: { type: String, required: true },
        url: { type: String, default: '' },
        dataUrl: { type: String, default: '' }
      }
    ],
    default: []
  },
  evidencePhotos: {
    type: [
      {
        name: { type: String, required: true },
        size: { type: Number, required: true },
        type: { type: String, required: true },
        url: { type: String, default: '' },
        dataUrl: { type: String, default: '' }
      }
    ],
    default: []
  },
  anomalyRecipients: { type: [String], default: [] },
  skipChecklist: { type: Boolean, default: false },
  hourmeterCurrent: { type: Number, default: null },
  hourmeterPrevious: { type: Number, default: null },
  hourmeterDelta: { type: Number, default: null },
  odometerCurrent: { type: Number, default: null },
  odometerPrevious: { type: Number, default: null },
  odometerDelta: { type: Number, default: null },
  fuelLevelBefore: { type: Number, default: null },
  fuelLevelAfter: { type: Number, default: null },
  fuelAddedLiters: { type: Number, default: null },
  energyAddedKwh: { type: Number, default: null },
  adblueAddedLiters: { type: Number, default: null },
  batteryLevelBefore: { type: Number, default: null },
  batteryLevelAfter: { type: Number, default: null },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  supervisorName: { type: String, default: '' },
  supervisorPhone: { type: String, default: '' },
  supervisorStatus: {
    type: String,
    enum: ['pendiente', 'en_revision', 'aprobado', 'rechazado'],
    default: 'pendiente'
  },
  supervisorNote: { type: String, default: '' },
  supervisorStatusAt: { type: Date, default: null },
  supervisorAssignedAt: { type: Date, default: null }
}, { timestamps: true });

EvaluationSchema.index({ completedAt: -1 });
EvaluationSchema.index({ equipment: 1, technician: 1, completedAt: -1 });
EvaluationSchema.index({ equipment: 1, completedAt: -1 });
EvaluationSchema.index({ templateId: 1, completedAt: -1 });
EvaluationSchema.index({ supervisor: 1, completedAt: -1 });

export default mongoose.models.Evaluation || mongoose.model('Evaluation', EvaluationSchema);
