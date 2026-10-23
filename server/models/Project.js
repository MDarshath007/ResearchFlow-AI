import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a project name'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please add a project description'],
      trim: true,
      default: '',
    },
    domain: {
      type: String,
      required: [true, 'Please add a research domain'],
      default: 'General Research',
      trim: true,
    },
    teamMembers: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },
    repositoryUrl: {
      type: String,
      default: '',
      trim: true,
    },
    deadline: {
      type: Date,
      default: null,
    },
    researchObjectives: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: {
        values: ['Planning', 'Active', 'Review', 'Completed'],
        message: '{VALUE} is not a valid project status',
      },
      default: 'Planning',
      required: [true, 'Project status is required'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Project owner is required'],
      index: true,
    },
    maturityScore: {
      type: Number,
      default: 0,
      min: [0, 'Maturity score cannot be negative'],
      max: [100, 'Maturity score cannot exceed 100'],
    },
    maturityLevel: {
      type: String,
      enum: {
        values: ['Bronze', 'Silver', 'Gold', 'Platinum'],
        message: '{VALUE} is not a valid maturity level',
      },
      default: 'Bronze',
      required: [true, 'Maturity level is required'],
    },
    healthScore: {
      type: Number,
      default: 100,
      min: [0, 'Health score cannot be negative'],
      max: [100, 'Health score cannot exceed 100'],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Project', projectSchema);
