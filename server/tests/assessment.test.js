/**
 * tests/assessment.test.js
 *
 * Integration + unit tests for the Quality (Codebase) Assessment endpoint:
 *   POST /api/assessments/scan/:projectId
 *
 * Strategy
 * --------
 * • MongoDB models (Project, Report, Repository) are mocked with jest so
 *   the test suite never needs a live database.
 * • The `protect` auth middleware is replaced with a passthrough so tests
 *   do not need real JWTs.
 * • Real ZIP buffers are created in-memory with AdmZip and uploaded via
 *   Supertest multipart form-data, exercising the full request-to-response
 *   pipeline including AdmZip parsing and score calculation.
 *
 * Test cases
 * ----------
 * TC-A1  Empty ZIP  → 400 / score 0 / status "Failed"
 * TC-A2  Binary-only ZIP (PNG only) → 400 / score 0 / status "Failed"
 * TC-A3  Full project ZIP (README + tests + CI + Dockerfile + license) → 200 / score ≥ 70
 * TC-A4  README-only ZIP (no tests, no CI, no license) → 200 / score < 60
 * TC-A5  No file uploaded at all + no GitHub → 400 / score 0 / status "Failed"
 * TC-A6  Non-existent projectId → 404
 *
 * Run with:
 *   npm test
 */

import { jest, describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Mock all DB-touching modules BEFORE importing the app
// ---------------------------------------------------------------------------

// Mock mongoose so no real connection is opened
jest.unstable_mockModule('mongoose', () => ({
  default: {
    connect: jest.fn().mockResolvedValue({}),
    connection: { readyState: 1 },
    Schema: mongoose.Schema,
    model: mongoose.model.bind(mongoose),
    Types: mongoose.Types,
    isValidObjectId: mongoose.isValidObjectId.bind(mongoose),
  },
}));

// Shared in-memory store for mock project
let _mockProject = null;

jest.unstable_mockModule('../models/Project.js', () => ({
  default: {
    findById: jest.fn((_id) => Promise.resolve(_mockProject)),
  },
}));

jest.unstable_mockModule('../models/Report.js', () => ({
  default: {
    create: jest.fn((data) => Promise.resolve({ _id: 'report-id', ...data })),
    find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
    findOne: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue(null) }),
  },
}));

jest.unstable_mockModule('../models/Repository.js', () => ({
  default: {
    findOne: jest.fn().mockResolvedValue(null), // no connected GitHub repo by default
  },
}));

