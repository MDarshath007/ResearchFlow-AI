/**
 * tests/reproducibility.test.js
 *
 * Integration + unit tests for the Reproducibility Audit endpoint:
 *   POST /api/reproducibility/check/:projectId
 *
 * Strategy
 * --------
 * • MongoDB models (Project, Report) are mocked — no live database needed.
 * • The `protect` auth middleware is replaced with a passthrough.
 * • Text fixture files are written to OS temp directory and uploaded via
 *   Supertest multipart form-data, exercising the full file-analysis pipeline.
 *
 * Test cases
 * ----------
 * TC-R1  No files uploaded → 400 (no files to audit)
 * TC-R2  Binary-only files (PDF + PNG) → score 0, status "Failed"
 * TC-R3  Empty requirements.txt → invalid-content and missing-artifact deductions
 * TC-R4  Valid requirements.txt with pinned versions → missing-manifest deductions
 * TC-R5  requirements.txt with ALL unpinned deps → 200, score reduced from 100
 * TC-R6  Valid Dockerfile (FROM + WORKDIR present) → 200, dockerfile check passed
 * TC-R7  Dockerfile missing FROM directive → 200, dockerfile check failed, score reduced
 * TC-R8  Manuscript-only text file (no runtime manifests) → score 0, status "Failed"
 * TC-R9  package.json with unpinned versions → 200, score reduced
 * TC-R10 Non-existent projectId → 404
 * TC-R11 Valid .ipynb notebook (executed, seeded randomness) → 200, notebook passed
 * TC-R12 Response shape contract (all required fields present)
 *
 * Run with:
 *   npm test
 */

import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Mock all DB-touching modules BEFORE importing the app
// ---------------------------------------------------------------------------

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
  default: { findOne: jest.fn().mockResolvedValue(null) },
}));

