import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Document must be associated with a project'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please add a document title'],
      trim: true,
      default: 'Untitled Document',
    },
    fileName: {
      type: String,
      required: [true, 'Please specify the file name'],
      trim: true,
    },
    fileUrl: {
      type: String,
      required: [true, 'Please provide the file URL'],
      trim: true,
    },
    fileType: {
      type: String,
      enum: {
        values: ['PDF', 'DOCX', 'CSV', 'XLSX', 'Jupyter Notebook'],
        message: '{VALUE} is not a supported file type',
      },
      required: [true, 'Please specify the file type'],
      default: 'PDF',
    },
    category: {
      type: String,
      enum: {
        values: ['Notebook', 'Paper', 'Dataset', 'Report', 'Other'],
        message: '{VALUE} is not a valid document category',
      },
      default: 'Notebook',
      required: [true, 'Please specify the document category'],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader reference is required'],
    },
    fileSize: {
      type: Number,
      required: [true, 'File size in bytes is required'],
      default: 0,
      min: [0, 'File size cannot be negative'],
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Document', documentSchema);
