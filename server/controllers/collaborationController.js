import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import Task from '../models/Task.js';
import Document from '../models/Document.js';
import Report from '../models/Report.js';


// @desc    Get project chat messages
// @route   GET /api/collaboration/chat/:projectId
// @access  Private
const getChatMessages = async (req, res) => {
  const { projectId } = req.params;

  try {
    const messages = await Message.find({ project: projectId })
      .populate('sender', 'username email avatar role')
      .sort({ createdAt: 1 });

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Post message in project chat
// @route   POST /api/collaboration/chat/:projectId
// @access  Private
const postChatMessage = async (req, res) => {
  const { projectId } = req.params;
  const { text } = req.body;

  try {
    const message = await Message.create({
      project: projectId,
      sender: req.user._id,
      text,
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username email avatar role');

    res.status(201).json({ success: true, data: populatedMessage });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user notifications
// @route   GET /api/collaboration/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'username email avatar')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/collaboration/notifications/:id/read
// @access  Private
const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    notification.isRead = true;
    await notification.save();

    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get consolidated activity logs for project
// @route   GET /api/collaboration/activity/:projectId
// @access  Private
const getActivityLogs = async (req, res) => {
  const { projectId } = req.params;

  try {
    // Gather different items from the database to build a consolidated activity feed
    const tasks = await Task.find({ project: projectId })
      .populate('assignedTo', 'username')
      .sort({ updatedAt: -1 })
      .limit(10);
      
    const docs = await Document.find({ project: projectId })
      .populate('uploadedBy', 'username')
      .sort({ createdAt: -1 })
      .limit(10);

    const reports = await Report.find({ project: projectId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Format logs
    let logs = [];

    tasks.forEach(t => {
      logs.push({
        id: `task-${t._id}-${t.updatedAt.getTime()}`,
        type: 'task',
        title: `Task updated: "${t.title}"`,
        description: `Status: [${t.status}] - Priority: ${t.priority}. Assigned to: ${t.assignedTo ? t.assignedTo.username : 'Unassigned'}`,
        timestamp: t.updatedAt,
      });
    });

    docs.forEach(d => {
      logs.push({
        id: `doc-${d._id}`,
        type: 'document',
        title: `Notebook file uploaded: "${d.title}"`,
        description: `File: ${d.fileName} (${d.fileType}) - Category: ${d.category}. Uploaded by ${d.uploadedBy ? d.uploadedBy.username : 'User'}`,
        timestamp: d.createdAt,
      });
    });

    reports.forEach(r => {
      logs.push({
        id: `report-${r._id}`,
        type: 'report',
        title: `${r.type} report generated`,
        description: `Overall rating score: ${r.overallScore}/100. Verification parameters evaluated successfully.`,
        timestamp: r.createdAt,
      });
    });

    // Sort logs chronologically
    logs.sort((a, b) => b.timestamp - a.timestamp);

    // Slice to top 15
    res.json({ success: true, data: logs.slice(0, 15) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  getChatMessages,
  postChatMessage,
  getNotifications,
  markNotificationRead,
  getActivityLogs,
};

