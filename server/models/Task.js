import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Comment must have an author'],
    },
    text: {
      type: String,
      required: [true, 'Comment text cannot be empty'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a task title'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Task must be associated with a project'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['Todo', 'In Progress', 'Review', 'Completed'],
        message: '{VALUE} is not a valid task status',
      },
      default: 'Todo',
      required: [true, 'Task status is required'],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deadline: {
      type: Date,
      default: null,
    },
    sprint: {
      type: String,
      default: 'Sprint 1',
      trim: true,
    },
    priority: {
      type: String,
      enum: {
        values: ['Low', 'Medium', 'High'],
        message: '{VALUE} is not a valid priority level',
      },
      default: 'Medium',
      required: [true, 'Task priority is required'],
    },
    comments: {
      type: [commentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Task', taskSchema);
