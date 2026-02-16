import mongoose, { Document, Schema, Model } from 'mongoose';

export type WorkflowMode = 'auto' | 'manual';

export interface IWorkflowSettings extends Document {
  _id: string;
  mode: WorkflowMode;
  autoApprovalEnabled: boolean;
  minFaceMatchScore: number;
  requireManualReviewAbove: number;
  notifyOnAutoApproval: boolean;
  notifyOnManualRequired: boolean;
  flexcubeEndpoint: string;
  flexcubeEnabled: boolean;
  updatedAt: Date;
  updatedBy: string;
}

const WorkflowSettingsSchema = new Schema<IWorkflowSettings>({
  _id: { type: String, default: 'default' },
  mode: {
    type: String,
    enum: ['auto', 'manual'],
    default: 'manual',
  },
  autoApprovalEnabled: {
    type: Boolean,
    default: false,
  },
  minFaceMatchScore: {
    type: Number,
    default: 85,
    min: 50,
    max: 100,
  },
  requireManualReviewAbove: {
    type: Number,
    default: 100000,
  },
  notifyOnAutoApproval: {
    type: Boolean,
    default: true,
  },
  notifyOnManualRequired: {
    type: Boolean,
    default: true,
  },
  flexcubeEndpoint: {
    type: String,
    default: 'http://localhost:5000/api/flexcube/create-customer',
  },
  flexcubeEnabled: {
    type: Boolean,
    default: true,
  },
  updatedBy: {
    type: String,
    default: 'system',
  },
}, {
  timestamps: true,
  _id: false,
});

// Default settings
export const defaultWorkflowSettings: Partial<IWorkflowSettings> = {
  _id: 'default',
  mode: 'manual',
  autoApprovalEnabled: false,
  minFaceMatchScore: 85,
  requireManualReviewAbove: 100000,
  notifyOnAutoApproval: true,
  notifyOnManualRequired: true,
  flexcubeEndpoint: 'http://localhost:5000/api/flexcube/create-customer',
  flexcubeEnabled: true,
  updatedBy: 'system',
};

let WorkflowSettings: Model<IWorkflowSettings>;

try {
  WorkflowSettings = mongoose.model<IWorkflowSettings>('WorkflowSettings');
} catch {
  WorkflowSettings = mongoose.model<IWorkflowSettings>('WorkflowSettings', WorkflowSettingsSchema);
}

export default WorkflowSettings;
