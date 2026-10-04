// Builds test ZIP archives for assessment verification (temp helper)
import AdmZip from 'adm-zip';

const goodZip = new AdmZip();
goodZip.addFile('project/README.md', Buffer.from(
  '# My Research Tool\n\n## Installation\nRun pip install -r requirements.txt\n\n## API\nEndpoint documentation here.\n'
));
goodZip.addFile('project/LICENSE', Buffer.from('MIT License\n'));
goodZip.addFile('project/requirements.txt', Buffer.from('numpy==1.26.0\npytest==8.0.0\npandas==2.2.0\n'));
goodZip.addFile('project/pyproject.toml', Buffer.from('[project]\nname="tool"\n'));
goodZip.addFile('project/Dockerfile', Buffer.from('FROM python:3.10-slim\nWORKDIR /app\n'));
goodZip.addFile('project/.env.example', Buffer.from('DATABASE_URL=\nSECRET=\n'));
goodZip.addFile('project/docs/install.md', Buffer.from('# Install guide\n'));
goodZip.addFile('project/docs/api.md', Buffer.from('# API reference\n'));
goodZip.addFile('project/docs/design.md', Buffer.from('# Design\n'));
goodZip.addFile('project/.github/workflows/ci.yml', Buffer.from('name: CI\non: push\njobs: test: runs-on: ubuntu-latest\n'));
goodZip.addFile('project/src/analysis.py', Buffer.from('def analyze():\n    return 1\n'));
goodZip.addFile('project/src/loader.py', Buffer.from('def load():\n    return []\n'));
goodZip.addFile('project/tests/test_analysis.py', Buffer.from('def test_analyze():\n    assert True\n'));
goodZip.addFile('project/tests/test_loader.py', Buffer.from('def test_load():\n    assert True\n'));
goodZip.addFile('project/tests/test_utils.py', Buffer.from('def test_utils():\n    assert True\n'));
goodZip.addFile('project/tests/test_more.py', Buffer.from('def test_more():\n    assert True\n'));
goodZip.addFile('project/tests/conftest.py', Buffer.from('import pytest\n'));
goodZip.writeZip(process.argv[2] || 'test-good.zip');

const bareZip = new AdmZip();
bareZip.addFile('app/main.py', Buffer.from('print("hello")\n'));
bareZip.writeZip(process.argv[3] || 'test-bare.zip');

console.log('ZIPS WRITTEN');
