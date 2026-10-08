import mongoose from 'mongoose';
import LearningModule from '../models/LearningModule.js';
import UserProgress from '../models/UserProgress.js';
import Project from '../models/Project.js';
import Report from '../models/Report.js';

// ── Helpers ────────────────────────────────────────────────────────────────

const isValidId = (id) => mongoose.isValidObjectId(id);

const progressShape = (p) =>
  p
    ? {
        completed: p.completed,
        completedAt: p.completedAt,
        quizScore: p.quizScore,
        quizAttempts: p.quizAttempts,
        updatedAt: p.updatedAt,
      }
    : null;

// Quiz questions returned BEFORE submission never include correctAnswer /
// explanation — scoring is calculated server-side only.
const publicQuiz = (quiz) =>
  (quiz || []).map((q) => ({
    _id: q._id,
    question: q.question,
    options: q.options,
  }));

// ── Recommendation rules (Phase 6) ────────────────────────────────────────
// Each weakness/recommendation string from an actual stored assessment is
// matched against module topics. First matching rule wins per string so a
// single finding never invents multiple recommendations.

const RECOMMENDATION_RULES = [
  {
    slug: 'testing-test-automation',
    pattern: /\btests?\b|testing|test runner|unit tests|\bci\b|coverage|pytest|jest|vitest/i,
  },
  {
    slug: 'documentation-standards',
    pattern: /\breadme\b|documentation|docs\b|license|citation|install guide|api doc/i,
  },
  {
    slug: 'reproducibility-environment',
    pattern: /reproducib|docker|environment|dependenc|requirement|\.env|manifest|pinned/i,
  },
  {
    slug: 'version-control-branching',
    pattern: /\bbranches?\b|\bcommits?\b|committing|commit history|version control|repository activit/i,
  },
  {
    slug: 'collaboration-code-review',
    pattern: /collaborat|pull request|review|contributor|\bteam\b|invite|single member|\bissues?\b/i,
  },
];

const REASON_LIMIT_PER_MODULE = 3;

const buildRecommendations = async (userId) => {
  const empty = { recommendations: [], hasAssessmentData: false };

  const projects = await Project.find({
    $or: [{ owner: userId }, { teamMembers: userId }],
  })
    .select('_id')
    .limit(50)
    .lean();

  if (!projects.length) return empty;

  const reports = await Report.find({
    project: { $in: projects.map((p) => p._id) },
    type: 'Assessment',
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  if (!reports.length) return empty;

  // Latest assessment per project only.
  const seenProjects = new Set();
  const findings = [];
  for (const report of reports) {
    const key = String(report.project);
    if (seenProjects.has(key)) continue;
    seenProjects.add(key);
    const details = report.details || {};
    for (const text of [...(details.weaknesses || []), ...(details.recommendations || [])]) {
      if (typeof text === 'string' && text.trim()) findings.push(text.trim());
    }
  }

  if (!findings.length) return { recommendations: [], hasAssessmentData: true };

  // Map each finding to at most one module slug.
  const reasonsBySlug = new Map();
  for (const finding of findings) {
    const rule = RECOMMENDATION_RULES.find((r) => r.pattern.test(finding));
    if (!rule) continue;
    const list = reasonsBySlug.get(rule.slug) || [];
    if (list.length >= REASON_LIMIT_PER_MODULE) continue;
    if (!list.includes(finding)) list.push(finding);
    reasonsBySlug.set(rule.slug, list);
  }

  if (!reasonsBySlug.size) return { recommendations: [], hasAssessmentData: true };

  const modules = await LearningModule.find({
    slug: { $in: [...reasonsBySlug.keys()] },
    published: true,
  })
    .select('_id title slug')
    .lean();

  const recommendations = modules.map((m) => ({
    module: m._id,
    title: m.title,
    slug: m.slug,
    reasons: reasonsBySlug.get(m.slug) || [],
  }));

  return { recommendations, hasAssessmentData: true };
};

// ── Controllers ────────────────────────────────────────────────────────────

// @desc    List learning modules with the user's progress + recommendations
// @route   GET /api/learning/modules
// @access  Private
const getModules = async (req, res) => {
  try {
    const [modules, progressRows, recs] = await Promise.all([
      LearningModule.find({ published: true })
        .select(
          'title slug description category difficulty estimatedMinutes lessons quiz createdAt'
        )
        .sort({ createdAt: 1 })
        .lean(),
      UserProgress.find({ user: req.user._id }).lean(),
      buildRecommendations(req.user._id),
    ]);

    const progressByModule = new Map(progressRows.map((p) => [String(p.module), p]));

    const data = modules.map((m) => ({
      _id: m._id,
      title: m.title,
      slug: m.slug,
      description: m.description,
      category: m.category,
      difficulty: m.difficulty,
      estimatedMinutes: m.estimatedMinutes,
      lessonCount: (m.lessons || []).length,
      quizCount: (m.quiz || []).length,
      progress: progressShape(progressByModule.get(String(m._id))) || {
        completed: false,
        completedAt: null,
        quizScore: null,
        quizAttempts: 0,
      },
    }));

    res.json({
      success: true,
      data: {
        modules: data,
        recommendations: recs.recommendations,
        hasAssessmentData: recs.hasAssessmentData,
      },
    });
  } catch (error) {
    console.error('getModules error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load learning modules' });
  }
};

// @desc    Get one module (lessons + quiz without answers) + user progress
// @route   GET /api/learning/modules/:id
// @access  Private
const getModule = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid module id' });
  }

  try {
    const mod = await LearningModule.findOne({ _id: id, published: true }).lean();
    if (!mod) {
      return res.status(404).json({ success: false, message: 'Learning module not found' });
    }

    const progress = await UserProgress.findOne({ user: req.user._id, module: mod._id }).lean();

    res.json({
      success: true,
      data: {
        module: {
          _id: mod._id,
          title: mod.title,
          slug: mod.slug,
          description: mod.description,
          category: mod.category,
          difficulty: mod.difficulty,
          estimatedMinutes: mod.estimatedMinutes,
          lessons: mod.lessons || [],
          quiz: publicQuiz(mod.quiz),
        },
        progress: progressShape(progress) || {
          completed: false,
          completedAt: null,
          quizScore: null,
          quizAttempts: 0,
        },
      },
    });
  } catch (error) {
    console.error('getModule error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load learning module' });
  }
};

