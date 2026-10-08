import mongoose from 'mongoose';

const userProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningModule',
      required: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    quizScore: {
      // Latest quiz result (correct answers count). null = never attempted.
      type: Number,
      default: null,
    },
    quizAttempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // provides createdAt + updatedAt
  }
);

// One progress record per user per module.
userProgressSchema.index({ user: 1, module: 1 }, { unique: true });

export default mongoose.model('UserProgress', userProgressSchema);
