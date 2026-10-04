import AdmZip from 'adm-zip';
import fs from 'fs';
import Project from '../models/Project.js';
import Report from '../models/Report.js';
import Repository from '../models/Repository.js';


// Helper to determine maturity level (unchanged thresholds)
const getMaturityLevel = (score) => {
  if (score <= 40) return 'Bronze';
  if (score <= 70) return 'Silver';
  if (score <= 90) return 'Gold';
  return 'Platinum';
};

// ---------------------------------------------------------------------------
// Deterministic file classifiers (no randomness — same input => same output)
// ---------------------------------------------------------------------------
const SKIP_DIRS = ['node_modules/', '.git/', 'dist/', 'build/', 'vendor/', '__pycache__/', '.venv/', 'venv/', 'coverage/', '.next/', 'out/'];

const baseName = (p) => p.split('/').filter(Boolean).pop() || '';
const lowerPath = (p) => p.toLowerCase();
const shouldSkip = (p) => {
  const lp = `/${lowerPath(p)}`;
  return SKIP_DIRS.some((d) => lp.includes(`/${d}`));
};

const isReadme = (p) => /^readme(\.[a-z0-9]+)?$/i.test(baseName(p));
const isDocFile = (p) => {
  const lp = lowerPath(p);
  if (lp.startsWith('docs/') || lp.startsWith('doc/')) return true;
  if (/\.(md|rst|adoc)$/i.test(baseName(p)) && !isReadme(p) && !isLicenseFile(p) && !isContributingFile(p) && !isApiDoc(p)) return true;
  return false;
};
const isInstallDoc = (p) => /(install|setup|getting[_-]?started|quick[_-]?start)/i.test(baseName(p));
const isApiDoc = (p) => /(api(\.(md|rst|txt))?$|swagger|openapi)/i.test(lowerPath(p));
const isLicenseFile = (p) => /^(license|licence)(\.[a-z0-9]+)?$/i.test(baseName(p)) || baseName(p) === 'COPYING';
const isContributingFile = (p) => /^(contributing|code_of_conduct|code-of-conduct|changelog)(\.[a-z0-9]+)?$/i.test(baseName(p));
const isTestFile = (p) => {
  const lp = lowerPath(p);
  const b = baseName(p).toLowerCase();
  return (
    lp.includes('/test/') ||
    lp.includes('/tests/') ||
    lp.includes('/__tests__/') ||
    lp.startsWith('test/') ||
    lp.startsWith('tests/') ||
    b.startsWith('test_') ||
    b.endsWith('_test.py') ||
    b.endsWith('.test.js') ||
    b.endsWith('.test.jsx') ||
    b.endsWith('.test.ts') ||
    b.endsWith('.test.tsx') ||
    b.endsWith('.spec.js') ||
    b.endsWith('.spec.jsx') ||
    b.endsWith('.spec.ts') ||
    b.endsWith('.spec.tsx') ||
    b.endsWith('_test.go') ||
    b.endsWith('_spec.rb') ||
    b === 'conftest.py'
  );
};
const SOURCE_EXT = /\.(py|js|jsx|ts|tsx|java|go|rs|c|cpp|cc|h|hpp|r|jl|m|scala|kt|php|rb|cs|sh|pl|swift|sql|ipynb)$/i;
const isSourceFile = (p) => SOURCE_EXT.test(p) && !isTestFile(p);
const DEP_FILES = ['package.json', 'requirements.txt', 'requirements-dev.txt', 'environment.yml', 'environment.yaml', 'pyproject.toml', 'pipfile', 'poetry.lock', 'package-lock.json', 'yarn.lock', 'go.mod', 'pom.xml', 'build.gradle', 'cargo.toml', 'composer.json', 'gemfile', 'renv.lock', 'setup.py', 'setup.cfg'];
const isDependencyFile = (p) => DEP_FILES.includes(baseName(p).toLowerCase());
const REPRO_FILES = ['dockerfile', 'docker-compose.yml', 'docker-compose.yaml', '.env.example', '.env.sample', 'citation.cff', 'makefile', 'runtime.txt', 'apt.txt', 'procfile', 'environment.yml', 'environment.yaml', 'conda.yml', 'reproducibility.md'];
const isReproFile = (p) => REPRO_FILES.includes(baseName(p).toLowerCase());
const isCiFile = (p) => {
  const lp = lowerPath(p);
  return (
    lp.includes('.github/workflows/') ||
    lp.endsWith('.gitlab-ci.yml') ||
    lp.endsWith('.travis.yml') ||
    lp.includes('/.circleci/') ||
    lp.endsWith('azure-pipelines.yml') ||
    lp.endsWith('appveyor.yml')
  );
};