jest.unstable_mockModule('../middleware/authMiddleware.js', () => ({
  protect: (req, _res, next) => {
    req.user = { _id: 'test-user-id', username: 'testuser', role: 'Researcher' };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
}));

// ---------------------------------------------------------------------------
// Import app AFTER mocks
// ---------------------------------------------------------------------------
const { createApp } = await import('./helpers/createApp.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const FAKE_PROJECT_ID = new mongoose.Types.ObjectId().toHexString();

const tmpFiles = [];

function writeTmp(filename, content) {
  const p = path.join(os.tmpdir(), filename);
  fs.writeFileSync(p, content, typeof content === 'string' ? 'utf8' : undefined);
  tmpFiles.push(p);
  return p;
}

function makeProject(overrides = {}) {
  return {
    _id: FAKE_PROJECT_ID,
    name: 'Test Research Project',
    description: 'A research project.',
    domain: 'Computer Science',
    status: 'Active',
    teamMembers: [],
    owner: 'test-user-id',
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixture content strings
// ---------------------------------------------------------------------------

const PINNED_REQUIREMENTS = [
  'numpy==1.26.4',
  'pandas==2.2.1',
  'scikit-learn==1.4.2',
  'matplotlib==3.8.4',
  'pytest==8.1.1',
].join('\n');

const UNPINNED_REQUIREMENTS = ['numpy', 'pandas', 'scikit-learn', 'matplotlib'].join('\n');

const GOOD_DOCKERFILE = [
  'FROM python:3.11-slim',
  'WORKDIR /app',
  'COPY requirements.txt .',
  'RUN pip install -r requirements.txt',
  'COPY . .',
  'CMD ["python", "main.py"]',
].join('\n');

const BAD_DOCKERFILE = [
  '# Container configuration without a base image',
  'WORKDIR /app',
  'RUN pip install numpy',
].join('\n');

const PINNED_PACKAGE_JSON = JSON.stringify({
  name: 'research-tool',
  version: '1.0.0',
  dependencies: {
    express: '4.19.2',
    axios: '1.6.8',
  },
});

const UNPINNED_PACKAGE_JSON = JSON.stringify({
  name: 'research-tool',
  version: '1.0.0',
  dependencies: {
    express: '^4.19.2',
    axios: '~1.6.8',
    lodash: 'latest',
  },
});

const MANUSCRIPT_TEXT = [
  'Abstract: This paper presents a novel method for protein folding prediction.',
  'Introduction: The problem of protein folding has been studied for decades.',
  'Methods: We use a transformer-based architecture trained on PDB data.',
  'Results: Our model achieves 92% accuracy on the CASP14 benchmark.',
  'Conclusion: We demonstrate state-of-the-art performance.',
].join('\n\n');

// A minimal valid .ipynb with one executed code cell, seeded randomness, and
// all imports from standard library only.
const GOOD_NOTEBOOK = JSON.stringify({
  nbformat: 4,
  nbformat_minor: 5,
  cells: [
    {
      cell_type: 'code',
      execution_count: 1,
      source: [
        'import random\n',
        'random.seed(42)\n',
        'result = random.randint(0, 100)\n',
        'print(result)\n',
      ],
      outputs: [{ output_type: 'stream', name: 'stdout', text: ['73\n'] }],
      metadata: {},
    },
    {
      cell_type: 'markdown',
      source: ['# Analysis\n', 'This notebook computes a seeded random result.\n'],
      metadata: {},
    },
  ],
  metadata: {
    kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
    language_info: { name: 'python', version: '3.11.0' },
  },
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('Reproducibility Controller — POST /api/reproducibility/check/:projectId', () => {
  let app;

  beforeAll(() => {
    app = createApp();
    _mockProject = makeProject();
  });

  afterAll(() => {
    tmpFiles.forEach((p) => {
      try { fs.unlinkSync(p); } catch { /* already gone */ }
    });
  });

  // ── TC-R1: No files ────────────────────────────────────────────────────────
  it('TC-R1: No files uploaded returns a structured zero-score failure', async () => {
    _mockProject = makeProject();

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.score).toBe(0);
    expect(res.body.readinessRating).toBe('Low');
    expect(res.body.status).toBe('Failed');
    expect(res.body.message).toBe('No files were uploaded. Please attach project files or manifests to run a Reproducibility Audit.');
  });

  // ── TC-R2: Binary-only (PDF + PNG) → score 0 / status Failed ──────────────
  it('TC-R2: Binary-only uploads return score 0 with status "Failed"', async () => {
    _mockProject = makeProject();

    // Minimal fake PDF header (not a real PDF, but has .pdf extension)
    const pdfPath = writeTmp('test.pdf', Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]));
    const pngPath = writeTmp('figure.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', pdfPath, { filename: 'test.pdf', contentType: 'application/pdf' })
      .attach('files', pngPath, { filename: 'figure.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('Failed');
    expect(res.body.data.overallScore).toBe(0);
    expect(res.body.data.reproducibilityReport.readinessRating).toBe('Low');
    expect(res.body.data.reproducibilityReport.failedChecks.join(' ')).toMatch(/No reproducible runtime manifests/);
  });

  // ── TC-R3: Empty manifest and missing artifacts incur deductions ───────────
  it('TC-R3: Empty requirements.txt incurs missing-artifact and invalid-content deductions', async () => {
    _mockProject = makeProject();

    const emptyTxt = writeTmp('empty.txt', '   ');

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', emptyTxt, { filename: 'requirements.txt', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overallScore).toBeLessThan(100);
    expect(res.body.data.reproducibilityReport.readinessRating).toBe('Low');
    expect(res.body.data.reproducibilityReport.failedChecks.join(' ')).toMatch(/Readable runtime manifest/);
  });

  // ── TC-R4: Pinned requirements.txt with missing manifests is scored low ───
  it('TC-R4: Fully-pinned requirements.txt receives missing-manifest deductions', async () => {
    _mockProject = makeProject();

    const reqPath = writeTmp('requirements.txt', PINNED_REQUIREMENTS);

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', reqPath, { filename: 'requirements.txt', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const rr = res.body.data.reproducibilityReport;
    expect(rr).toBeDefined();
    expect(res.body.data.overallScore).toBe(35);
    expect(rr.readinessRating).toBe('Low');
    expect(rr.requirementsTxtPresent).toBe(true);

    // The pinning check should be in passed checks
    const passedLabels = rr.passedChecks.join(' ');
    expect(passedLabels).toMatch(/requirements/i);
  });

  // ── TC-R5: Unpinned requirements.txt → score reduced ──────────────────────
  it('TC-R5: Unpinned requirements.txt returns 200 with score < 100', async () => {
    _mockProject = makeProject();

    const reqPath = writeTmp('requirements-unpinned.txt', UNPINNED_REQUIREMENTS);

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', reqPath, { filename: 'requirements.txt', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overallScore).toBeLessThan(100);

    const rr = res.body.data.reproducibilityReport;
    // The pinning check should appear in failed checks
    const failedLabels = rr.failedChecks.join(' ');
    expect(failedLabels).toMatch(/requirements/i);

    // Should recommend pinning
    const allRecs = [...rr.recommendations, ...rr.suggestions].join(' ');
    expect(allRecs).toMatch(/pin/i);
  });

  // ── TC-R6: Valid Dockerfile → check passed ─────────────────────────────────
  it('TC-R6: Valid Dockerfile (FROM + WORKDIR) returns 200 with dockerfile check passed', async () => {
    _mockProject = makeProject();

    const dockerPath = writeTmp('Dockerfile', GOOD_DOCKERFILE);

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', dockerPath, { filename: 'Dockerfile', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const rr = res.body.data.reproducibilityReport;
    expect(rr.dockerFilePresent).toBe(true);
    expect(res.body.data.overallScore).toBe(35);
    expect(rr.readinessRating).toBe('Low');
    const passedLabels = rr.passedChecks.join(' ');
    expect(passedLabels).toMatch(/dockerfile/i);
  });

  // ── TC-R7: Bad Dockerfile (missing FROM) → check failed ────────────────────
  it('TC-R7: Dockerfile missing FROM returns 200 with dockerfile check failed and reduced score', async () => {
    _mockProject = makeProject();

    const dockerPath = writeTmp('Dockerfile-bad', BAD_DOCKERFILE);

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', dockerPath, { filename: 'Dockerfile', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overallScore).toBeLessThan(100);

    const rr = res.body.data.reproducibilityReport;
    const failedLabels = rr.failedChecks.join(' ');
    expect(failedLabels).toMatch(/dockerfile/i);
  });

  // ── TC-R8: Manuscript-only text file fails the runtime-manifest gate ───────
  it('TC-R8: Manuscript-only upload returns score 0 with status "Failed"', async () => {
    _mockProject = makeProject();

    const txtPath = writeTmp('manuscript.txt', MANUSCRIPT_TEXT);

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', txtPath, { filename: 'manuscript.txt', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('Failed');

    const rr = res.body.data.reproducibilityReport;

    // None of the flag booleans should be true
    expect(rr.dockerFilePresent).toBe(false);
    expect(rr.requirementsTxtPresent).toBe(false);
    expect(rr.packageJsonPresent).toBe(false);
    expect(rr.envExamplePresent).toBe(false);

    // Config checks are skipped; missing manifests and the manifest gate fail.
    const allChecks = res.body.data.reproducibilityReport;
    expect(allChecks.failedChecks.join(' ')).toMatch(/No reproducible runtime manifests/);
    expect(allChecks.passedChecks.length).toBe(0);
    expect(res.body.data.overallScore).toBe(0);
    expect(allChecks.warnings.join(' ')).toMatch(/source code/i);
    expect(allChecks.warnings.join(' ')).toMatch(/dataset/i);
  });

  // ── TC-R9: Unpinned package.json → score reduced ──────────────────────────
  it('TC-R9: package.json with unpinned deps returns 200 with score < 100', async () => {
    _mockProject = makeProject();

    const pkgPath = writeTmp('package.json', UNPINNED_PACKAGE_JSON);

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', pkgPath, { filename: 'package.json', contentType: 'application/json' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overallScore).toBeLessThan(100);

    const rr = res.body.data.reproducibilityReport;
    expect(rr.packageJsonPresent).toBe(true);

    // Unpinned deps should appear in the report
    expect(rr.unversionedDependencies.length).toBeGreaterThan(0);

    const failedLabels = rr.failedChecks.join(' ');
    expect(failedLabels).toMatch(/package/i);
  });

  // ── TC-R10: Non-existent project → 404 ────────────────────────────────────
  it('TC-R10: Non-existent projectId returns 404', async () => {
    _mockProject = null; // simulate Project.findById → null

    const reqPath = writeTmp('req-for-404.txt', PINNED_REQUIREMENTS);

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', reqPath, { filename: 'requirements.txt', contentType: 'text/plain' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);

    // Restore for subsequent tests
    _mockProject = makeProject();
  });

  // ── TC-R11: Valid .ipynb notebook → notebook passed ───────────────────────
  it('TC-R11: Valid .ipynb with executed cells and seeded randomness returns 200 with notebook passed', async () => {
    _mockProject = makeProject();

    const nbPath = writeTmp('analysis.ipynb', GOOD_NOTEBOOK);

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', nbPath, { filename: 'analysis.ipynb', contentType: 'application/json' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const rr = res.body.data.reproducibilityReport;
    expect(Array.isArray(rr.notebooks)).toBe(true);
    expect(rr.notebooks.length).toBe(1);
    expect(rr.notebooks[0].valid).toBe(true);

    // Randomness used with seed set — should pass the randomness check
    expect(rr.notebooks[0].randomness.used).toBe(true);
    expect(rr.notebooks[0].randomness.seedSet).toBe(true);

    // Notebook structure check should be in passed checks
    const passedLabels = rr.passedChecks.join(' ');
    expect(passedLabels).toMatch(/notebook/i);
  });

  // ── TC-R12: Response shape contract ───────────────────────────────────────
  it('TC-R12: Successful audit response matches expected shape', async () => {
    _mockProject = makeProject();

    const reqPath = writeTmp('requirements-shape.txt', PINNED_REQUIREMENTS);

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', reqPath, { filename: 'requirements.txt', contentType: 'text/plain' });

    expect(res.status).toBe(200);

    expect(res.body).toMatchObject({
      success: true,
      message: expect.any(String),
      data: expect.objectContaining({
        overallScore: expect.any(Number),
        reproducibilityReport: expect.objectContaining({
          dockerFilePresent: expect.any(Boolean),
          packageJsonPresent: expect.any(Boolean),
          requirementsTxtPresent: expect.any(Boolean),
          envExamplePresent: expect.any(Boolean),
          unversionedDependencies: expect.any(Array),
          missingEnvDeclarations: expect.any(Array),
          conflictingVersions: expect.any(Array),
          suggestions: expect.any(Array),
          readinessRating: expect.stringMatching(/High|Medium|Low/),
          checks: expect.any(Array),
          passedChecks: expect.any(Array),
          failedChecks: expect.any(Array),
          warnings: expect.any(Array),
          recommendations: expect.any(Array),
          notebooks: expect.any(Array),
        }),
      }),
    });

    // Score is within valid range
    const { overallScore } = res.body.data;
    expect(overallScore).toBeGreaterThanOrEqual(0);
    expect(overallScore).toBeLessThanOrEqual(100);
  });

  it('TC-R13: Full research evidence receives a high reproducibility rating', async () => {
    _mockProject = makeProject();

    const zip = new AdmZip();
    zip.addFile('project/manuscript.txt', Buffer.from(MANUSCRIPT_TEXT));
    zip.addFile('project/analysis_script.py', Buffer.from('import pandas as pd\nprint("analysis ready")\n'));
    zip.addFile('project/dataset.csv', Buffer.from('id,value\n1,0.25\n2,0.75\n3,0.50\n'));
    zip.addFile('project/requirements.txt', Buffer.from(PINNED_REQUIREMENTS));
    zip.addFile('project/Dockerfile', Buffer.from(GOOD_DOCKERFILE));
    zip.addFile('project/.env.example', Buffer.from('API_KEY=\nDATA_PATH=/data/dataset.csv\n'));
    const zipPath = writeTmp('full-research-project.zip', zip.toBuffer());

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', zipPath, { filename: 'Files.zip', contentType: 'application/zip' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overallScore).toBe(100);
    expect(res.body.data.reproducibilityReport.readinessRating).toBe('High');
    expect(res.body.data.reproducibilityReport.warnings).toHaveLength(0);
    expect(res.body.data.reproducibilityReport.dockerFilePresent).toBe(true);
    expect(res.body.data.reproducibilityReport.requirementsTxtPresent).toBe(true);
    expect(res.body.data.reproducibilityReport.envExamplePresent).toBe(true);
  });

  it('TC-R14: Plain text without runtime manifests fails the manifest gate', async () => {
    _mockProject = makeProject();
    const textPath = writeTmp('notes.txt', 'This is a readable note with no runtime configuration.');

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', textPath, { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Failed');
    expect(res.body.data.status).toBe('Failed');
    expect(res.body.data.overallScore).toBe(0);
    expect(res.body.data.reproducibilityReport.readinessRating).toBe('Low');
    expect(res.body.data.reproducibilityReport.checks).toContainEqual(expect.objectContaining({
      status: 'failed',
      label: 'No reproducible runtime manifests (Dockerfile, requirements.txt, package.json, or .env) were detected in the upload.',
    }));
  });

  it('TC-R15: Unparseable ZIP fails the manifest gate instead of receiving a perfect score', async () => {
    _mockProject = makeProject();
    const zipPath = writeTmp('broken.zip', Buffer.from('not a ZIP archive'));

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', zipPath, { filename: 'Files.zip', contentType: 'application/zip' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Failed');
    expect(res.body.data.overallScore).toBe(0);
    expect(res.body.data.reproducibilityReport.readinessRating).toBe('Low');
    expect(res.body.data.reproducibilityReport.warnings.join(' ')).toMatch(/could not be parsed/i);
  });

  it('TC-R16: Dependency and environment manifests without Dockerfile map to Medium', async () => {
    _mockProject = makeProject();
    const environmentPath = writeTmp('environment.yml', 'name: research\nchannels:\n  - conda-forge\ndependencies:\n  - python=3.11\n');
    const envPath = writeTmp('medium.env.example', 'API_KEY=\nDATA_PATH=/data/input.csv\n');

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', environmentPath, { filename: 'environment.yml', contentType: 'text/yaml' })
      .attach('files', envPath, { filename: '.env.example', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.data.overallScore).toBe(65);
    expect(res.body.data.reproducibilityReport.readinessRating).toBe('Medium');
    expect(res.body.data.reproducibilityReport.environmentYamlPresent).toBe(true);
  });

  it('TC-R18: A score of 70 maps to High readiness', async () => {
    _mockProject = makeProject();
    const requirementsPath = writeTmp('boundary-requirements.txt', PINNED_REQUIREMENTS);
    const dockerPath = writeTmp('boundary-Dockerfile', GOOD_DOCKERFILE);

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', requirementsPath, { filename: 'requirements.txt', contentType: 'text/plain' })
      .attach('files', dockerPath, { filename: 'Dockerfile', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.data.overallScore).toBe(70);
    expect(res.body.data.reproducibilityReport.readinessRating).toBe('High');
  });

  it('TC-R17: Malformed package.json receives a corruption penalty', async () => {
    _mockProject = makeProject();
    const packagePath = writeTmp('malformed-package.json', '{"dependencies":');

    const res = await request(app)
      .post(`/api/reproducibility/check/${FAKE_PROJECT_ID}`)
      .attach('files', packagePath, { filename: 'package.json', contentType: 'application/json' });

    expect(res.status).toBe(200);
    expect(res.body.data.overallScore).toBe(25);
    expect(res.body.data.reproducibilityReport.readinessRating).toBe('Low');
    expect(res.body.data.reproducibilityReport.warnings.join(' ')).toMatch(/corrupted/i);
  });
});
