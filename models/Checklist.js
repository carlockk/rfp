import mongoose from 'mongoose';

const ChecklistOptionSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true }
}, { _id: false });

const ChecklistNodeSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  inputType: {
    type: String,
    enum: ['section', 'select', 'text', 'number', 'checkbox', 'textarea'],
    default: 'section'
  },
  required: { type: Boolean, default: false },
  allowMultiple: { type: Boolean, default: false },
  options: { type: [ChecklistOptionSchema], default: undefined }
}, { _id: false });

ChecklistNodeSchema.add({
  children: { type: [ChecklistNodeSchema], default: [] }
});

const ChecklistVersionSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  title: { type: String, default: '' },
  summary: { type: String, default: '' },
  notes: { type: String, default: '' },
  nodes: { type: [ChecklistNodeSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const ChecklistSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  equipmentType: { type: String, default: '', trim: true },
  tags: { type: [String], default: [] },
  currentVersion: { type: Number, default: 1 },
  versions: { type: [ChecklistVersionSchema], default: [] },
  isActive: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

ChecklistSchema.index({ name: 1, equipmentType: 1 });
ChecklistSchema.index({ currentVersion: -1 });

export default mongoose.models.Checklist || mongoose.model('Checklist', ChecklistSchema);