// Test framework detection from file names (deterministic)
const detectFramework = (files) => {
  const names = files.map((f) => baseName(f).toLowerCase());
  const paths = files.map((f) => lowerPath(f));
  if (names.some((n) => n.startsWith('jest.config') || n.startsWith('vitest.config'))) {
    return names.find((n) => n.startsWith('vitest.config')) ? 'Vitest' : 'Jest';
  }
  if (names.includes('mocha.opts') || names.includes('.mocharc.json') || names.includes('.mocharc.yml')) return 'Mocha';
  if (names.includes('pytest.ini') || names.includes('tox.ini') || names.includes('conftest.py') || paths.some((p) => p.endsWith('setup.cfg'))) return 'Pytest';
  return 'None';
};

const SCAN_FILE_LIST_LIMIT = 200;

// ---------------------------------------------------------------------------
// Evidence collection (ZIP upload)
// ---------------------------------------------------------------------------
const buildZipEvidence = (zipPath) => {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  const files = entries.map((e) => e.entryName).filter((p) => !shouldSkip(p));

  const readmeEntry =
    entries.find((e) => baseName(e.entryName).toLowerCase() === 'readme.md') ||
    entries.find((e) => isReadme(e.entryName));
  let readmeContent = '';
  if (readmeEntry) {
    try {
      readmeContent = readmeEntry.getData().toString('utf8');
    } catch {
      readmeContent = '';
    }
  }

  // Test runner evidence from manifest contents
  let testFramework = detectFramework(files);
  const pkgEntry = entries.find((e) => baseName(e.entryName) === 'package.json');
  if (pkgEntry && testFramework === 'None') {
    try {
      const pkg = JSON.parse(pkgEntry.getData().toString('utf8'));
      if (pkg.scripts && pkg.scripts.test) {
        const t = pkg.scripts.test;
        testFramework = t.includes('jest') ? 'Jest'
          : t.includes('vitest') ? 'Vitest'
          : t.includes('mocha') ? 'Mocha'
          : 'Custom NPM script';
      }
    } catch {
      // Invalid JSON — no framework evidence
    }
  }
  if (testFramework === 'None') {
    const reqEntries = entries.filter((e) => /^requirements.*\.txt$/i.test(baseName(e.entryName)));
    for (const r of reqEntries) {
      try {
        const body = r.getData().toString('utf8');
        if (/\bpytest\b/.test(body)) { testFramework = 'Pytest'; break; }
      } catch { /* skip */ }
    }
  }

  const hasGitDir = entries.some((e) => e.entryName.includes('.git/'));
  const lowerFiles = files.map(lowerPath);

  return {
    source: 'zip',
    totalFiles: files.length,
    scannedFiles: files.slice(0, SCAN_FILE_LIST_LIMIT),
    files,
    readmeFound: !!readmeEntry,
    readmePath: readmeEntry ? readmeEntry.entryName : null,
    installGuideFound: (readmeEntry && /\b(install|setup|getting started|quick start)\b/i.test(readmeContent)) || files.some(isInstallDoc),
    apiDocsFound: (readmeEntry && /\b(api|endpoints|documentation)\b/i.test(readmeContent)) || files.some(isApiDoc),
    docsFiles: files.filter((f) => isDocFile(f) && !isReadme(f)),
    licenseFiles: files.filter(isLicenseFile),
    contributingFiles: files.filter(isContributingFile),
    testFiles: files.filter(isTestFile),
    sourceFiles: files.filter(isSourceFile),
    dependencyFiles: files.filter(isDependencyFile),
    reproFiles: files.filter(isReproFile),
    ciFiles: files.filter(isCiFile),
    testFramework,
    hasGitDir,
    lowerFiles,
    description: null,
    licenseSpdx: null,
  };
};