// Mock the auth middleware to be a passthrough in tests
jest.unstable_mockModule('../middleware/authMiddleware.js', () => ({
  protect: (req, _res, next) => {
    req.user = { _id: 'test-user-id', username: 'testuser', role: 'Researcher' };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
}));

// ---------------------------------------------------------------------------
// Now import app + fixtures (AFTER all mocks are registered)
// ---------------------------------------------------------------------------
const { createApp } = await import('./helpers/createApp.js');
const {
  buildFullProjectZip,
  buildReadmeOnlyZip,
  buildEmptyZip,
  buildBinaryOnlyZip,
} = await import('./helpers/zipFixtures.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const FAKE_PROJECT_ID = new mongoose.Types.ObjectId().toHexString();

/** Write a Buffer to a temp file, return the path */
function writeTempFile(buffer, filename) {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/** Remove a temp file (best-effort) */
function cleanupTempFile(filePath) {
  try { fs.unlinkSync(filePath); } catch { /* already cleaned up */ }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('Assessment Controller — POST /api/assessments/scan/:projectId', () => {
  let app;
  const tempFiles = [];

  const makeTempZip = (buffer, name) => {
    const p = writeTempFile(buffer, name);
    tempFiles.push(p);
    return p;
  };

  beforeAll(() => {
    app = createApp();
  });

  afterAll(() => {
    tempFiles.forEach(cleanupTempFile);
  });

  afterEach(() => {
    // Reset mock to default healthy project after each test
    _mockProject = {
      _id: FAKE_PROJECT_ID,
      name: 'Test Research Project',
      description: 'A research project for testing.',
      domain: 'Computer Science',
      status: 'Active',
      teamMembers: [],
      repositoryUrl: '',
      researchObjectives: [],
      maturityScore: 0,
      maturityLevel: 'Bronze',
      healthScore: 100,
      owner: 'test-user-id',
      save: jest.fn().mockResolvedValue(true),
    };
  });

  // ── TC-A1: Empty ZIP ───────────────────────────────────────────────────────
  it('TC-A1: Empty ZIP returns 400 with score 0 and status "Failed"', async () => {
    _mockProject = {
      _id: FAKE_PROJECT_ID,
      name: 'Test Project',
      description: 'desc',
      domain: 'ML',
      status: 'Active',
      teamMembers: [],
      repositoryUrl: '',
      researchObjectives: [],
      maturityScore: 0,
      maturityLevel: 'Bronze',
      healthScore: 100,
      owner: 'test-user-id',
      save: jest.fn().mockResolvedValue(true),
    };

    const zipPath = makeTempZip(buildEmptyZip(), 'empty.zip');

    const res = await request(app)
      .post(`/api/assessments/scan/${FAKE_PROJECT_ID}`)
      .attach('codebase', zipPath, { filename: 'empty.zip', contentType: 'application/zip' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.score).toBe(0);
    expect(res.body.status).toBe('Failed');
    expect(res.body.reason).toBeDefined();
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });

  // ── TC-A2: Binary-only ZIP ─────────────────────────────────────────────────
  it('TC-A2: ZIP containing only binary files returns 400 with score 0', async () => {
    _mockProject = {
      _id: FAKE_PROJECT_ID,
      name: 'Test Project',
      description: 'desc',
      domain: 'ML',
      status: 'Active',
      teamMembers: [],
      repositoryUrl: '',
      researchObjectives: [],
      maturityScore: 0,
      maturityLevel: 'Bronze',
      healthScore: 100,
      owner: 'test-user-id',
      save: jest.fn().mockResolvedValue(true),
    };

    const zipPath = makeTempZip(buildBinaryOnlyZip(), 'binary.zip');

    const res = await request(app)
      .post(`/api/assessments/scan/${FAKE_PROJECT_ID}`)
      .attach('codebase', zipPath, { filename: 'binary.zip', contentType: 'application/zip' });

    // The binary-only ZIP will be parsed (it is a valid ZIP), but contains no
    // classifiable source/doc/test/dependency/repro/ci files → all category
    // scores will be either null (unmeasurable) or 0. The evidence set
    // will produce 0 measured scores → 400 response.
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.score).toBe(0);
  });

  // ── TC-A3: Full research project ZIP ──────────────────────────────────────
  it('TC-A3: Full project ZIP (README + tests + CI + Dockerfile + license) returns 200 with score > 80', async () => {
    _mockProject = {
      _id: FAKE_PROJECT_ID,
      name: 'Full Research Project',
      description: 'A complete research software project.',
      domain: 'Machine Learning',
      status: 'Active',
      teamMembers: ['user1', 'user2', 'user3', 'user4'],
      repositoryUrl: '',
      researchObjectives: ['Develop classification model'],
      maturityScore: 0,
      maturityLevel: 'Bronze',
      healthScore: 100,
      owner: 'test-user-id',
      save: jest.fn().mockResolvedValue(true),
    };

    const zipPath = makeTempZip(buildFullProjectZip(), 'full-project.zip');

    const res = await request(app)
      .post(`/api/assessments/scan/${FAKE_PROJECT_ID}`)
      .attach('codebase', zipPath, { filename: 'full-project.zip', contentType: 'application/zip' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const report = res.body.data;
    expect(report).toBeDefined();
    expect(typeof report.overallScore).toBe('number');
    expect(report.overallScore).toBeGreaterThan(80);

    // Evidence-based details should be populated
    const details = report.details;
    expect(details).toBeDefined();
    expect(details.readmeFound).toBe(true);
    expect(details.testFilesCount).toBeGreaterThan(0);

    // File breakdown must exist
    expect(details.fileBreakdown).toBeDefined();
    expect(typeof details.fileBreakdown.tests).toBe('number');
    expect(typeof details.fileBreakdown.documentation).toBe('number');

    // Strengths list should have entries
    expect(Array.isArray(details.strengths)).toBe(true);
    expect(details.strengths.length).toBeGreaterThan(0);
  });

  // ── TC-A4: README-only ZIP ─────────────────────────────────────────────────
  it('TC-A4: README-only ZIP (no tests, no CI, no license) returns 200 with score < 60', async () => {
    _mockProject = {
      _id: FAKE_PROJECT_ID,
      name: 'Manuscript Only Project',
      description: 'Project with only a manuscript.',
      domain: 'Biology',
      status: 'Planning',
      teamMembers: [],
      repositoryUrl: '',
      researchObjectives: [],
      maturityScore: 0,
      maturityLevel: 'Bronze',
      healthScore: 100,
      owner: 'test-user-id',
      save: jest.fn().mockResolvedValue(true),
    };

    const zipPath = makeTempZip(buildReadmeOnlyZip(), 'readme-only.zip');

    const res = await request(app)
      .post(`/api/assessments/scan/${FAKE_PROJECT_ID}`)
      .attach('codebase', zipPath, { filename: 'readme-only.zip', contentType: 'application/zip' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const report = res.body.data;
    expect(report).toBeDefined();
    expect(typeof report.overallScore).toBe('number');
    expect(report.overallScore).toBeLessThan(60);

    // Weaknesses should flag the missing pieces
    const details = report.details;
    expect(Array.isArray(details.weaknesses)).toBe(true);
    expect(details.weaknesses.length).toBeGreaterThan(0);

    // No tests, no license, no CI — recommendations must exist
    expect(Array.isArray(details.recommendations)).toBe(true);
    expect(details.recommendations.length).toBeGreaterThan(0);
  });

  // ── TC-A5: No file at all ──────────────────────────────────────────────────
  it('TC-A5: No file uploaded and no GitHub repo → 400 / score 0 / status "Failed"', async () => {
    _mockProject = {
      _id: FAKE_PROJECT_ID,
      name: 'Empty Project',
      description: 'No files at all.',
      domain: 'Chemistry',
      status: 'Planning',
      teamMembers: [],
      repositoryUrl: '',
      researchObjectives: [],
      maturityScore: 0,
      maturityLevel: 'Bronze',
      healthScore: 100,
      owner: 'test-user-id',
      save: jest.fn().mockResolvedValue(true),
    };

    const res = await request(app)
      .post(`/api/assessments/scan/${FAKE_PROJECT_ID}`)
      // No .attach() call — no file in the request
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.score).toBe(0);
    expect(res.body.status).toBe('Failed');
    expect(Array.isArray(res.body.recommendations)).toBe(true);
  });

  // ── TC-A6: Non-existent project ────────────────────────────────────────────
  it('TC-A6: Non-existent projectId returns 404', async () => {
    _mockProject = null; // simulate Project.findById returning null

    const res = await request(app)
      .post(`/api/assessments/scan/${FAKE_PROJECT_ID}`)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  // ── TC-A7: Response shape contract ─────────────────────────────────────────
  it('TC-A7: Successful assessment response matches expected shape', async () => {
    _mockProject = {
      _id: FAKE_PROJECT_ID,
      name: 'Shape Test Project',
      description: 'Testing the response shape.',
      domain: 'Physics',
      status: 'Active',
      teamMembers: [],
      repositoryUrl: '',
      researchObjectives: [],
      maturityScore: 0,
      maturityLevel: 'Bronze',
      healthScore: 100,
      owner: 'test-user-id',
      save: jest.fn().mockResolvedValue(true),
    };

    const zipPath = makeTempZip(buildFullProjectZip(), 'shape-test.zip');

    const res = await request(app)
      .post(`/api/assessments/scan/${FAKE_PROJECT_ID}`)
      .attach('codebase', zipPath, { filename: 'shape-test.zip', contentType: 'application/zip' });

    expect(res.status).toBe(200);

    // Top-level shape
    expect(res.body).toMatchObject({
      success: true,
      message: expect.any(String),
      data: expect.objectContaining({
        overallScore: expect.any(Number),
        details: expect.objectContaining({
          readmeFound: expect.any(Boolean),
          testFilesCount: expect.any(Number),
          fileBreakdown: expect.objectContaining({
            documentation: expect.any(Number),
            tests: expect.any(Number),
            source: expect.any(Number),
            dependencies: expect.any(Number),
            reproducibility: expect.any(Number),
            ci: expect.any(Number),
          }),
          evidence: expect.any(Object),
          categories: expect.any(Object),
          strengths: expect.any(Array),
          weaknesses: expect.any(Array),
          recommendations: expect.any(Array),
        }),
      }),
      project: expect.objectContaining({
        maturityScore: expect.any(Number),
        maturityLevel: expect.any(String),
        healthScore: expect.any(Number),
      }),
    });

    // Score is within valid range
    const { overallScore } = res.body.data;
    expect(overallScore).toBeGreaterThanOrEqual(0);
    expect(overallScore).toBeLessThanOrEqual(100);
  });

  it('TC-A8: Invalid ZIP returns a structured failure with score 0', async () => {
    _mockProject = {
      _id: FAKE_PROJECT_ID,
      name: 'Invalid Archive Project',
      description: 'An invalid archive test.',
      domain: 'Computer Science',
      status: 'Active',
      teamMembers: [],
      repositoryUrl: '',
      researchObjectives: [],
      maturityScore: 0,
      maturityLevel: 'Bronze',
      healthScore: 100,
      owner: 'test-user-id',
      save: jest.fn().mockResolvedValue(true),
    };

    const zipPath = makeTempZip(Buffer.from('not a ZIP archive'), 'invalid.zip');

    const res = await request(app)
      .post(`/api/assessments/scan/${FAKE_PROJECT_ID}`)
      .attach('codebase', zipPath, { filename: 'invalid.zip', contentType: 'application/zip' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.score).toBe(0);
    expect(res.body.status).toBe('Failed');
  });
});