// @desc    Submit quiz answers — scored server-side, progress updated
// @route   POST /api/learning/modules/:id/quiz
// @access  Private
const submitQuiz = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid module id' });
  }

  const { answers } = req.body || {};

  try {
    const mod = await LearningModule.findOne({ _id: id, published: true }).lean();
    if (!mod) {
      return res.status(404).json({ success: false, message: 'Learning module not found' });
    }

    const quiz = mod.quiz || [];
    if (!quiz.length) {
      return res.status(400).json({ success: false, message: 'This module has no quiz' });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Answers must be an array of { questionId, selectedAnswer }',
      });
    }

    if (answers.length !== quiz.length) {
      return res.status(400).json({
        success: false,
        message: `Expected an answer for each of the ${quiz.length} questions`,
      });
    }

    const questionById = new Map(quiz.map((q) => [String(q._id), q]));
    const seen = new Set();

    for (const entry of answers) {
      if (!entry || typeof entry !== 'object') {
        return res.status(400).json({ success: false, message: 'Each answer must be an object' });
      }
      const { questionId, selectedAnswer } = entry;
      if (!isValidId(questionId) || !questionById.has(String(questionId))) {
        return res.status(400).json({ success: false, message: 'Unknown question id' });
      }
      if (seen.has(String(questionId))) {
        return res.status(400).json({ success: false, message: 'Duplicate answer for a question' });
      }
      seen.add(String(questionId));
      const question = questionById.get(String(questionId));
      if (!Number.isInteger(selectedAnswer) || selectedAnswer < 0 || selectedAnswer >= question.options.length) {
        return res.status(400).json({ success: false, message: 'Answer is out of range for this question' });
      }
    }

    // Server-side scoring using stored correct answers — client input is only
    // the selected option index; a client-provided score is never read.
    let score = 0;
    const results = answers.map((entry) => {
      const question = questionById.get(String(entry.questionId));
      const isCorrect = question.correctAnswer === entry.selectedAnswer;
      if (isCorrect) score += 1;
      return {
        questionId: question._id,
        question: question.question,
        options: question.options,
        selectedAnswer: entry.selectedAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation,
      };
    });

    const total = quiz.length;
    const percentage = Math.round((score / total) * 100);

    const progress = await UserProgress.findOneAndUpdate(
      { user: req.user._id, module: mod._id },
      {
        $set: { quizScore: percentage },
        $inc: { quizAttempts: 1 },
        $setOnInsert: { user: req.user._id, module: mod._id, completed: false, completedAt: null },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      data: {
        score,
        total,
        percentage,
        results,
        progress: progressShape(progress),
      },
    });
  } catch (error) {
    console.error('submitQuiz error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to submit quiz' });
  }
};

// @desc    Mark a module complete for the authenticated user
// @route   POST /api/learning/modules/:id/complete
// @access  Private
const completeModule = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid module id' });
  }

  try {
    const mod = await LearningModule.findOne({ _id: id, published: true }).lean();
    if (!mod) {
      return res.status(404).json({ success: false, message: 'Learning module not found' });
    }

    // Only completed/completedAt are written; the body is ignored entirely,
    // so no other user or progress field can be mass-assigned. The record is
    // always keyed by (req.user._id, module) — clients never supply a
    // progress id, so another user's progress cannot be targeted.
    const progress = await UserProgress.findOneAndUpdate(
      { user: req.user._id, module: mod._id },
      {
        $set: { completed: true, completedAt: new Date() },
        $setOnInsert: { user: req.user._id, module: mod._id, quizScore: null, quizAttempts: 0 },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: { progress: progressShape(progress) } });
  } catch (error) {
    console.error('completeModule error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update progress' });
  }
};

export { getModules, getModule, submitQuiz, completeModule };
