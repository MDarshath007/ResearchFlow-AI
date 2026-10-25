import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Report must be linked to a project'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ['Assessment', 'Reproducibility'],
        message: '{VALUE} is not a valid report type',
      },
      required: [true, 'Report type is required'],
    },
    documentationScore: {
      type: Number,
      default: 0,
      min: [0, 'Score cannot be negative'],
      max: [100, 'Score cannot exceed 100'],
    },
    testingScore: {
      type: Number,
      default: 0,
      min: [0, 'Score cannot be negative'],
      max: [100, 'Score cannot exceed 100'],
    },
    gitScore: {
      type: Number,
      default: 0,
      min: [0, 'Score cannot be negative'],
      max: [100, 'Score cannot exceed 100'],
    },
    collaborationScore: {
      type: Number,
      default: 0,
      min: [0, 'Score cannot be negative'],
      max: [100, 'Score cannot exceed 100'],
    },
    overallScore: {
      type: Number,
      default: 0,
      min: [0, 'Score cannot be negative'],
      max: [100, 'Score cannot exceed 100'],
    },
    status: {
      type: String,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    reproducibilityReport: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Report', reportSchema);