// ---------------------------------------------------------------------------
// Evidence collection (connected GitHub repository snapshot)
// ---------------------------------------------------------------------------
const buildGithubEvidence = (repoDoc) => {
  const files = [];
  const push = (arr) => (arr || []).forEach((f) => files.push(f));
  push(repoDoc.documentationFiles);
  push(repoDoc.testFiles);

  const recentCommits = (repoDoc.commits || []).filter(
    (c) => c.date && Date.now() - new Date(c.date).getTime() < 1000 * 60 * 60 * 24 * 90
  );

  return {
    source: 'github',
    repoDoc,
    totalFiles: repoDoc.fileTreeCount || 0,
    scannedFiles: files.slice(0, SCAN_FILE_LIST_LIMIT),
    files,
    readmeFound: !!repoDoc.readmePresent,
    readmePath: repoDoc.readmePresent ? 'README (detected via GitHub)' : null,
    installGuideFound: (repoDoc.documentationFiles || []).some(isInstallDoc),
    apiDocsFound: (repoDoc.documentationFiles || []).some(isApiDoc),
    docsFiles: repoDoc.documentationFiles || [],
    licenseFiles: repoDoc.license ? [repoDoc.license] : [],
    contributingFiles: [],
    testFiles: repoDoc.testFiles || [],
    sourceFiles: [], // file tree stores only classified samples; not counted for GitHub source
    dependencyFiles: (repoDoc.documentationFiles || []).length ? [] : [],
    reproFiles: [],
    ciFiles: [], // workflow paths are not retained in the snapshot
    testFramework: detectFramework(repoDoc.testFiles || []),
    hasGitDir: true, // a synced GitHub repository is proof of version control
    description: repoDoc.description || null,
    licenseSpdx: repoDoc.license || null,
    git: {
      commitsCount: (repoDoc.commits || []).length,
      recentCommitsCount: recentCommits.length,
      branchCount: (repoDoc.branches || []).length,
      contributorCount: (repoDoc.contributors || []).length,
      pullRequestsCount: (repoDoc.pullRequests || []).length,
      issuesCount: (repoDoc.issues || []).length,
      issuesClosedCount: (repoDoc.issues || []).filter((i) => i.state === 'closed').length,
      activeRecently: !!repoDoc.pushedAt && Date.now() - new Date(repoDoc.pushedAt).getTime() < 1000 * 60 * 60 * 24 * 90,
      pushedAt: repoDoc.pushedAt || null,
      emptyRepository: !!repoDoc.emptyRepository,
    },
  };
};

