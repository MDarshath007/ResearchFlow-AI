/**
 * tests/helpers/createApp.js
 *
 * Builds a fully-wired Express app identical to server.js BUT:
 *   - Does NOT call connectDB() (MongoDB is mocked by the test suite)
 *   - Does NOT call app.listen() — Supertest manages the port
 *
 * This file is imported by both test suites so they share one app factory.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import assessmentRoutes from '../../routes/assessmentRoutes.js';
import reproducibilityRoutes from '../../routes/reproducibilityRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cors());
  app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

  app.use('/api/assessments', assessmentRoutes);
  app.use('/api/reproducibility', reproducibilityRoutes);

  // JSON 404 for anything else
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, message: 'API route not found' });
  });

  // Error handler (mirrors server.js)
  app.use((err, _req, res, _next) => {
    const isMulter =
      err.name === 'MulterError' ||
      (typeof err.code === 'string' && err.code.startsWith('LIMIT_'));
    const status = isMulter ? 400 : err.status || err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message || 'Server Error' });
  });

  return app;
}
