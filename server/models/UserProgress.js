import mongoose from 'mongoose';

const userProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningModule',
      required: [true, 'Learning module reference is required'],
      index: true,
    },
    completed: {
      type: Boolean,
      default: false,
      required: [true, 'Completion status is required'],
    },
    completedAt: {
      type: Date,
      default: null,
    },
    quizScore: {
      // Latest quiz result (correct answers count). null = never attempted.
      type: Number,
      default: null,
      min: [0, 'Quiz score cannot be negative'],
    },
    quizAttempts: {
      type: Number,
      default: 0,
      min: [0, 'Quiz attempts cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// One progress record per user per module.
userProgressSchema.index({ user: 1, module: 1 }, { unique: true });

export default mongoose.model('UserProgress', userProgressSchema);
