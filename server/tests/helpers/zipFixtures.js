/**
 * tests/helpers/zipFixtures.js
 *
 * Helpers that build realistic ZIP buffers in memory using AdmZip.
 * These are written to a temp file by the test so Supertest can upload them
 * via multipart form-data — exactly as the production route expects.
 *
 * No real disk ZIPs are committed; fixtures are generated on-the-fly so the
 * tests remain deterministic and fast.
 */

import AdmZip from 'adm-zip';

// ---------------------------------------------------------------------------
// Fixture 1: Full research project — should score well (≥ 70)
// ---------------------------------------------------------------------------
export function buildFullProjectZip() {
  const zip = new AdmZip();

  zip.addFile(
    'README.md',
    Buffer.from(
      '# My Research Project\n\n' +
        '## Installation\n' +
        'Run `pip install -r requirements.txt` then `python main.py`.\n\n' +
        '## API Endpoints\nSee docs/api.md.\n\n' +
        '## Usage\n`python main.py --config config.yaml`\n',
      'utf8',
    ),
  );

  zip.addFile(
    'requirements.txt',
    Buffer.from(
      'numpy==1.26.4\npandas==2.2.1\nscikit-learn==1.4.2\nmatplotlib==3.8.4\npytest==8.1.1\n',
      'utf8',
    ),
  );

  zip.addFile(
    'main.py',
    Buffer.from(
      'import numpy as np\nimport pandas as pd\nfrom sklearn.linear_model import LinearRegression\n\ndef main():\n    df = pd.read_csv("data/dataset.csv")\n    model = LinearRegression()\n    print("Done")\n\nif __name__ == "__main__":\n    main()\n',
      'utf8',
    ),
  );

  zip.addFile(
    'tests/test_main.py',
    Buffer.from(
      'import pytest\nfrom main import main\n\ndef test_main_runs():\n    main()\n',
      'utf8',
    ),
  );
  zip.addFile('tests/test_data.py', Buffer.from('def test_dataset_exists():\n    assert True\n', 'utf8'));
  zip.addFile('tests/test_model.py', Buffer.from('def test_model_runs():\n    assert True\n', 'utf8'));
  zip.addFile('tests/test_results.py', Buffer.from('def test_results_are_saved():\n    assert True\n', 'utf8'));
  zip.addFile('tests/test_reproducibility.py', Buffer.from('def test_run_is_repeatable():\n    assert True\n', 'utf8'));

  zip.addFile(
    'docs/api.md',
    Buffer.from('# API Reference\n\n## GET /results\nReturns computed results.\n', 'utf8'),
  );
  zip.addFile('docs/protocol.md', Buffer.from('# Protocol\n\nStudy protocol and execution steps.\n', 'utf8'));
  zip.addFile('docs/data.md', Buffer.from('# Data\n\nDataset schema and collection notes.\n', 'utf8'));
  zip.addFile('docs/results.md', Buffer.from('# Results\n\nAnalysis results and evaluation.\n', 'utf8'));
  zip.addFile('docs/reproduction.md', Buffer.from('# Reproduction\n\nSteps to reproduce the analysis.\n', 'utf8'));
  zip.addFile('CONTRIBUTING.md', Buffer.from('# Contributing\n\nContribution guidelines.\n', 'utf8'));

  zip.addFile('LICENSE', Buffer.from('MIT License\nCopyright 2024 Researcher\n', 'utf8'));

  zip.addFile(
    'Dockerfile',
    Buffer.from(
      'FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nCMD ["python", "main.py"]\n',
      'utf8',
    ),
  );

  zip.addFile(
    '.github/workflows/ci.yml',
    Buffer.from(
      'name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v3\n      - run: pip install -r requirements.txt\n      - run: pytest\n',
      'utf8',
    ),
  );

  return zip.toBuffer();
}

// ---------------------------------------------------------------------------
// Fixture 2: README-only project — minimal structure, expected low-to-mid score
// ---------------------------------------------------------------------------
export function buildReadmeOnlyZip() {
  const zip = new AdmZip();

  zip.addFile(
    'README.md',
    Buffer.from(
      '# Manuscript-only project\n\nThis project contains a manuscript describing our method.\n',
      'utf8',
    ),
  );

  // A text file that is not source, tests, or config
  zip.addFile('manuscript.txt', Buffer.from('Abstract: We propose a novel approach...\n', 'utf8'));

  return zip.toBuffer();
}

// ---------------------------------------------------------------------------
// Fixture 3: Empty ZIP — no entries at all
// ---------------------------------------------------------------------------
export function buildEmptyZip() {
  const zip = new AdmZip();
  return zip.toBuffer();
}

// ---------------------------------------------------------------------------
// Fixture 4: ZIP containing only a binary PNG (no readable text files)
// ---------------------------------------------------------------------------
export function buildBinaryOnlyZip() {
  const zip = new AdmZip();
  // Minimal valid PNG header bytes — not readable text
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  zip.addFile('figure.png', pngHeader);
  return zip.toBuffer();
}
