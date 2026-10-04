import Repository from '../models/Repository.js';
import Project from '../models/Project.js';

const GITHUB_API = 'https://api.github.com';

// Optional token (never hard-coded) — raises rate limits from 60/hr to 5000/hr.
const githubHeaders = () => {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ResearchFlow-AI',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
};

// Error with an HTTP status we surface to the client
class GithubApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const formatResetTime = (resetEpochSeconds) => {
  if (!resetEpochSeconds) return null;
  try {
    return new Date(Number(resetEpochSeconds) * 1000).toISOString();
  } catch (e) {
    return null;
  }
};

// Perform a GitHub API request and translate failure modes into typed errors
const ghFetch = async (path) => {
  let res;
  try {
    res = await fetch(`${GITHUB_API}${path}`, { headers: githubHeaders() });
  } catch (err) {
    throw new GithubApiError(502, 'Could not reach the GitHub API. Check your network connection and try again.');
  }

  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = formatResetTime(res.headers.get('x-ratelimit-reset'));
    if (remaining === '0') {
      throw new GithubApiError(
        429,
        `GitHub API rate limit exceeded${reset ? ` (resets at ${reset})` : ''}. ` +
          'Try again later or set GITHUB_TOKEN in server/.env to raise the limit.'
      );
    }
    throw new GithubApiError(403, 'GitHub denied the request (forbidden). The repository may be private.');
  }

  if (res.status === 404) {
    throw new GithubApiError(
      404,
      'Repository not found. It may not exist, may be private, or the URL may be misspelled.'
    );
  }

  if (!res.ok) {
    throw new GithubApiError(res.status, `GitHub API returned an unexpected status (${res.status}).`);
  }

  return res;
};

// GET helper returning parsed JSON or null on 404/409 (optional sub-resources)
const ghJson = async (path, { allowNullOn404 = false } = {}) => {
  try {
    const res = await ghFetch(path);
    if (res.status === 204) return null;
    return await res.json();
  } catch (err) {
    if (allowNullOn404 && err instanceof GithubApiError && err.status === 404) return null;
    throw err;
  }
};

