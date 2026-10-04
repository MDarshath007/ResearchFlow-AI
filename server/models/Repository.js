import mongoose from 'mongoose';

const commitSchema = new mongoose.Schema({
  sha: String,
  message: String,
  author: String,
  date: Date,
});

const contributorSchema = new mongoose.Schema({
  name: String,
  avatarUrl: String,
  contributions: Number,
});

const weeklyContributionSchema = new mongoose.Schema({
  week: String, // e.g. "2026-W40" (real ISO week bucket from GitHub commits)
  commits: Number,
});

const issueSchema = new mongoose.Schema({
  number: Number,
  title: String,
  state: String, // 'open' | 'closed'
  author: String,
  date: Date,
  labels: [String],
  severity: String, // first label, if any — null/undefined otherwise
});

const pullRequestSchema = new mongoose.Schema({
  number: Number,
  title: String,
  state: String, // 'open' | 'closed' | 'merged'
  author: String,
  date: Date,
});

const repositorySchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    repoName: {
      type: String,
      required: true,
    },
    repoUrl: {
      type: String,
      required: true,
    },
    owner: {
      type: String,
      default: '',
    },
    repo: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    stars: {
      type: Number,
      default: 0,
    },
    forks: {
      type: Number,
      default: 0,
    },
    openIssuesCount: {
      type: Number,
      default: 0,
    },
    defaultBranch: {
      type: String,
      default: '',
    },
    branches: [
      {
        _id: false,
        name: String,
        protected: Boolean,
      },
    ],
    license: {
      type: String,
      default: '',
    },
    pushedAt: {
      type: Date,
      default: null,
    },
    emptyRepository: {
      type: Boolean,
      default: false,
    },
    commits: [commitSchema],
    contributors: [contributorSchema],
    weeklyContributions: [weeklyContributionSchema],
    issues: [issueSchema],
    pullRequests: [pullRequestSchema],
    readmePresent: {
      type: Boolean,
      default: false,
    },
    fileTreeCount: {
      type: Number,
      default: 0,
    },
    fileTreeTruncated: {
      type: Boolean,
      default: false,
    },
    documentationFiles: [String],
    testFiles: [String],
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Repository', repositorySchema);

