import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
  },
  { _id: true }
);

const quizQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length >= 2,
        message: 'A quiz question needs at least two options',
      },
    },
    // Index into `options` — server-side scoring only, never returned to clients.
    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
    },
    explanation: {
      type: String,
      required: true,
    },
  },
  { _id: true }
);

const learningModuleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      default: 'Beginner',
    },
    estimatedMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    lessons: {
      type: [lessonSchema],
      default: [],
    },
    quiz: {
      type: [quizQuestionSchema],
      default: [],
    },
    published: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('LearningModule', learningModuleSchema);
