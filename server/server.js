import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import reproducibilityRoutes from './routes/reproducibilityRoutes.js';
import githubRoutes from './routes/githubRoutes.js';
import collaborationRoutes from './routes/collaborationRoutes.js';
import notebookRoutes from './routes/notebookRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import learningRoutes from './routes/learningRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Enable CORS
app.use(cors());

// Set static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reproducibility', reproducibilityRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/notebooks', notebookRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/learning', learningRoutes);

// Basic testing route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to ResearchFlow AI API. Systems operational.' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error',
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in development mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