// ---------------------------------------------------------------------------
// Deterministic category scoring — every score carries its evidence
// ---------------------------------------------------------------------------
const scoreDocumentation = (ev, project) => {
  const evidence = [];
  let score = 0;
  let measured = false;

  const hasFileList = ev && (ev.source.includes('zip') || ev.totalFiles > 0);

  if (ev) {
    measured = true;

    if (ev.readmeFound) {
      score += 30;
      evidence.push(`README present${ev.readmePath ? ` (${ev.readmePath})` : ''}`);
    } else {
      evidence.push('README not found');
    }

    if (ev.installGuideFound) {
      score += 15;
      evidence.push('Installation/setup instructions detected');
    } else {
      evidence.push('No installation guide detected');
    }

    if (ev.apiDocsFound) {
      score += 15;
      evidence.push('API/reference documentation detected');
    } else {
      evidence.push('No API/reference documentation detected');
    }

    const docsCount = (ev.docsFiles || []).length;
    if (docsCount >= 5) { score += 15; evidence.push(`${docsCount} documentation files found`); }
    else if (docsCount >= 3) { score += 10; evidence.push(`${docsCount} documentation files found`); }
    else if (docsCount >= 1) { score += 5; evidence.push(`${docsCount} documentation files found`); }
    else if (hasFileList) { evidence.push('No additional documentation files found'); }

    if (ev.licenseSpdx || (ev.licenseFiles || []).length > 0) {
      score += 10;
      evidence.push(`License present${ev.licenseSpdx ? ` (${ev.licenseSpdx})` : ''}`);
    } else if (hasFileList) {
      evidence.push('No license file found');
    }

    if ((ev.contributingFiles || []).length > 0) {
      score += 5;
      evidence.push('Contributing/changelog file found');
    }

    if (ev.description) {
      score += 10;
      evidence.push('Repository/project description provided');
    }
  } else if (project && project.description) {
    // Only project metadata available — documentation files cannot be verified
    measured = true;
    score += 10;
    evidence.push('Project description provided (no repository file evidence)');
    evidence.push('README/API/docs could not be verified without a repository or ZIP upload');
  }

  if (!measured) {
    return { score: null, measured: false, evidence: ['No documentation evidence available'], reason: 'No repository or ZIP evidence available' };
  }

  return { score: Math.min(score, 100), measured: true, evidence };
};

const scoreTesting = (ev) => {
  if (!ev) {
    return { score: null, measured: false, evidence: [], reason: 'No file list available — connect a repository or upload a ZIP' };
  }
  const hasZip = ev.source.includes('zip');
  if (!hasZip && ev.totalFiles === 0 && !(ev.git && ev.git.emptyRepository)) {
    return { score: null, measured: false, evidence: ['File tree unavailable at sync time'], reason: 'Repository file tree was not available when the repository was connected' };
  }

  const evidence = [];
  let score = 0;
  const testCount = (ev.testFiles || []).length;

  if (testCount > 0) {
    score += 40;
    evidence.push(`${testCount} test files detected`);
    score += Math.min(testCount, 5) * 4;
    if (testCount >= 5) evidence.push('Test suite has meaningful coverage breadth (>=5 files)');
  } else {
    evidence.push('No test files detected');
  }

  if (ev.testFramework && ev.testFramework !== 'None') {
    score += 25;
    evidence.push(`Test runner detected: ${ev.testFramework}`);
  } else {
    evidence.push('No test runner configuration detected');
  }

  const ciCount = (ev.ciFiles || []).length;
  if (ciCount > 0) {
    score += 15;
    evidence.push(`${ciCount} CI workflow file(s) detected`);
  } else if (hasZip) {
    evidence.push('No CI workflow files detected');
  }

  return { score: Math.min(score, 100), measured: true, evidence };
};

const scoreGit = (ev, project) => {
  const gh = ev && ev.source === 'github' ? ev.git : null;

  if (gh) {
    if (gh.emptyRepository) {
      return { score: null, measured: false, evidence: ['Repository is empty — no commit history'], reason: 'Connected repository has no commits yet' };
    }
    const evidence = [];
    let score = 0;

    if (gh.commitsCount > 0) { score += 25; evidence.push(`${gh.commitsCount} recent commits analysed (${gh.recentCommitsCount} in last 90 days)`); }
    else evidence.push('No commits returned by GitHub');

    if (gh.branchCount > 1) { score += 15; evidence.push(`${gh.branchCount} branches found`); }
    else if (gh.branchCount === 1) { score += 5; evidence.push('Only the default branch exists'); }
    else evidence.push('No branches returned by GitHub');

    if (gh.contributorCount > 1) { score += 15; evidence.push(`${gh.contributorCount} contributors found`); }
    else if (gh.contributorCount === 1) { score += 5; evidence.push('Single contributor recorded'); }

    if (gh.pullRequestsCount > 0) { score += 15; evidence.push(`${gh.pullRequestsCount} pull requests found`); }
    else evidence.push('No pull requests found');

    if (gh.issuesCount > 0) { score += 10; evidence.push(`${gh.issuesCount} issues found (${gh.issuesClosedCount} closed)`); }
    else evidence.push('No issues found');

    if (gh.activeRecently) { score += 20; evidence.push('Repository activity within the last 90 days'); }
    else evidence.push('No activity in the last 90 days');

    return { score: Math.min(score, 100), measured: true, evidence };
  }

  if (ev && ev.source === 'zip' && ev.hasGitDir) {
    return {
      score: 40,
      measured: true,
      evidence: ['.git directory present in ZIP (version control in use)', 'Commit history/branches/issues require a connected GitHub repository — scored on presence only'],
    };
  }

  const urlEvidence = project && project.repositoryUrl
    ? `Repository URL configured (${project.repositoryUrl}) but no GitHub data synced`
    : 'No repository URL configured';

  return {
    score: null,
    measured: false,
    evidence: [urlEvidence],
    reason: 'Git history requires a connected GitHub repository or a ZIP containing a .git directory',
  };
};

