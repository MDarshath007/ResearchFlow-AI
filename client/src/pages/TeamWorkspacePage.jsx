// react-hooks/exhaustive-deps: the mount effect below intentionally calls the
// component-scoped fetchWorkspaceData helper (recreated each render); listing it
// as a dependency would cause refetch loops.
/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { projectAPI, taskAPI, collaborationAPI, notebookAPI } from '../services/api';
import { 
  MessageSquare, Plus, FileText, CheckSquare, 
  Send, Trash2, Calendar, ClipboardList, Clock, Search, Upload, Download 
} from 'lucide-react';
import { Row, Col, Card, Button, Badge, Modal, Form, Spinner, Tabs, Tab, ListGroup, Table, Alert } from 'react-bootstrap';
import UserAvatar from '../components/UserAvatar';

export default function TeamWorkspacePage() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('kanban');

  // Kanban states
  const [tasks, setTasks] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  
  // Task form states
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskSprint, setTaskSprint] = useState('Sprint 1');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [commentText, setCommentText] = useState('');

  // Chat states
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // Notebooks states
  const [documents, setDocuments] = useState([]);
  const [docSearch, setDocSearch] = useState('');
  const [docCategory, setDocCategory] = useState('All');
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Document upload form states
  const [docTitle, setDocTitle] = useState('');
  const [docCatInput, setDocCatInput] = useState('Notebook');
  const [docTags, setDocTags] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Activity logs states
  const [activities, setActivities] = useState([]);

  // Shared inline error for mutation handlers (task ops, chat, docs)
  const [actionError, setActionError] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  const fetchWorkspaceData = async (project) => {
    if (!project) return;
    try {
      // 1. Fetch Kanban Tasks
      const taskRes = await taskAPI.getByProject(project._id);
      if (taskRes.data.success) {
        setTasks(taskRes.data.data);
      }

      // 2. Fetch Chat messages
      const chatRes = await collaborationAPI.getChat(project._id);
      if (chatRes.data.success) {
        setChatMessages(chatRes.data.data);
      }

      // 3. Fetch Notebook files
      const docRes = await notebookAPI.getByProject(project._id, docSearch, docCategory);
      if (docRes.data.success) {
        setDocuments(docRes.data.data);
      }

      // 4. Fetch Activities
      const actRes = await collaborationAPI.getActivity(project._id);
      if (actRes.data.success) {
        setActivities(actRes.data.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load project workspace data.');
    }
  };

  useEffect(() => {
    const initData = async () => {
      try {
        const res = await projectAPI.getAll();
        if (res.data.success) {
          setProjects(res.data.data);
          
          const queryParams = new URLSearchParams(location.search);
          const urlId = queryParams.get('id');
          const tabParam = queryParams.get('tab');
          if (tabParam) setActiveTab(tabParam);
          
          let matched = null;
          if (urlId) {
            matched = res.data.data.find(p => p._id === urlId);
          }
          
          if (!matched && res.data.data.length > 0) {
            matched = res.data.data[0];
          }

          if (matched) {
            setSelectedProject(matched);
            await fetchWorkspaceData(matched);
          }
        }
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to initialize workspace projects.');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [location.search]);

  // Polling for chat messages and activity logs
  useEffect(() => {
    if (!selectedProject || activeTab !== 'chat') return;
    
    const interval = setInterval(async () => {
      try {
        const chatRes = await collaborationAPI.getChat(selectedProject._id);
        if (chatRes.data.success) {
          setChatMessages(chatRes.data.data);
        }
      } catch {
        // Ignore errors during poll
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedProject, activeTab]);

  const handleSelectProject = async (p) => {
    setSelectedProject(p);
    navigate(`/workspace?id=${p._id}`);
    await fetchWorkspaceData(p);
  };

  // HTML5 Drag and Drop functions for Kanban board
  const onDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = async (e, targetStatus) => {
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;

    try {
      const res = await taskAPI.update(taskId, { status: targetStatus });
      if (res.data.success) {
        // Refresh local task state
        setTasks(prev => prev.map(t => t._id === taskId ? res.data.data : t));
        
        // Trigger activity reload
        const actRes = await collaborationAPI.getActivity(selectedProject._id);
        if (actRes.data.success) setActivities(actRes.data.data);
      }
    } catch (err) {
      console.error(err);
      setActionError(err.response?.data?.message || 'Failed to move the task. Please try again.');
    }
  };

  // Task creation handler
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskTitle) return;
    setActionError(null);

    try {
      const res = await taskAPI.create({
        title: taskTitle,
        description: taskDesc,
        project: selectedProject._id,
        priority: taskPriority,
        sprint: taskSprint,
        assignedTo: taskAssignee || null,
        deadline: taskDeadline || null,
      });

      if (res.data.success) {
        setShowTaskModal(false);
        setTaskTitle('');
        setTaskDesc('');
        setTaskPriority('Medium');
        setTaskSprint('Sprint 1');
        setTaskAssignee('');
        setTaskDeadline('');
        
        setTasks(prev => [...prev, res.data.data]);
        
        // Refresh activity logs
        const actRes = await collaborationAPI.getActivity(selectedProject._id);
        if (actRes.data.success) setActivities(actRes.data.data);
      }
    } catch (err) {
      console.error(err);
      setActionError(err.response?.data?.message || 'Failed to create the task. Please try again.');
    }
  };

  // Task comments submission handler
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedTask) return;
    setActionError(null);

    try {
      const res = await taskAPI.addComment(selectedTask._id, commentText);
      if (res.data.success) {
        setCommentText('');
        setSelectedTask(res.data.data);
        setTasks(prev => prev.map(t => t._id === selectedTask._id ? res.data.data : t));
      }
    } catch (err) {
      console.error(err);
      setActionError(err.response?.data?.message || 'Failed to add the comment. Please try again.');
    }
  };

  const handleOpenTaskDetail = (task) => {
    setSelectedTask(task);
    setShowTaskDetail(true);
  };

  // Chat message submission
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedProject) return;
    setActionError(null);

    try {
      const res = await collaborationAPI.sendMessage(selectedProject._id, chatInput);
      if (res.data.success) {
        setChatInput('');
        setChatMessages(prev => [...prev, res.data.data]);
      }
    } catch (err) {
      console.error(err);
      setActionError(err.response?.data?.message || 'Failed to send the chat message. Please try again.');
    }
  };

  // Notebook upload handler
  const handleUploadNotebook = async (e) => {
    e.preventDefault();
    if (!docFile || !selectedProject) return;

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', docTitle);
      formData.append('category', docCatInput);
      formData.append('tags', docTags);
      formData.append('file', docFile);

      const res = await notebookAPI.upload(selectedProject._id, formData);
      if (res.data.success) {
        setShowUploadModal(false);
        setDocTitle('');
        setDocTags('');
        setDocFile(null);
        
        // Reload documents listing
        const docRes = await notebookAPI.getByProject(selectedProject._id, docSearch, docCategory);
        if (docRes.data.success) setDocuments(docRes.data.data);
        
        // Refresh activity logs
        const actRes = await collaborationAPI.getActivity(selectedProject._id);
        if (actRes.data.success) setActivities(actRes.data.data);
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed. Check size constraints.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteNotebook = async (id) => {
    if (window.confirm('Delete this file from repository permanently?')) {
      try {
        await notebookAPI.delete(id);
        setDocuments(prev => prev.filter(d => d._id !== id));
      } catch (err) {
        console.error(err);
        setActionError(err.response?.data?.message || 'Failed to delete the file. Please try again.');
      }
    }
  };

  const handleDocFilterChange = async (searchVal, catVal) => {
    setDocSearch(searchVal);
    setDocCategory(catVal);
    try {
      const res = await notebookAPI.getByProject(selectedProject._id, searchVal, catVal);
      if (res.data.success) setDocuments(res.data.data);
    } catch (err) {
      console.error(err);
      setActionError(err.response?.data?.message || 'Failed to filter documents. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  // Group tasks by status columns
  const getTasksByStatus = (status) => {
    return tasks.filter(t => t.status === status);
  };

  return (
    <div className="fade-in-slide p-4">
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-4">
          <strong>Notice:</strong> {error}
        </Alert>
      )}
      {actionError && (
        <Alert variant="warning" dismissible onClose={() => setActionError(null)} className="mb-4">
          <strong>Notice:</strong> {actionError}
        </Alert>
      )}
      {/* Target Project Selection */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display fw-bold mb-1">Project Workspace Hub</h2>
          <p className="text-muted small mb-0">Collaborate, manage tasks, and catalog research data files</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted small">Project:</span>
          <Form.Select 
            value={selectedProject?._id || ''} 
            onChange={(e) => handleSelectProject(projects.find(p => p._id === e.target.value))}
            style={{ width: '250px' }}
          >
            {projects.map(p => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </Form.Select>
        </div>
      </div>

      {selectedProject ? (
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4 rse-tabs border-bottom">
          {/* TAB 1: Kanban Board */}
          <Tab eventKey="kanban" title="Sprint Kanban Board">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div className="fw-semibold">Active Development Sprint Tasks</div>
              <Button size="sm" className="btn-glow-primary d-flex align-items-center gap-2" onClick={() => setShowTaskModal(true)}>
                <Plus size={16} />
                <span>Create Task</span>
              </Button>
            </div>

            <Row className="g-3">
              {['Todo', 'In Progress', 'Review', 'Completed'].map((status) => (
                <Col key={status} md={3}>
                  <div 
                    className="kanban-col h-100 d-flex flex-column" 
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, status)}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="font-display fw-bold mb-0 text-capitalize small tracking-wider" style={{ letterSpacing: '0.5px' }}>{status}</h5>
                      <Badge bg="secondary-subtle" className="text-secondary-emphasis">{getTasksByStatus(status).length}</Badge>
                    </div>

                    <div className="flex-grow-1 overflow-y-auto" style={{ maxHeight: '600px' }}>
                      {getTasksByStatus(status).map((t) => (
                        <div 
                          key={t._id} 
                          className="kanban-card shadow-sm border" 
                          draggable 
                          onDragStart={(e) => onDragStart(e, t._id)}
                          onClick={() => handleOpenTaskDetail(t)}
                        >
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <span className={`badge ${
                              t.priority === 'High' ? 'bg-danger' : 
                              t.priority === 'Medium' ? 'bg-warning' : 'bg-success'
                            }`} style={{ fontSize: '9px' }}>
                              {t.priority}
                            </span>
                            <span className="text-muted" style={{ fontSize: '10px' }}>{t.sprint}</span>
                          </div>
                          <div className="fw-semibold small text-body mb-2">{t.title}</div>
                          {t.assignedTo && (
                            <div className="d-flex align-items-center gap-2 mt-2">
                              <UserAvatar user={t.assignedTo} size={20} />
                              <span className="text-muted" style={{ fontSize: '11px' }}>{t.assignedTo.username}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Tab>

          {/* TAB 2: Project Chat discussions */}
          <Tab eventKey="chat" title="Project Discussions">
            <Row className="justify-content-center">
              <Col lg={8}>
                <Card className="glass-card border-0 shadow-sm p-4 d-flex flex-column" style={{ height: '550px' }}>
                  <div className="border-bottom pb-3 mb-3">
                    <h5 className="font-display fw-bold mb-0 d-flex align-items-center gap-2">
                      <MessageSquare className="text-primary" />
                      <span>Team Workspace Feed</span>
                    </h5>
                    <span className="text-muted small">Real-time sync active (every 4 seconds)</span>
                  </div>

                  {/* Messages container */}
                  <div className="flex-grow-1 overflow-y-auto mb-3 bg-body-tertiary rounded-3 p-3" style={{ fontSize: '13.5px' }}>
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-5 text-muted">No messages posted yet. Post a query to coordinate.</div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div key={msg._id} className="d-flex gap-3 mb-3">
                          <UserAvatar user={msg.sender} size={36} />

                          <div>
                            <div className="d-flex align-items-center gap-2 mb-0.5">
                              <span className="fw-semibold small">{msg.sender?.username}</span>
                              <span className="badge bg-secondary" style={{ fontSize: '8px' }}>{msg.sender?.role}</span>
                              <span className="text-muted" style={{ fontSize: '10px' }}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="text-body bg-body p-2 border rounded-3 d-inline-block">{msg.text}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input form */}
                  <Form onSubmit={handleSendChat} className="d-flex gap-2">
                    <Form.Control
                      type="text"
                      placeholder="Discuss research design or task delegation..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <Button type="submit" className="btn-glow-primary px-3" disabled={!chatInput.trim()}>
                      <Send size={16} />
                    </Button>
                  </Form>
                </Card>
              </Col>
            </Row>
          </Tab>

          {/* TAB 3: Notebook Repository uploads */}
          <Tab eventKey="notebooks" title="Notebook Repository">
            <Card className="glass-card border-0 p-4 shadow-sm">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
                <div className="d-flex align-items-center gap-3">
                  <div className="position-relative">
                    <Form.Control
                      type="text"
                      placeholder="Search title or tag..."
                      value={docSearch}
                      onChange={(e) => handleDocFilterChange(e.target.value, docCategory)}
                      className="ps-4"
                      style={{ width: '220px', fontSize: '13px' }}
                    />
                    <Search className="position-absolute text-muted" size={14} style={{ left: '12px', top: '10px' }} />
                  </div>
                  <Form.Select 
                    value={docCategory}
                    onChange={(e) => handleDocFilterChange(docSearch, e.target.value)}
                    style={{ width: '160px', fontSize: '13px' }}
                  >
                    <option value="All">All Categories</option>
                    <option value="Notebook">Jupyter Notebooks</option>
                    <option value="Paper">Research Papers</option>
                    <option value="Dataset">Datasets</option>
                  </Form.Select>
                </div>

                <Button className="btn-glow-primary d-flex align-items-center gap-2" onClick={() => setShowUploadModal(true)}>
                  <Upload size={16} />
                  <span>Upload Document</span>
                </Button>
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-5 text-muted border rounded-3 border-dashed">
                  <FileText size={40} className="mb-2 text-secondary" />
                  <div>No research files matching filters are cataloged. Upload notebooks to begin.</div>
                </div>
              ) : (
                <Table responsive hover className="align-middle mb-0">
                  <thead>
                    <tr className="text-muted small border-bottom">
                      <th>File Name / Title</th>
                      <th>Type</th>
                      <th>Category</th>
                      <th>Uploaded By</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc._id}>
                        <td>
                          <div className="fw-semibold">{doc.title}</div>
                          <div className="text-muted small">{doc.fileName}</div>
                          <div className="mt-1 d-flex gap-1.5 flex-wrap">
                            {doc.tags?.map((tag, i) => (
                              <span key={i} className="badge bg-secondary-subtle text-secondary-emphasis" style={{ fontSize: '9px' }}>{tag}</span>
                            ))}
                          </div>
                        </td>
                        <td><span className="badge bg-body border">{doc.fileType}</span></td>
                        <td><span className="badge bg-primary-subtle text-primary-emphasis">{doc.category}</span></td>
                        <td><span className="small text-muted">{doc.uploadedBy?.username}</span></td>
                        <td><span className="small text-muted">{new Date(doc.createdAt).toLocaleDateString()}</span></td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button href={`${import.meta.env.VITE_SERVER_URL}${doc.fileUrl}`} target="_blank" size="sm" variant="outline-primary" className="d-flex align-items-center gap-1">
                              <Download size={12} />
                              <span>Download</span>
                            </Button>
                            <Button size="sm" variant="outline-danger" onClick={() => handleDeleteNotebook(doc._id)}>
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </Tab>

          {/* TAB 4: Activity logs consolidation */}
          <Tab eventKey="activity" title="Activity Logs">
            <Card className="glass-card border-0 p-4 shadow-sm">
              <h5 className="font-display fw-bold mb-3 d-flex align-items-center gap-2">
                <Clock className="text-primary" />
                <span>Workspace Activity Log Timeline</span>
              </h5>

              {activities.length === 0 ? (
                <div className="text-muted py-4">No recent task movements or document uploads detected.</div>
              ) : (
                <ListGroup variant="flush">
                  {activities.map((act) => (
                    <ListGroup.Item key={act.id} className="px-0 py-3 border-bottom bg-transparent d-flex gap-3 align-items-start">
                      <div className="p-2 bg-primary-subtle text-primary rounded-3">
                        {act.type === 'task' ? <CheckSquare size={16} /> : 
                         act.type === 'document' ? <FileText size={16} /> : <ClipboardList size={16} />}
                      </div>
                      <div className="flex-grow-1">
                        <div className="fw-semibold small">{act.title}</div>
                        <div className="text-muted small">{act.description}</div>
                        <span className="text-muted" style={{ fontSize: '10px' }}>
                          {new Date(act.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card>
          </Tab>
        </Tabs>
      ) : (
        <div className="text-center py-5 text-muted glass-card">No projects created yet. Create a project to open the workspace.</div>
      )}

      {/* Modal: Create Kanban Task */}
      <Modal show={showTaskModal} onHide={() => setShowTaskModal(false)} centered>
        <Form onSubmit={handleCreateTask}>
          <Modal.Header closeButton className="border-0">
            <Modal.Title className="font-display fw-bold">Add Sprint Task</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3" controlId="tTitle">
              <Form.Label className="small fw-semibold">Task Title</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. Implement Pytest testing suites"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="tDesc">
              <Form.Label className="small fw-semibold">Task Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Explain the required steps or expectations..."
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
              />
            </Form.Group>

            <Row className="mb-3">
              <Col md={6}>
                <Form.Group controlId="tPriority">
                  <Form.Label className="small fw-semibold">Priority</Form.Label>
                  <Form.Select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="tSprint">
                  <Form.Label className="small fw-semibold">Sprint</Form.Label>
                  <Form.Control
                    type="text"
                    value={taskSprint}
                    onChange={(e) => setTaskSprint(e.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group controlId="tAssign">
                  <Form.Label className="small fw-semibold">Assign To</Form.Label>
                  <Form.Select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
                    <option value="">Unassigned</option>
                    {selectedProject?.teamMembers?.map((m) => (
                      <option key={m._id} value={m._id}>{m.username}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="tDeadline">
                  <Form.Label className="small fw-semibold">Deadline</Form.Label>
                  <Form.Control
                    type="date"
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer className="border-0">
            <Button variant="outline-secondary" onClick={() => setShowTaskModal(false)}>Cancel</Button>
            <Button type="submit" className="btn-glow-primary">Create Task</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal: Task Detail & Comments */}
      <Modal show={showTaskDetail} onHide={() => setShowTaskDetail(false)} centered size="lg">
        {selectedTask && (
          <>
            <Modal.Header closeButton className="border-0">
              <Modal.Title className="font-display fw-bold">{selectedTask.title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Row className="mb-4">
                <Col md={8}>
                  <div className="fw-semibold small text-muted mb-1.5">Description:</div>
                  <p className="text-body bg-body-secondary p-3 rounded border small mb-4" style={{ minHeight: '80px', whiteSpace: 'pre-wrap' }}>
                    {selectedTask.description || 'No description provided.'}
                  </p>

                  {/* Comments feed */}
                  <div className="fw-semibold small text-muted mb-2">Collaboration Thread:</div>
                  <div className="overflow-y-auto mb-3 bg-body-tertiary rounded p-2.5 border" style={{ maxHeight: '200px', fontSize: '12.5px' }}>
                    {selectedTask.comments?.length === 0 ? (
                      <div className="text-muted text-center py-4">No comments posted yet.</div>
                    ) : (
                      selectedTask.comments?.map((comment) => (
                        <div key={comment._id} className="d-flex gap-2.5 mb-2 border-bottom pb-2">
                          <UserAvatar user={comment.user} size={24} />
                          <div>
                            <div className="d-flex align-items-center gap-1.5">
                              <span className="fw-semibold">{comment.user?.username}</span>
                              <span className="text-muted" style={{ fontSize: '9px' }}>
                                {new Date(comment.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-muted mt-0.5">{comment.text}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <Form onSubmit={handleAddComment} className="d-flex gap-2">
                    <Form.Control
                      type="text"
                      placeholder="Post a query comment on task implementation..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      required
                    />
                    <Button type="submit" variant="primary">Post</Button>
                  </Form>
                </Col>

                <Col md={4} className="border-start">
                  <div className="mb-3">
                    <span className="text-muted small d-block mb-1">Status:</span>
                    <Badge bg="primary" className="text-capitalize px-2.5 py-1.5">{selectedTask.status}</Badge>
                  </div>
                  <div className="mb-3">
                    <span className="text-muted small d-block mb-1">Priority:</span>
                    <Badge bg="warning" className="px-2.5 py-1.5">{selectedTask.priority}</Badge>
                  </div>
                  <div className="mb-3">
                    <span className="text-muted small d-block mb-1">Sprint:</span>
                    <span className="fw-semibold small">{selectedTask.sprint}</span>
                  </div>
                  {selectedTask.assignedTo && (
                    <div className="mb-3">
                      <span className="text-muted small d-block mb-1">Assigned Scholar:</span>
                      <div className="d-flex align-items-center gap-2">
                        <UserAvatar user={selectedTask.assignedTo} size={24} />
                        <span className="fw-semibold small">{selectedTask.assignedTo.username}</span>
                      </div>
                    </div>
                  )}
                  {selectedTask.deadline && (
                    <div>
                      <span className="text-muted small d-block mb-1">Target Date:</span>
                      <span className="small text-muted d-flex align-items-center gap-1">
                        <Calendar size={14} />
                        <span>{new Date(selectedTask.deadline).toLocaleDateString()}</span>
                      </span>
                    </div>
                  )}
                </Col>
              </Row>
            </Modal.Body>
          </>
        )}
      </Modal>

      {/* Modal: Upload Notebook File */}
      <Modal show={showUploadModal} onHide={() => setShowUploadModal(false)} centered>
        <Form onSubmit={handleUploadNotebook}>
          <Modal.Header closeButton className="border-0">
            <Modal.Title className="font-display fw-bold">Upload Scientific File</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3" controlId="docTitle">
              <Form.Label className="small fw-semibold">Document Title</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. EDA Genomic Alignment Charts"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                required
              />
            </Form.Group>

            <Row className="mb-3">
              <Col md={6}>
                <Form.Group controlId="docCategory">
                  <Form.Label className="small fw-semibold">Category</Form.Label>
                  <Form.Select value={docCatInput} onChange={(e) => setDocCatInput(e.target.value)}>
                    <option value="Notebook">Jupyter Notebook (.ipynb)</option>
                    <option value="Paper">Research Paper (.pdf, .docx)</option>
                    <option value="Dataset">Dataset (.csv, .xlsx)</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="docTags">
                  <Form.Label className="small fw-semibold">Tags (comma-separated)</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. genomic, eda, v1"
                    value={docTags}
                    onChange={(e) => setDocTags(e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4" controlId="docFile">
              <Form.Label className="small fw-semibold">Select File</Form.Label>
              <Form.Control 
                type="file" 
                onChange={(e) => setDocFile(e.target.files[0])}
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-0">
            <Button variant="outline-secondary" onClick={() => setShowUploadModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={uploadLoading}>
              {uploadLoading ? <Spinner size="sm" /> : 'Start Upload'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
