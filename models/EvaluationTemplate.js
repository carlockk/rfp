import mongoose from 'mongoose';

const TemplateFieldSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['number', 'text', 'textarea', 'select', 'date', 'time', 'boolean', 'file', 'section'],
    default: 'text'
  },
  required: { type: Boolean, default: false },
  helpText: { type: String, default: '' },
  unit: { type: String, default: '' },
  defaultValue: { type: mongoose.Schema.Types.Mixed, default: null },
  options: {
    type: [
      {
        value: { type: String, required: true },
        label: { type: String, required: true }
      }
    ],
    default: undefined
  },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

TemplateFieldSchema.add({
  children: { type: [TemplateFieldSchema], default: [] }
});

const EvaluationTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  techProfile: { type: String, enum: ['externo', 'candelaria', 'todos'], default: 'todos' },
  equipmentTypes: { type: [String], default: [] },
  equipmentIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Equipment', default: [] },
  isChecklistMandatory: { type: Boolean, default: true },
  fields: { type: [TemplateFieldSchema], default: [] },
  attachmentsEnabled: { type: Boolean, default: true },
  maxAttachments: { type: Number, default: 3 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

EvaluationTemplateSchema.index({ name: 1 }, { unique: true });
EvaluationTemplateSchema.index({ techProfile: 1, isActive: 1 });
EvaluationTemplateSchema.index({ equipmentTypes: 1 });
EvaluationTemplateSchema.index({ equipmentIds: 1 });

export default mongoose.models.EvaluationTemplate || mongoose.model('EvaluationTemplate', EvaluationTemplateSchema);