const scoreCollaboration = (project, ev) => {
  const evidence = [];
  let score = 0;
  const teamSize = project.teamMembers ? project.teamMembers.length : 1;
  const gh = ev && ev.source === 'github' ? ev.git : null;

  score += 20;
  evidence.push(`${teamSize} team member${teamSize === 1 ? '' : 's'} in project workspace`);

  if (teamSize >= 2) { score += 20; evidence.push('Collaborative team configured'); }
  if (teamSize >= 4) { score += 15; evidence.push('Team of 4+ members'); }
  if (teamSize >= 6) { score += 5; }

  if (gh) {
    if (gh.pullRequestsCount > 0) { score += 15; evidence.push(`${gh.pullRequestsCount} pull requests indicate code review activity`); }
    else evidence.push('No pull request review activity found');
    if (gh.issuesCount > 0) { score += 15; evidence.push(`${gh.issuesCount} issues indicate task tracking`); }
    else evidence.push('No issue tracking activity found');
    if (gh.contributorCount > 1) { score += 15; evidence.push(`${gh.contributorCount} repository contributors`); }
  } else {
    evidence.push('GitHub collaboration evidence (issues/PRs/contributors) unavailable');
  }

  return { score: Math.min(score, 100), measured: true, evidence };
};

// ---------------------------------------------------------------------------
// Strengths / weaknesses / recommendations derived from the same evidence
// ---------------------------------------------------------------------------
const buildInsights = (categories, ev, project) => {
  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  const test = categories.testing.measured ? categories.testing : null;
  const git = categories.git.measured ? categories.git : null;

  const testCount = ev ? (ev.testFiles || []).length : 0;
  const docsCount = ev ? (ev.docsFiles || []).length : 0;
  const hasLicense = !!(ev && ((ev.licenseSpdx || (ev.licenseFiles || []).length > 0)));
  const hasCi = !!(ev && (ev.ciFiles || []).length > 0);
  const hasDep = !!(ev && (ev.dependencyFiles || []).length > 0);
  const hasRepro = !!(ev && (ev.reproFiles || []).length > 0);
  const teamSize = project.teamMembers ? project.teamMembers.length : 1;
  const gh = ev && ev.source === 'github' ? ev.git : null;

  // Documentation
  if (ev && ev.readmeFound) strengths.push('README documentation present');
  else if (ev) { weaknesses.push('No README documentation found'); recommendations.push('Add a README.md describing purpose, setup, usage, and research objectives.'); }

  if (docsCount >= 3) strengths.push(`${docsCount} documentation files found`);
  else if (ev && ev.source.includes('zip') && docsCount === 0) { weaknesses.push('No supporting documentation files found'); recommendations.push('Document the project in a docs/ folder (installation, usage, API reference).'); }

  if (hasLicense) strengths.push(ev.licenseSpdx ? `License present (${ev.licenseSpdx})` : 'License file present');
  else if (ev && ev.source.includes('zip')) { weaknesses.push('No license file detected'); recommendations.push('Add a LICENSE file to clarify reuse and citation terms.'); }

  // Testing
  if (testCount >= 5) strengths.push(`${testCount} test files detected`);
  else if (testCount > 0) strengths.push(`${testCount} test files detected`);
  else if (test && test.measured && ev && (ev.source.includes('zip') || ev.totalFiles > 0)) {
    weaknesses.push('No test files detected');
    recommendations.push('Add unit tests under a tests/ directory (pytest, Jest, or Vitest).');
  }

  if (ev && ev.testFramework && ev.testFramework !== 'None') strengths.push(`Test runner configured: ${ev.testFramework}`);
  else if (test && test.measured) { weaknesses.push('No test runner configured'); recommendations.push('Configure a test runner (add a "test" script to package.json or add pytest.ini).'); }

  if (hasCi) strengths.push('CI workflow configuration found');
  else if (ev && ev.source.includes('zip')) { weaknesses.push('No CI workflow detected'); recommendations.push('Add a GitHub Actions workflow (.github/workflows) to run tests on every push.'); }

  // Git / version control
  if (git && git.measured) {
    if (gh) {
      if (gh.branchCount > 1) strengths.push(`${gh.branchCount} branches indicate parallel development`);
      else { weaknesses.push('Only the default branch exists'); recommendations.push('Create feature branches for development work instead of committing to the default branch.'); }

      if (gh.contributorCount > 1) strengths.push(`${gh.contributorCount} contributors recorded`);
      else { weaknesses.push('Single contributor recorded'); recommendations.push('Invite collaborators and review changes through pull requests.'); }

      if (gh.pullRequestsCount > 0) strengths.push(`${gh.pullRequestsCount} pull requests show a code-review workflow`);
      else { weaknesses.push('No pull requests found'); recommendations.push('Open pull requests for changes so contributions are reviewed and recorded.'); }

      if (gh.issuesCount > 0) strengths.push(`${gh.issuesCount} issues tracked`);
      else { weaknesses.push('No issues found'); recommendations.push('Track research tasks and bugs with GitHub Issues.'); }

      if (gh.activeRecently) strengths.push('Repository activity within the last 90 days');
      else { weaknesses.push('No repository activity in the last 90 days'); recommendations.push('Commit recent changes regularly to keep the research code active.'); }
    } else if (ev && ev.hasGitDir) {
      strengths.push('Version control detected (.git directory)');
      recommendations.push('Connect the GitHub repository to measure commit history, branches, and review activity.');
    }
  }

  // Reproducibility & dependencies
  if (hasRepro) strengths.push(`Reproducibility files found (${ev.reproFiles.map(baseName).slice(0, 3).join(', ')})`);
  else if (ev && ev.source.includes('zip')) { weaknesses.push('No reproducibility files (Dockerfile/environment/.env.example) found'); recommendations.push('Add a Dockerfile or environment.yml capturing the exact execution environment.'); }

  if (hasDep) strengths.push(`Dependency manifest found (${ev.dependencyFiles.map(baseName).slice(0, 2).join(', ')})`);
  else if (ev && ev.source.includes('zip')) { weaknesses.push('No dependency manifest found'); recommendations.push('Declare dependencies in a pinned manifest (requirements.txt or package.json).'); }

  // Collaboration
  if (teamSize >= 2) strengths.push(`${teamSize}-member collaborative workspace`);
  else { weaknesses.push('Team has a single member'); recommendations.push('Invite team members to enable collaborative features and improve the collaboration score.'); }

  if (ev && ev.source.includes('zip') && (ev.sourceFiles || []).length === 0 && ev.totalFiles > 0) {
    weaknesses.push('No source code files detected in the uploaded archive');
    recommendations.push('Verify the ZIP contains the project source directory.');
  }

  return { strengths, weaknesses, recommendations };
};

