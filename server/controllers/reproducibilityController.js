import fs from 'fs';
import Project from '../models/Project.js';
import Report from '../models/Report.js';


// ---------------------------------------------------------------------------
// Deterministic helpers — no randomness: identical input => identical output
// ---------------------------------------------------------------------------

const PY_KEYWORDS = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del',
  'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
  'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
  'with', 'yield', 'True', 'False', 'None',
]);

const PY_STDLIB = new Set([
  'abc', 'argparse', 'array', 'asyncio', 'base64', 'bisect', 'builtins', 'calendar',
  'cmath', 'collections', 'concurrent', 'contextlib', 'copy', 'csv', 'ctypes',
  'dataclasses', 'datetime', 'decimal', 'difflib', 'email', 'enum', 'errno', 'fnmatch',
  'fractions', 'functools', 'gc', 'getpass', 'glob', 'gzip', 'hashlib', 'heapq', 'hmac',
  'html', 'http', 'importlib', 'inspect', 'io', 'ipaddress', 'itertools', 'json',
  'logging', 'math', 'mimetypes', 'multiprocessing', 'numbers', 'operator', 'os',
  'pathlib', 'pickle', 'platform', 'pprint', 'queue', 'random', 're', 'sched', 'secrets',
  'select', 'shutil', 'signal', 'socket', 'sqlite3', 'ssl', 'stat', 'statistics', 'string',
  'struct', 'subprocess', 'sys', 'sysconfig', 'tempfile', 'textwrap', 'threading',
  'time', 'timeit', 'types', 'typing', 'uuid', 'warnings', 'weakref', 'xml', 'zipfile',
  'zlib', 'zoneinfo', '__future__', 'site', 'sysconfig',
]);

const getCellSource = (cell) => {
  if (!cell || typeof cell !== 'object') return '';
  const s = cell.source;
  if (Array.isArray(s)) return s.join('');
  if (typeof s === 'string') return s;
  return '';
};

