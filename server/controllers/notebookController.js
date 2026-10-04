import Document from '../models/Document.js';
import Project from '../models/Project.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Helper to resolve file type based on mime/extension
const resolveFileType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.ipynb') return 'Jupyter Notebook';
  if (ext === '.pdf') return 'PDF';
  if (ext === '.docx') return 'DOCX';
  if (ext === '.csv') return 'CSV';
  if (ext === '.xlsx' || ext === '.xls') return 'XLSX';
  return 'PDF'; // Fallback
};

// @desc    Upload notebook file/dataset to repository
// @route   POST /api/notebooks/upload/:projectId
// @access  Private
const uploadNotebookFile = async (req, res) => {
  const { projectId } = req.params;
  const { title, category, tags } = req.body;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const fileType = resolveFileType(req.file.originalname);
    
    // Parse tags (expected as JSON string or comma-separated string)
    let tagsArray = [];
    if (tags) {
      try {
        tagsArray = JSON.parse(tags);
      } catch (e) {
        tagsArray = tags.split(',').map(tag => tag.trim());
      }
    }

    const document = await Document.create({
      project: projectId,
      title: title || req.file.originalname,
      fileName: req.file.originalname,
      fileUrl: `/uploads/${req.file.filename}`,
      fileType,
      category: category || 'Notebook',
      uploadedBy: req.user._id,
      fileSize: req.file.size,
      tags: tagsArray,
    });

    const populatedDoc = await Document.findById(document._id)
      .populate('uploadedBy', 'username email avatar role');

    res.status(201).json({ success: true, data: populatedDoc });

  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all files for project with optional search filter
// @route   GET /api/notebooks/project/:projectId
// @access  Private
const getNotebooksByProject = async (req, res) => {
  const { projectId } = req.params;
  const { search, category } = req.query;

  try {
    let query = { project: projectId };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { fileName: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const documents = await Document.find(query)
      .populate('uploadedBy', 'username email avatar role')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: documents });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete document from repository
// @route   DELETE /api/notebooks/:id
// @access  Private
const deleteNotebookFile = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Access authorization check
    const project = await Project.findById(document.project);
    if (project.owner.toString() !== req.user._id.toString() && document.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this file' });
    }

    // Try deleting physical file
    const filePath = path.join(__dirname, '..', document.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await document.deleteOne();
    res.json({ success: true, message: 'Document deleted successfully' });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  uploadNotebookFile,
  getNotebooksByProject,
  deleteNotebookFile,
};