// ---------------------------------------------------------------------------
// Assessment entry point
// ---------------------------------------------------------------------------
// @desc    Trigger Software Engineering Readiness Assessment (evidence-based)
// @route   POST /api/assessments/scan/:projectId
// @access  Private
const scanProjectCodebase = async (req, res) => {
  const { projectId } = req.params;

  let zipPath = req.file ? req.file.path : null;

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      if (zipPath) fs.unlinkSync(zipPath);
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // --- Gather evidence from available sources (ZIP and/or GitHub snapshot)
    let zipEvidence = null;
    let zipError = null;
    if (zipPath) {
      try {
        zipEvidence = buildZipEvidence(zipPath);
      } catch (zipErr) {
        zipError = zipErr.message;
      } finally {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        zipPath = null;
      }
    }

    const repoDoc = await Repository.findOne({ project: projectId });
    const githubEvidence = repoDoc ? buildGithubEvidence(repoDoc) : null;

    if (!zipEvidence && !githubEvidence) {
      return res.status(400).json({
        success: false,
        message: zipError
          ? `The uploaded ZIP could not be parsed (${zipError}). Connect a GitHub repository or upload a valid ZIP archive.`
          : 'No assessment evidence available. Connect a public GitHub repository or upload a project ZIP archive to run the assessment.',
      });
    }

    // Evidence set used for scoring (both sources may contribute, merged deterministically)
    let ev = zipEvidence || githubEvidence;
    if (zipEvidence && githubEvidence) {
      const uniq = (a, b) => [...new Set([...(a || []), ...(b || [])])];
      ev = {
        ...zipEvidence,
        source: 'zip+github',
        git: githubEvidence.git,
        totalFiles: zipEvidence.totalFiles || githubEvidence.totalFiles,
        readmeFound: zipEvidence.readmeFound || githubEvidence.readmeFound,
        installGuideFound: zipEvidence.installGuideFound || githubEvidence.installGuideFound,
        apiDocsFound: zipEvidence.apiDocsFound || githubEvidence.apiDocsFound,
        docsFiles: uniq(zipEvidence.docsFiles, githubEvidence.docsFiles),
        testFiles: uniq(zipEvidence.testFiles, githubEvidence.testFiles),
        ciFiles: uniq(zipEvidence.ciFiles, githubEvidence.ciFiles),
        licenseSpdx: zipEvidence.licenseSpdx || githubEvidence.licenseSpdx,
        licenseFiles: zipEvidence.licenseFiles.length ? zipEvidence.licenseFiles : githubEvidence.licenseFiles,
        testFramework: zipEvidence.testFramework !== 'None' ? zipEvidence.testFramework : githubEvidence.testFramework,
      };
    }

    const sources = [zipEvidence ? 'zip-upload' : null, repoDoc ? 'github-repository' : null].filter(Boolean);
    const warnings = [];
    if (zipError && githubEvidence) {
      warnings.push(`ZIP upload could not be parsed (${zipError}) — assessment used GitHub repository evidence only.`);
    }

    // --- Deterministic category scoring
    const categories = {
      documentation: scoreDocumentation(ev, project),
      testing: scoreTesting(ev),
      git: scoreGit(githubEvidence || zipEvidence, project),
      collaboration: scoreCollaboration(project, ev),
    };

    const unmeasurable = Object.entries(categories)
      .filter(([, c]) => !c.measured)
      .map(([category, c]) => ({ category, reason: c.reason }));

    const measuredScores = Object.values(categories)
      .filter((c) => c.measured && typeof c.score === 'number')
      .map((c) => c.score);

    if (measuredScores.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No assessment category could be measured from the available evidence. Connect a GitHub repository or upload a project ZIP archive.',
      });
    }

    const overallScore = Math.round(measuredScores.reduce((a, b) => a + b, 0) / measuredScores.length);
    const maturityLevel = getMaturityLevel(overallScore);

    const { strengths, weaknesses, recommendations } = buildInsights(categories, ev, project);

    // Legacy-compatible details keys (all real, null when not measurable)
    const ghGit = ev && ev.git ? ev.git : null;
    const details = {
      // legacy keys consumed by the existing UI
      readmeFound: ev.readmeFound || false,
      apiDocsFound: ev.apiDocsFound || false,
      installGuideFound: ev.installGuideFound || false,
      testFilesCount: ev.testFiles ? ev.testFiles.length : 0,
      testFrameworkDetected: ev.testFramework || 'None',
      gitRepoDetected: !!(repoDoc || (ev && ev.hasGitDir) || project.repositoryUrl),
      branchCount: ghGit ? ghGit.branchCount : null,
      recentCommitsCount: ghGit ? ghGit.recentCommitsCount : null,
      issuesResolvedCount: ghGit ? ghGit.issuesClosedCount : null,
      pullRequestsCount: ghGit ? ghGit.pullRequestsCount : null,
      scannedFiles: (ev.scannedFiles || []).slice(0, SCAN_FILE_LIST_LIMIT),

      // evidence-based extension
      evidenceSources: sources,
      warnings,
      scannedFileCount: ev.totalFiles || 0,
      fileBreakdown: {
        documentation: (ev.docsFiles || []).length,
        tests: (ev.testFiles || []).length,
        source: (ev.sourceFiles || []).length,
        dependencies: (ev.dependencyFiles || []).length,
        reproducibility: (ev.reproFiles || []).length,
        ci: (ev.ciFiles || []).length,
      },
      evidence: {
        readmePath: ev.readmePath || null,
        documentationFiles: (ev.docsFiles || []).slice(0, 30),
        testFilesSample: (ev.testFiles || []).slice(0, 30),
        sourceFilesSample: (ev.sourceFiles || []).slice(0, 30),
        dependencyFiles: (ev.dependencyFiles || []).slice(0, 20),
        reproducibilityFiles: (ev.reproFiles || []).slice(0, 20),
        ciFiles: (ev.ciFiles || []).slice(0, 10),
        license: ev.licenseSpdx || ((ev.licenseFiles || []).length > 0 ? 'License file present' : null),
        git: ghGit || null,
      },
      categories: Object.fromEntries(
        Object.entries(categories).map(([k, c]) => [k, { score: c.score, measured: c.measured, evidence: c.evidence, reason: c.reason || null }])
      ),
      unmeasurable,
      strengths,
      weaknesses,
      recommendations,
    };

    // --- Persist report (same top-level shape as before)
    const report = await Report.create({
      project: projectId,
      type: 'Assessment',
      documentationScore: categories.documentation.measured ? categories.documentation.score : null,
      testingScore: categories.testing.measured ? categories.testing.score : null,
      gitScore: categories.git.measured ? categories.git.score : null,
      collaborationScore: categories.collaboration.measured ? categories.collaboration.score : null,
      overallScore,
      details,
    });

    // --- Update project state
    project.maturityScore = overallScore;
    project.maturityLevel = maturityLevel;

    // Health score = weighted average over measurable categories only
    const healthWeights = [
      [categories.testing, 0.4],
      [categories.documentation, 0.3],
      [categories.git, 0.3],
    ];
    const weighted = healthWeights.filter(([c]) => c.measured);
    if (weighted.length > 0) {
      const totalWeight = weighted.reduce((acc, [, w]) => acc + w, 0);
      project.healthScore = Math.round(
        weighted.reduce((acc, [c, w]) => acc + c.score * w, 0) / totalWeight
      );
    }
    await project.save();

    res.status(200).json({
      success: true,
      message: 'Codebase assessment completed successfully',
      data: report,
      project: {
        maturityScore: project.maturityScore,
        maturityLevel: project.maturityLevel,
        healthScore: project.healthScore,
      },
    });
  } catch (error) {
    if (zipPath && fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get assessment history for a project
// @route   GET /api/assessments/project/:projectId
// @access  Private
const getAssessmentsByProject = async (req, res) => {
  try {
    const reports = await Report.find({ project: req.params.projectId, type: 'Assessment' })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  scanProjectCodebase,
  getAssessmentsByProject,
};
