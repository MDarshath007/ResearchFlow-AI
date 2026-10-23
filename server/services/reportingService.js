import Report from '../models/Report.js';

/**
 * Shared RSE Maturity Level threshold classification
 */
export const getMaturityLevel = (score) => {
  const s = Number(score) || 0;
  if (s <= 40) return 'Bronze';
  if (s <= 70) return 'Silver';
  if (s <= 90) return 'Gold';
  return 'Platinum';
};

/**
 * Retrieve assessment reports for a given project with consistent sorting
 */
export const getProjectAssessmentReports = async (projectId, options = {}) => {
  const { sort = { createdAt: -1 }, limit = null } = options;
  let query = Report.find({ project: projectId, type: 'Assessment' }).sort(sort);
  if (limit && Number.isInteger(limit) && limit > 0) {
    query = query.limit(limit);
  }
  return await query.exec();
};

/**
 * Formats historical quality assessment scores for charting and analytics
 */
export const formatScoreHistory = (reports) => {
  if (!Array.isArray(reports)) return [];
  return reports.map((r) => ({
    date: new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    documentation: typeof r.documentationScore === 'number' ? r.documentationScore : 0,
    testing: typeof r.testingScore === 'number' ? r.testingScore : 0,
    git: typeof r.gitScore === 'number' ? r.gitScore : 0,
    collaboration: typeof r.collaborationScore === 'number' ? r.collaborationScore : 0,
    overall: typeof r.overallScore === 'number' ? r.overallScore : 0,
  }));
};

/**
 * Calculate composite project health score based on weighted measurable categories
 */
export const calculateHealthScore = (categories) => {
  if (!categories || typeof categories !== 'object') return 100;

  const healthWeights = [
    [categories.testing, 0.4],
    [categories.documentation, 0.3],
    [categories.git, 0.3],
  ];

  const weighted = healthWeights.filter(([c]) => c && c.measured && typeof c.score === 'number');
  if (weighted.length === 0) return 100;

  const totalWeight = weighted.reduce((acc, [, w]) => acc + w, 0);
  return Math.round(
    weighted.reduce((acc, [c, w]) => acc + c.score * w, 0) / totalWeight
  );
};