// Parse and validate a GitHub repository URL into { owner, repo } or null
const parseRepoUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const value = rawUrl.trim();

  let candidate = value;
  // git@github.com:owner/repo.git
  const sshMatch = candidate.match(/^git@github\.com:([^/]+)\/([^/\s]+)$/i);
  if (sshMatch) {
    candidate = `${sshMatch[1]}/${sshMatch[2]}`;
  } else {
    candidate = candidate.replace(/^https?:\/\/(www\.)?github\.com\//i, '');
    candidate = candidate.replace(/^github\.com\//i, '');
    candidate = candidate.replace(/^\/+/, '');
  }

  const segments = candidate.split('/').filter(Boolean);
  if (segments.length < 2) return null;

  const owner = segments[0].replace(/\.git$/i, '');
  const repo = segments[1].replace(/\.git$/i, '');

  const valid = /^[A-Za-z0-9_.-]+$/;
  if (!owner || !repo || !valid.test(owner) || !valid.test(repo)) return null;

  return { owner, repo };
};

const isDocFile = (path) => {
  const p = path.toLowerCase();
  const base = p.split('/').pop();
  return (
    /^readme(\.[^/]*)?$/.test(base) ||
    p.startsWith('docs/') ||
    p.startsWith('doc/') ||
    base === 'contributing.md' ||
    base === 'changelog.md' ||
    base === 'code_of_conduct.md' ||
    base === 'license' ||
    base.startsWith('license.') ||
    base.endsWith('.md')
  );
};

const isTestFile = (path) => {
  const p = path.toLowerCase();
  const base = p.split('/').pop();
  return (
    p.includes('/test/') ||
    p.includes('/tests/') ||
    p.includes('/__tests__/') ||
    p.startsWith('test/') ||
    p.startsWith('tests/') ||
    base.startsWith('test_') ||
    base.endsWith('_test.py') ||
    base.endsWith('.test.js') ||
    base.endsWith('.test.jsx') ||
    base.endsWith('.test.ts') ||
    base.endsWith('.test.tsx') ||
    base.endsWith('.spec.js') ||
    base.endsWith('.spec.ts') ||
    base.endsWith('_test.go') ||
    base.endsWith('_spec.rb')
  );
};

// Group recent commits into ISO week buckets (real data only)
const buildWeeklyContributions = (commits) => {
  const buckets = new Map();
  commits.forEach((c) => {
    if (!c.date) return;
    const d = new Date(c.date);
    if (Number.isNaN(d.getTime())) return;
    // Monday-based week key
    const day = (d.getUTCDay() + 6) % 7;
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
    const year = monday.getUTCFullYear();
    const oneJan = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil(((monday - oneJan) / 86400000 + 1) / 7);
    const key = `${year}-W${String(week).padStart(2, '0')}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-8)
    .map(([week, commitsCount]) => ({ week, commits: commitsCount }));
};

// @desc    Connect a public GitHub repository to a project (real GitHub API data)
// @route   POST /api/github/connect/:projectId
// @access  Private
const connectGithubRepo = async (req, res) => {
  const { projectId } = req.params;
  const { repositoryUrl } = req.body || {};

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const parsed = parseRepoUrl(repositoryUrl);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid GitHub repository URL. Use a format like https://github.com/owner/repository',
      });
    }
    const { owner, repo } = parsed;
    const canonicalUrl = `https://github.com/${owner}/${repo}`;

    // 1. Repository metadata (fails here => 404 / private / rate limit / network error)
    const meta = await ghFetch(`/repos/${owner}/${repo}`).then((r) => r.json());

    if (meta.private) {
      return res.status(403).json({
        success: false,
        message:
          'This repository is private. Only public repositories are supported without GitHub OAuth authorization.',
      });
    }

    const defaultBranch = meta.default_branch || '';

    // 2. Sub-resources — each tolerated individually so one failure does not break the connect
    const [branches, commitsRaw, contributorsRaw, issuesRaw, pullsRaw, readmeRaw, treeRaw] =
      await Promise.all([
        ghJson(`/repos/${owner}/${repo}/branches?per_page=30`).catch(() => null),
        ghJson(`/repos/${owner}/${repo}/commits?per_page=30`, { allowNullOn404: true }).catch(() => null),
        ghJson(`/repos/${owner}/${repo}/contributors?per_page=10`, { allowNullOn404: true }).catch(() => null),
        ghJson(`/repos/${owner}/${repo}/issues?state=all&per_page=30`, { allowNullOn404: true }).catch(() => null),
        ghJson(`/repos/${owner}/${repo}/pulls?state=all&per_page=30`, { allowNullOn404: true }).catch(() => null),
        ghJson(`/repos/${owner}/${repo}/readme`).catch(() => null),
        defaultBranch
          ? ghJson(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`).catch(() => null)
          : Promise.resolve(null),
      ]);

    // Map commits (409 "Git Repository is empty" already reduced to null by ghFetch/404 rules)
    const commits = (Array.isArray(commitsRaw) ? commitsRaw : []).map((c) => ({
      sha: (c.sha || '').slice(0, 8),
      message: ((c.commit && c.commit.message) || '').split('\n')[0],
      author: (c.author && c.author.login) || (c.commit && c.commit.author && c.commit.author.name) || 'Unknown',
      date: (c.commit && c.commit.author && c.commit.author.date) || null,
    }));

    const contributors = (Array.isArray(contributorsRaw) ? contributorsRaw : []).map((c) => ({
      name: c.login || 'Unknown',
      avatarUrl: c.avatar_url || '',
      contributions: c.contributions || 0,
    }));

    // Issues endpoint also returns pull requests — filter them out
    const issues = (Array.isArray(issuesRaw) ? issuesRaw : [])
      .filter((i) => !i.pull_request)
      .map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        author: (i.user && i.user.login) || 'Unknown',
        date: i.created_at ? new Date(i.created_at) : null,
        labels: (i.labels || []).map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean),
        severity: (i.labels && i.labels.length > 0 && (i.labels[0].name || i.labels[0])) || null,
      }));

    const pullRequests = (Array.isArray(pullsRaw) ? pullsRaw : []).map((p) => ({
      number: p.number,
      title: p.title,
      state: p.merged_at ? 'merged' : p.state,
      author: (p.user && p.user.login) || 'Unknown',
      date: p.created_at ? new Date(p.created_at) : null,
    }));

    const branchList = (Array.isArray(branches) ? branches : []).map((b) => ({
      name: b.name,
      protected: !!b.protected,
    }));

    // File tree analysis (real paths from GitHub)
    const treePaths = treeRaw && Array.isArray(treeRaw.tree) ? treeRaw.tree.map((t) => t.path) : [];
    const documentationFiles = treePaths.filter(isDocFile).slice(0, 30);
    const testFiles = treePaths.filter(isTestFile).slice(0, 30);

    // A repository with no commits and no branches is empty on GitHub
    const emptyRepository = commits.length === 0 && branchList.length === 0;

    // Save / replace repository snapshot
    await Repository.deleteOne({ project: projectId });

    const repository = await Repository.create({
      project: projectId,
      repoName: `${owner}/${repo}`,
      repoUrl: canonicalUrl,
      owner,
      repo,
      description: meta.description || '',
      stars: typeof meta.stargazers_count === 'number' ? meta.stargazers_count : 0,
      forks: typeof meta.forks_count === 'number' ? meta.forks_count : 0,
      openIssuesCount: typeof meta.open_issues_count === 'number' ? meta.open_issues_count : 0,
      defaultBranch,
      branches: branchList,
      license: (meta.license && meta.license.spdx_id) || '',
      pushedAt: meta.pushed_at ? new Date(meta.pushed_at) : null,
      emptyRepository,
      commits,
      contributors,
      weeklyContributions: buildWeeklyContributions(commits),
      issues,
      pullRequests,
      readmePresent: !!readmeRaw,
      fileTreeCount: treePaths.length,
      fileTreeTruncated: !!(treeRaw && treeRaw.truncated),
      documentationFiles,
      testFiles,
      lastSyncedAt: new Date(),
    });

    project.repositoryUrl = canonicalUrl;
    await project.save();

    res.status(200).json({
      success: true,
      message: emptyRepository
        ? 'GitHub repository linked (repository is currently empty).'
        : 'GitHub repository linked successfully',
      data: repository,
    });
  } catch (error) {
    if (error instanceof GithubApiError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get repository details (stored from real GitHub data at connect time)
// @route   GET /api/github/details/:projectId
// @access  Private
const getRepoDetails = async (req, res) => {
  const { projectId } = req.params;

  try {
    const repository = await Repository.findOne({ project: projectId });
    if (!repository) {
      return res.status(404).json({ success: false, message: 'No repository linked to this project' });
    }

    res.json({ success: true, data: repository });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Derive a transparent health score from real repository signals only.
// Returns null when not enough real data is available (no fabrication).
const computeHealthScore = (repo) => {
  if (repo.emptyRepository || (!repo.readmePresent && repo.fileTreeCount === 0)) return null;

  const signals = {
    hasReadme: !!repo.readmePresent,
    hasTests: (repo.testFiles || []).length > 0,
    hasDocs: (repo.documentationFiles || []).length > 1,
    hasLicense: !!repo.license,
    hasDescription: !!repo.description,
    activeRecently:
      !!repo.pushedAt && Date.now() - new Date(repo.pushedAt).getTime() < 1000 * 60 * 60 * 24 * 90,
  };

  let score = 0;
  if (signals.hasReadme) score += 25;
  if (signals.hasTests) score += 25;
  if (signals.hasDocs) score += 15;
  if (signals.hasLicense) score += 15;
  if (signals.hasDescription) score += 10;
  if (signals.activeRecently) score += 10;

  return { score, signals };
};

// Real file-tree category breakdown (percentages), null when the tree is unavailable
const computeCategoryBreakdown = (repo) => {
  const total = repo.fileTreeCount;
  if (!total || total === 0) return null;

  const docs = (repo.documentationFiles || []).length;
  const tests = (repo.testFiles || []).length;
  const other = Math.max(total - docs - tests, 0);

  const pct = (n) => Math.round((n / total) * 100);
  return {
    documentation: pct(docs),
    testing: pct(tests),
    codeChanges: pct(other),
  };
};

// @desc    Get repository analytics (PRs, issues, activity) — real data only
// @route   GET /api/github/analytics/:projectId
// @access  Private
const getRepoAnalytics = async (req, res) => {
  const { projectId } = req.params;

  try {
    const repo = await Repository.findOne({ project: projectId });
    if (!repo) {
      return res.status(404).json({ success: false, message: 'No repository linked to this project' });
    }

    const health = computeHealthScore(repo);

    res.json({
      success: true,
      data: {
        repoName: repo.repoName,
        stars: repo.stars,
        forks: repo.forks,
        defaultBranch: repo.defaultBranch,
        branches: repo.branches || [],
        commitsCount: (repo.commits || []).length,
        pullRequests: repo.pullRequests || [],
        issues: repo.issues || [],
        weeklyContributions: repo.weeklyContributions || [],
        categoryBreakdown: computeCategoryBreakdown(repo),
        readmePresent: repo.readmePresent,
        documentationFiles: repo.documentationFiles || [],
        testFiles: repo.testFiles || [],
        emptyRepository: repo.emptyRepository,
        lastSyncedAt: repo.lastSyncedAt,
        healthScore: health ? health.score : null,
        healthSignals: health ? health.signals : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  connectGithubRepo,
  getRepoDetails,
  getRepoAnalytics,
};