// Names a code cell defines (assignments, defs, classes, loop/with variables)
const extractDefinitions = (src) => {
  const names = new Set();
  for (const m of src.matchAll(/^\s*(?:def|class)\s+([A-Za-z_]\w*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^\s*([A-Za-z_]\w*)\s*=(?!=)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^\s*for\s+([A-Za-z_]\w*)\s+in\b/gm)) names.add(m[1]);
  for (const m of src.matchAll(/\bas\s+([A-Za-z_]\w*)/g)) names.add(m[1]);
  return names;
};

// Imported modules + the names those imports bind in the kernel
const extractImports = (src) => {
  const modules = new Set();
  const bindings = new Set();
  for (const m of src.matchAll(/^\s*import\s+([A-Za-z_][\w.]*)\s*(?:as\s+([A-Za-z_]\w*))?/gm)) {
    modules.add(m[1]);
    bindings.add(m[2] || m[1].split('.')[0]);
  }
  for (const m of src.matchAll(/^\s*from\s+([A-Za-z_][\w.]*)\s+import\s+(.+)$/gm)) {
    modules.add(m[1]);
    for (const part of m[2].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (/^[A-Za-z_]\w*$/.test(name)) bindings.add(name);
    }
  }
  return { modules, bindings };
};

const RANDOMNESS_PATTERNS = [
  { source: 'python random', re: /(?:^|[^\w.])import\s+random\b|\bfrom\s+random\s+import\b/ },
  { source: 'python random', re: /(?:^|[^\w.])random\s*\.\s*(?:seed|random|randint|rand|randn|choice|shuffle|sample|uniform|gauss|normal|getrandbits)\s*\(/ },
  { source: 'numpy.random', re: /\b(?:np|numpy)\.random\s*\.\s*\w+/ },
  { source: 'numpy default_rng', re: /\bdefault_rng\s*\(/ },
  { source: 'sklearn random_state', re: /\brandom_state\s*=\s*(?!None)/ },
  { source: 'torch seed', re: /\btorch\.manual_seed\s*\(/ },
  { source: 'tensorflow seed', re: /\b(?:tf\.random\.set_seed|set_seed)\s*\(/ },
];

const SEED_PATTERNS = [
  /(?:^|[^\w.])random\s*\.\s*seed\s*\(/,
  /\b(?:np|numpy)\.random\s*\.\s*seed\s*\(/,
  /\brandom_state\s*=\s*\d+/,
  /\bseed\s*=\s*\d+/,
  /\bdefault_rng\s*\(\s*\d+/,
  /\bRandomState\s*\(\s*\d+/,
  /\btorch\.manual_seed\s*\(/,
  /\btf\.random\.set_seed\s*\(/,
  /\bset_seed\s*\(/,
  /PYTHONHASHSEED/,
  /\bnp\.random\.set_state\s*\(/,
];

const ENV_REF_PATTERNS = /os\.environ\s*\[\s*['"]([A-Za-z_]\w*)['"]\s*\]|os\.getenv\s*\(\s*['"]([A-Za-z_]\w*)['"]/g;

// ---------------------------------------------------------------------------
// .ipynb analysis (real JSON structure inspection)
// ---------------------------------------------------------------------------
const analyzeNotebook = (rawContent, filename) => {
  const result = {
    file: filename,
    valid: false,
    error: null,
    nbformat: null,
    cells: { total: 0, code: 0, markdown: 0, raw: 0, executed: 0, unexecuted: 0, missingOutputs: 0, stateDependent: 0 },
    execution: { counts: [], strictlyIncreasing: false, duplicateCounts: [], gaps: 0, outOfOrder: false },
    randomness: { used: false, sources: [], seedSet: false, seedEvidence: [] },
    imports: { modules: [], thirdParty: [] },
    envVariables: [],
  };

  // --- safe error handling for malformed notebooks
  let nb;
  try {
    nb = JSON.parse(rawContent);
  } catch (err) {
    result.error = `Invalid JSON: ${err.message}`;
    return result;
  }
  if (!nb || typeof nb !== 'object' || Array.isArray(nb)) {
    result.error = 'Notebook root is not a JSON object';
    return result;
  }
  if (typeof nb.nbformat !== 'number') {
    result.error = 'Missing required "nbformat" version field';
    return result;
  }
  if (!Array.isArray(nb.cells)) {
    result.error = 'Missing required "cells" array';
    return result;
  }
  if (!nb.cells.every((c) => c && typeof c === 'object' && typeof c.cell_type === 'string')) {
    result.error = 'Invalid cell entries (each cell must be an object with a cell_type)';
    return result;
  }

  result.valid = true;
  result.nbformat = `${nb.nbformat}.${typeof nb.nbformat_minor === 'number' ? nb.nbformat_minor : 0}`;

  const execCounts = [];
  const allModules = new Set();
  const envRefs = new Set();
  const seedEvidence = [];
  const randomnessSources = new Set();
  const definedSoFar = new Set();
  let usesRandomness = false;
  let seedSet = false;

  nb.cells.forEach((cell) => {
    const type = cell.cell_type;
    if (type === 'code') result.cells.code++;
    else if (type === 'markdown') result.cells.markdown++;
    else if (type === 'raw') result.cells.raw++;
    if (type !== 'code') return;

    const src = getCellSource(cell);

    // --- execution_count sequence + outputs
    const executed = typeof cell.execution_count === 'number';
    if (executed) {
      result.cells.executed++;
      execCounts.push(cell.execution_count);
      const outputs = Array.isArray(cell.outputs) ? cell.outputs : [];
      if (outputs.length === 0) result.cells.missingOutputs++;
    } else {
      result.cells.unexecuted++;
    }

    // --- imports / dependencies
    const { modules, bindings } = extractImports(src);
    modules.forEach((m) => allModules.add(m));

    // --- randomness usage + seed detection
    RANDOMNESS_PATTERNS.forEach((p) => {
      if (p.re.test(src)) {
        usesRandomness = true;
        randomnessSources.add(p.source);
      }
    });
    SEED_PATTERNS.forEach((re) => {
      const m = re.exec(src);
      if (m) {
        seedSet = true;
        const snippet = m[0].trim().replace(/\s+/g, ' ').slice(0, 60);
        if (!seedEvidence.includes(snippet)) seedEvidence.push(snippet);
      }
    });

    // --- environment variable references
    for (const m of src.matchAll(ENV_REF_PATTERNS)) {
      envRefs.add(m[1] || m[2]);
    }

    // --- cells that depend on state created by previous cells
    const defs = extractDefinitions(src);
    const used = new Set();
    for (const m of src.matchAll(/\b([A-Za-z_]\w*)\b/g)) {
      const name = m[1];
      if (!PY_KEYWORDS.has(name) && !defs.has(name)) used.add(name);
    }
    let depends = false;
    used.forEach((n) => {
      if (definedSoFar.has(n)) depends = true;
    });
    if (depends) result.cells.stateDependent++;

    // register this cell's definitions for later cells
    defs.forEach((n) => definedSoFar.add(n));
    bindings.forEach((n) => definedSoFar.add(n));
  });

  result.cells.total = nb.cells.length;

  // --- execution order evaluation
  let strictlyIncreasing = true;
  for (let i = 1; i < execCounts.length; i++) {
    if (execCounts[i] <= execCounts[i - 1]) strictlyIncreasing = false;
  }
  const seen = new Set();
  const dupes = new Set();
  execCounts.forEach((c) => {
    if (seen.has(c)) dupes.add(c);
    seen.add(c);
  });
  let gaps = 0;
  for (let i = 1; i < execCounts.length; i++) {
    if (execCounts[i] - execCounts[i - 1] > 1) gaps++;
  }
  result.execution = {
    counts: execCounts.slice(0, 100),
    strictlyIncreasing: strictlyIncreasing && execCounts.length > 0,
    duplicateCounts: [...dupes].slice(0, 50),
    gaps,
    outOfOrder: execCounts.length > 0 && !strictlyIncreasing,
  };

  result.randomness = {
    used: usesRandomness,
    sources: [...randomnessSources],
    seedSet,
    seedEvidence: seedEvidence.slice(0, 10),
  };

  const topModules = [...new Set([...allModules].map((m) => m.split('.')[0]))].sort();
  result.imports = {
    modules: [...allModules].sort().slice(0, 100),
    thirdParty: topModules.filter((m) => !PY_STDLIB.has(m)),
  };
  result.envVariables = [...envRefs].sort();

  return result;
};


// @desc    Analyze uploaded environment / dependency / notebook files for reproducibility
// @route   POST /api/reproducibility/check/:projectId
// @access  Private
const checkReproducibility = async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      if (req.files) {
        req.files.forEach(f => fs.unlinkSync(f.path));
      }
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const reportDetails = {
      dockerFilePresent: false,
      packageJsonPresent: false,
      requirementsTxtPresent: false,
      envExamplePresent: false,
      unversionedDependencies: [],
      missingEnvDeclarations: [],
      conflictingVersions: [],
      suggestions: [],
      // evidence-based extension
      checks: [],
      passedChecks: [],
      failedChecks: [],
      warnings: [],
      recommendations: [],
      notebooks: [],
    };

    const checks = reportDetails.checks;
    const warnings = reportDetails.warnings;
    const recommendations = reportDetails.recommendations;
    const addCheck = (id, label, status, detail) => checks.push({ id, label, status, detail });

    let score = 100;

    const files = req.files && req.files.length > 0 ? req.files : [];
    if (files.length === 0) {
      // Never fabricate an audit — there must be real files to analyse.
      return res.status(400).json({
        success: false,
        message: 'No files to audit. Upload project files (requirements.txt, package.json, Dockerfile, .env, or .ipynb notebooks) to run a reproducibility check.',
      });
    }

    // -----------------------------------------------------------------------
    // Pass 1 — read & classify uploaded files (existing config checks kept)
    // -----------------------------------------------------------------------
    const notebookPayloads = [];
    const declaredPackages = new Set();
    const uploadedSourceNames = new Set();
    const envFileKeys = new Set();

    files.forEach((file) => {
      const filename = file.originalname.toLowerCase();
      let content;
      try {
        content = fs.readFileSync(file.path, 'utf8');
      } catch (readErr) {
        warnings.push(`File ${file.originalname} could not be read and was skipped (${readErr.message}).`);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return;
      }

      // --- Jupyter notebook: analysed in pass 2 (needs manifest info first)
      if (filename.endsWith('.ipynb')) {
        notebookPayloads.push({ name: file.originalname, content });
      }

      // --- uploaded plain source files (for local-module detection)
      else if (filename.endsWith('.py')) {
        uploadedSourceNames.add(filename.replace(/\.py$/, '').split('/').pop());
      }

      else if (filename.includes('dockerfile')) {
        reportDetails.dockerFilePresent = true;
        const missingDirectives = [];
        if (!content.includes('FROM')) missingDirectives.push('FROM base image');
        if (!content.includes('WORKDIR')) missingDirectives.push('WORKDIR');

        if (missingDirectives.includes('FROM base image')) {
          recommendations.push('Dockerfile is missing "FROM" base image declaration.');
          score -= 15;
        }
        if (missingDirectives.includes('WORKDIR')) {
          recommendations.push('Recommended practice: Declare "WORKDIR" in Dockerfile to keep container filesystem isolated.');
          score -= 5;
        }
        addCheck(
          'dockerfile',
          'Dockerfile present and well-formed',
          missingDirectives.length > 0 ? 'failed' : 'passed',
          missingDirectives.length > 0 ? `Missing ${missingDirectives.join(' and ')}` : 'FROM and WORKDIR declared'
        );
      }

      else if (filename.includes('package.json')) {
        reportDetails.packageJsonPresent = true;
        let pkgUnpinned = 0;
        let corrupt = false;
        try {
          const pkg = JSON.parse(content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };

          Object.entries(deps).forEach(([depName, version]) => {
            declaredPackages.add(depName.toLowerCase());
            if (version.startsWith('^') || version.startsWith('~') || version === 'latest' || version === '*') {
              reportDetails.unversionedDependencies.push({ name: depName, version, type: 'NPM' });
              pkgUnpinned++;
            }
          });

          if (pkgUnpinned > 0) {
            recommendations.push('Pin NPM dependency versions (e.g. change "^1.2.0" to "1.2.0") to lock environment builds.');
            score -= Math.min(pkgUnpinned * 4, 15);
          }
        } catch {
          corrupt = true;
          warnings.push('package.json JSON structure is corrupted.');
          score -= 10;
        }
        addCheck(
          'package-json',
          'package.json dependency pinning',
          corrupt || pkgUnpinned > 0 ? 'failed' : 'passed',
          corrupt ? 'package.json is not valid JSON'
            : pkgUnpinned > 0 ? `${pkgUnpinned} unpinned dependency version(s)`
            : 'All dependencies pinned'
        );
      }

      else if (filename.includes('requirements.txt')) {
        reportDetails.requirementsTxtPresent = true;
        let reqUnpinned = 0;
        const lines = content.split('\n');

        lines.forEach((line) => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
            const pkgName = (trimmed.split(/[=<>!~[\s]/)[0] || '').toLowerCase();
            if (pkgName) declaredPackages.add(pkgName);
            // Check if pinned (has ==)
            if (!trimmed.includes('==') && !trimmed.includes('<=') && !trimmed.includes('>=')) {
              reportDetails.unversionedDependencies.push({ name: trimmed, version: 'any', type: 'Pip' });
              reqUnpinned++;
            }
            // Incompatibility checks (deterministic library rules)
            if (trimmed.includes('tensorflow') && trimmed.includes('==1.')) {
              reportDetails.conflictingVersions.push('Tensorflow 1.x is obsolete. Standardize codebase on Tensorflow 2.x for modern runtimes.');
              score -= 10;
            }
          }
        });

        if (reqUnpinned > 0) {
          recommendations.push('Pin Python library requirements using exact versions (e.g., pandas==2.1.0 instead of just pandas).');
          score -= Math.min(reqUnpinned * 4, 15);
        }
        addCheck(
          'requirements-pin',
          'requirements.txt dependency pinning',
          reqUnpinned > 0 ? 'failed' : 'passed',
          reqUnpinned > 0 ? `${reqUnpinned} requirement(s) without an exact version` : 'All requirements pinned with exact versions'
        );
      }

      else if (filename.includes('.env')) {
        reportDetails.envExamplePresent = true;
        let exposed = 0;
        const lines = content.split('\n');
        lines.forEach(line => {
          if (line.includes('=')) {
            const [key, value] = line.split('=');
            if (key && key.trim()) envFileKeys.add(key.trim());
            // Warn if credentials are committed
            if (value && value.trim() !== '' && (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('password'))) {
              warnings.push(`Warning: Sensitive parameter "${key.trim()}" has exposed secrets in environment file.`);
              exposed++;
            }
          }
        });
        if (exposed > 0) score -= 10;
        addCheck(
          'env-file',
          'Environment file safety',
          exposed > 0 ? 'failed' : 'passed',
          exposed > 0 ? `${exposed} populated secret-looking value(s) found` : 'No populated secret values found'
        );
      }

      // Delete temp uploaded file
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });

    // Skipped checks for config types not included in the audit inputs
    if (!reportDetails.dockerFilePresent) {
      addCheck('dockerfile', 'Dockerfile checks', 'skipped', 'No Dockerfile included in the audited files');
    }
    if (!reportDetails.packageJsonPresent) {
      addCheck('package-json', 'package.json checks', 'skipped', 'No package.json included in the audited files');
    }
    if (!reportDetails.requirementsTxtPresent) {
      addCheck('requirements-pin', 'requirements.txt checks', 'skipped', 'No requirements.txt included in the audited files');
    }
    if (!reportDetails.envExamplePresent) {
      addCheck('env-file', 'Environment file checks', 'skipped', 'No .env/.env.example included in the audited files');
    }

    // -----------------------------------------------------------------------
    // Pass 2 — real .ipynb JSON analysis (deterministic)
    // -----------------------------------------------------------------------
    notebookPayloads.forEach((nbFile) => {
      const analysis = analyzeNotebook(nbFile.content, nbFile.name);
      reportDetails.notebooks.push(analysis);
      const tag = nbFile.name;

      if (!analysis.valid) {
        addCheck('notebook-structure', `Notebook JSON structure (${tag})`, 'failed', analysis.error);
        warnings.push(`Notebook ${tag} could not be parsed (${analysis.error}) — its contents were not analysed.`);
        recommendations.push(`Re-save ${tag} from Jupyter (File > Save) so its JSON structure is valid.`);
        score -= 25;
        return;
      }

      addCheck('notebook-structure', `Notebook JSON structure (${tag})`, 'passed',
        `Valid notebook (nbformat ${analysis.nbformat}, ${analysis.cells.total} cells)`);

      const { cells, execution, randomness, imports } = analysis;

      // --- run completeness
      if (cells.executed === 0) {
        addCheck('notebook-run', `Notebook execution completeness (${tag})`, 'failed', 'No code cell has an execution_count');
        warnings.push(`Notebook ${tag} has no executed cells — saved results cannot be verified.`);
        recommendations.push(`Execute ${tag} end-to-end (Kernel > Restart & Run All) and save it with outputs.`);
        score -= 10;
      } else if (cells.unexecuted > 0) {
        addCheck('notebook-run', `Notebook execution completeness (${tag})`, 'warning',
          `${cells.unexecuted} of ${cells.code} code cells have no execution_count`);
        warnings.push(`Notebook ${tag}: ${cells.unexecuted} code cell(s) were never executed.`);
        recommendations.push('Run every cell so each code cell has an execution_count in the saved notebook.');
        score -= 5;
      } else {
        addCheck('notebook-run', `Notebook execution completeness (${tag})`, 'passed',
          `All ${cells.code} code cells have been executed`);
      }

      // --- cell ordering / execution_count sequence
      if (execution.counts.length === 0) {
        addCheck('notebook-order', `Cell execution order (${tag})`, 'skipped', 'No executed cells to evaluate');
      } else if (execution.outOfOrder) {
        addCheck('notebook-order', `Cell execution order (${tag})`, 'failed',
          `Execution counts are not in top-to-bottom order (duplicates: ${execution.duplicateCounts.slice(0, 10).join(', ') || 'none'})`);
        warnings.push(`Notebook ${tag}: cells were executed or re-run out of order — outputs may reflect stale kernel state.`);
        recommendations.push('Restart the kernel and use "Run All" so cells execute once, in order, from top to bottom.');
        score -= 10;
      } else {
        let detail = `Execution counts strictly increasing across ${execution.counts.length} cells`;
        addCheck('notebook-order', `Cell execution order (${tag})`, 'passed', detail);
        if (execution.gaps > 0) {
          warnings.push(`Notebook ${tag}: ${execution.gaps} gap(s) in the execution_count sequence — some cells were re-run outside the saved order.`);
        }
      }

      // --- cells with missing outputs
      if (cells.executed > 0) {
        if (cells.missingOutputs === 0) {
          addCheck('notebook-outputs', `Saved outputs (${tag})`, 'passed',
            `All ${cells.executed} executed cells have saved outputs`);
        } else if (cells.missingOutputs > cells.executed / 2) {
          addCheck('notebook-outputs', `Saved outputs (${tag})`, 'failed',
            `${cells.missingOutputs}/${cells.executed} executed cells have no saved outputs — results cannot be verified`);
          warnings.push(`Notebook ${tag}: outputs appear to be missing or stripped for most cells.`);
          recommendations.push(`Re-run ${tag} and save it without stripping outputs so results can be verified.`);
          score -= 20;
        } else {
          addCheck('notebook-outputs', `Saved outputs (${tag})`, 'warning',
            `${cells.missingOutputs}/${cells.executed} executed cells have empty outputs`);
          warnings.push(`Notebook ${tag}: ${cells.missingOutputs} executed cell(s) saved without outputs (some cells legitimately produce none).`);
          recommendations.push('Save the notebook with all expected outputs so reviewers can verify results.');
          score -= 5;
        }
      }

      // --- state dependence interaction with ordering
      if (cells.stateDependent > 0 && execution.outOfOrder) {
        addCheck('notebook-state', `Cross-cell state dependence (${tag})`, 'failed',
          `${cells.stateDependent} cells depend on earlier state while execution is out of order`);
        warnings.push(`Notebook ${tag}: ${cells.stateDependent} cell(s) depend on state defined in earlier cells, but cells ran out of order — results may not reproduce.`);
        recommendations.push('Restart the kernel and run all cells in order; avoid re-running individual cells before others.');
        score -= 10;
      } else if (cells.stateDependent > 0) {
        addCheck('notebook-state', `Cross-cell state dependence (${tag})`, 'passed',
          `${cells.stateDependent} cells depend on earlier state but were executed in order`);
      } else {
        addCheck('notebook-state', `Cross-cell state dependence (${tag})`, 'passed', 'No cross-cell state dependence detected');
      }

      // --- randomness / seeding
      if (!randomness.used) {
        addCheck('notebook-randomness', `Randomness control (${tag})`, 'skipped', 'No randomness usage detected');
      } else if (randomness.seedSet) {
        addCheck('notebook-randomness', `Randomness control (${tag})`, 'passed',
          `Randomness via ${randomness.sources.join(', ')} with a fixed seed (${randomness.seedEvidence[0] || 'detected'})`);
      } else {
        addCheck('notebook-randomness', `Randomness control (${tag})`, 'failed',
          `Randomness via ${randomness.sources.join(', ')} without a fixed seed`);
        warnings.push(`Notebook ${tag} uses ${randomness.sources.join(', ')} but no random seed is set — results will vary between runs.`);
        recommendations.push('Set a fixed random seed (e.g. np.random.seed(0), random.seed(0), or random_state=42) before generating any random values.');
        score -= 15;
      }

      // --- imports vs declared dependencies
      const localModules = uploadedSourceNames;
      const undeclared = imports.thirdParty.filter(
        (m) => !declaredPackages.has(m) && !localModules.has(m)
      );
      if (imports.thirdParty.length === 0) {
        addCheck('notebook-dependencies', `Imported dependencies (${tag})`, 'passed', 'Only standard-library imports detected');
      } else if (declaredPackages.size === 0) {
        addCheck('notebook-dependencies', `Imported dependencies (${tag})`, 'warning',
          `Third-party imports (${imports.thirdParty.slice(0, 10).join(', ')}) cannot be verified — no dependency manifest uploaded`);
        warnings.push(`Notebook ${tag} imports ${imports.thirdParty.length} third-party package(s) but no requirements.txt/package.json was audited.`);
        recommendations.push(`Declare the notebook's imported packages in a pinned manifest (e.g. requirements.txt): ${imports.thirdParty.slice(0, 8).join(', ')}.`);
        score -= 10;
      } else if (undeclared.length > 0) {
        addCheck('notebook-dependencies', `Imported dependencies (${tag})`, 'failed',
          `Not declared in the audited manifest: ${undeclared.join(', ')}`);
        warnings.push(`Notebook ${tag} imports packages missing from the audited dependency manifest: ${undeclared.join(', ')}.`);
        recommendations.push('Add the missing packages (with pinned versions) to requirements.txt or package.json.');
        score -= Math.min(undeclared.length * 5, 10);
      } else {
        addCheck('notebook-dependencies', `Imported dependencies (${tag})`, 'passed',
          `All third-party imports declared (${imports.thirdParty.join(', ')})`);
      }

      // --- environment variables referenced by the notebook
      if (analysis.envVariables.length === 0) {
        addCheck('notebook-env', `Environment variables (${tag})`, 'skipped', 'No os.environ/os.getenv references detected');
      } else if (!reportDetails.envExamplePresent) {
        addCheck('notebook-env', `Environment variables (${tag})`, 'warning',
          `References ${analysis.envVariables.length} variable(s) (${analysis.envVariables.join(', ')}) but no .env/.env.example was audited`);
        warnings.push(`Notebook ${tag} reads environment variables (${analysis.envVariables.join(', ')}) that were not verified against an environment file.`);
        recommendations.push('Document required environment variables in a committed .env.example.');
      } else {
        const missing = analysis.envVariables.filter((v) => !envFileKeys.has(v));
        if (missing.length > 0) {
          missing.forEach((v) => reportDetails.missingEnvDeclarations.push(v));
          addCheck('notebook-env', `Environment variables (${tag})`, 'failed',
            `Not declared in the environment file: ${missing.join(', ')}`);
          warnings.push(`Notebook ${tag} requires environment variables missing from the environment file: ${missing.join(', ')}.`);
          recommendations.push('Add the missing variables (with placeholder values) to .env.example.');
        } else {
          addCheck('notebook-env', `Environment variables (${tag})`, 'passed', 'All referenced variables declared in the environment file');
        }
      }
    });

    // Baseline minimum
    score = Math.max(score, 10);

    let rating = 'Medium';
    if (score >= 85) rating = 'High';
    else if (score < 50) rating = 'Low';

    // Structured outputs (checks performed / passed / failed / warnings / recommendations)
    reportDetails.passedChecks = checks.filter((c) => c.status === 'passed').map((c) => c.label);
    reportDetails.failedChecks = checks.filter((c) => c.status === 'failed').map((c) => c.label);
    reportDetails.suggestions = [...recommendations, ...warnings];

    const report = await Report.create({
      project: projectId,
      type: 'Reproducibility',
      overallScore: score,
      reproducibilityReport: {
        dockerFilePresent: reportDetails.dockerFilePresent,
        packageJsonPresent: reportDetails.packageJsonPresent,
        requirementsTxtPresent: reportDetails.requirementsTxtPresent,
        envExamplePresent: reportDetails.envExamplePresent,
        unversionedDependencies: reportDetails.unversionedDependencies,
        missingEnvDeclarations: reportDetails.missingEnvDeclarations,
        conflictingVersions: reportDetails.conflictingVersions,
        suggestions: reportDetails.suggestions,
        readinessRating: rating,
        checks: reportDetails.checks,
        passedChecks: reportDetails.passedChecks,
        failedChecks: reportDetails.failedChecks,
        warnings: reportDetails.warnings,
        recommendations: reportDetails.recommendations,
        notebooks: reportDetails.notebooks,
      },
    });

    res.json({
      success: true,
      message: 'Reproducibility check completed successfully',
      data: report,
    });

  } catch (error) {
    if (req.files) {
      req.files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get reproducibility history for project
// @route   GET /api/reproducibility/project/:projectId
// @access  Private
const getReproducibilityByProject = async (req, res) => {
  try {
    const reports = await Report.find({ project: req.params.projectId, type: 'Reproducibility' })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  checkReproducibility,
  getReproducibilityByProject,
};
