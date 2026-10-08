import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getModules,
  getModule,
  submitQuiz,
  completeModule,
} from '../controllers/learningController.js';

const router = express.Router();

// All learning routes require authentication.
router.get('/modules', protect, getModules);
router.get('/modules/:id', protect, getModule);
router.post('/modules/:id/quiz', protect, submitQuiz);
router.post('/modules/:id/complete', protect, completeModule);

export default router;
