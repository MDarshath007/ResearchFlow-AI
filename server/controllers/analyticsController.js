import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import Repository from '../models/Repository.js';


// @desc    Get dashboard metrics & analytics for project
// @route   GET /api/analytics/project/:projectId
// @access  Private
const getProjectAnalytics = async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Task statuses count
    const totalTasks = await Task.countDocuments({ project: projectId });
    const todoTasks = await Task.countDocuments({ project: projectId, status: 'Todo' });
    const progressTasks = await Task.countDocuments({ project: projectId, status: 'In Progress' });
    const reviewTasks = await Task.countDocuments({ project: projectId, status: 'Review' });
    const completedTasks = await Task.countDocuments({ project: projectId, status: 'Completed' });

    // Task breakdown by assignee
    const tasks = await Task.find({ project: projectId }).populate('assignedTo', 'username');
    const assigneeStats = {};
    tasks.forEach((t) => {
      if (t.assignedTo) {
        const name = t.assignedTo.username;
        assigneeStats[name] = (assigneeStats[name] || 0) + (t.status === 'Completed' ? 1 : 0);
      }
    });

    const productivityData = Object.entries(assigneeStats).map(([name, completedCount]) => ({
      name,
      completed: completedCount,
    }));

    // Historical quality scores (reports)
    const reports = await Report.find({ project: projectId, type: 'Assessment' })
      .sort({ createdAt: 1 })
      .limit(6);

    const scoreHistory = reports.map((r) => ({
      date: new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      documentation: r.documentationScore,
      testing: r.testingScore,
      git: r.gitScore,
      collaboration: r.collaborationScore,
      overall: r.overallScore,
    }));

    // Fetch real repository commit activity if connected (no fabricated fallback)
    const repo = await Repository.findOne({ project: projectId });
    const commitStats = repo && Array.isArray(repo.weeklyContributions) ? repo.weeklyContributions : [];

    res.json({
      success: true,
      data: {
        taskStats: {
          total: totalTasks,
          todo: todoTasks,
          inProgress: progressTasks,
          review: reviewTasks,
          completed: completedTasks,
        },
        productivityData,
        scoreHistory,
        commitStats,
        maturityScore: project.maturityScore,
        maturityLevel: project.maturityLevel,
        healthScore: project.healthScore,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get global leaderboard and platform usage analytics
// @route   GET /api/analytics/leaderboard
// @access  Private
const getLeaderboard = async (req, res) => {
  try {
    // Generate a research team leaderboard ranking projects by maturityScore and tasks completed
    const projects = await Project.find()
      .populate('owner', 'username avatar')
      .sort({ maturityScore: -1 })
      .limit(10);

    const leaderboard = await Promise.all(
      projects.map(async (p, idx) => {
        const completedTasks = await Task.countDocuments({ project: p._id, status: 'Completed' });
        return {
          rank: idx + 1,
          projectName: p.name,
          owner: p.owner ? p.owner.username : 'Researcher',
          ownerAvatar: p.owner ? p.owner.avatar : '',
          maturityScore: p.maturityScore,
          maturityLevel: p.maturityLevel,
          completedTasks,
          domain: p.domain,
        };
      })
    );

    // Platform usage stats
    const totalProjects = await Project.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalTasksCompleted = await Task.countDocuments({ status: 'Completed' });

    res.json({
      success: true,
      data: {
        leaderboard,
        platformStats: {
          totalProjects,
          totalUsers,
          totalTasksCompleted,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  getProjectAnalytics,
  getLeaderboard,
};

