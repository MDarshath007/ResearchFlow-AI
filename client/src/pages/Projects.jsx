import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { projectAPI, githubAPI } from '../services/api';
import MaturityBadge from '../components/MaturityBadge';
import { 
  FolderKanban, GitBranch, Users, Goal, Calendar, Plus, 
  Trash2, Edit, ChevronRight, Link2, ExternalLink, RefreshCw 
} from 'lucide-react';
import { Container, Row, Col, Card, Button, Badge, Modal, Form, Spinner, ListGroup } from 'react-bootstrap';
import UserAvatar from '../components/UserAvatar';


export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [repoLoading, setRepoLoading] = useState(false);
  const [gitDetails, setGitDetails] = useState(null);
  const [repoError, setRepoError] = useState('');

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('Machine Learning');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [deadline, setDeadline] = useState('');
  const [objectiveInput, setObjectiveInput] = useState('');
  const [objectives, setObjectives] = useState([]);

  const location = useLocation();
  const navigate = useNavigate();

  const fetchProjects = async (selectId = null) => {
    try {
      const res = await projectAPI.getAll();
      if (res.data.success) {
        setProjects(res.data.data);
        
        // Handle selection based on URL search query or function param
        const queryParams = new URLSearchParams(location.search);
        const urlId = selectId || queryParams.get('id');
        
        if (urlId && res.data.data.length > 0) {
          const matched = res.data.data.find(p => p._id === urlId);
          if (matched) {
            setSelectedProject(matched);
            fetchGitRepo(matched);
          }
        } else if (res.data.data.length > 0 && !selectedProject) {
          setSelectedProject(res.data.data[0]);
          fetchGitRepo(res.data.data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [location.search]);

  const fetchGitRepo = async (project) => {
    setGitDetails(null);
    setRepoError('');

    if (!project?._id || !project.repositoryUrl) {
      return;
    }

    try {
      const res = await githubAPI.getDetails(project._id);
      if (res.data.success) {
        setGitDetails(res.data.data);
      }
    } catch (err) {
      // Ignore if no repo connected
    }
  };

  const handleSelectProject = (project) => {
    setSelectedProject(project);
    fetchGitRepo(project);
    navigate(`/projects?id=${project._id}`);
  };

  const handleAddObjective = () => {
    if (objectiveInput.trim()) {
      setObjectives(prev => [...prev, objectiveInput.trim()]);
      setObjectiveInput('');
    }
  };

  const handleRemoveObjective = (idx) => {
    setObjectives(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!name || !description) return;

    try {
      const res = await projectAPI.create({
        name,
        description,
        domain,
        repositoryUrl,
        deadline,
        researchObjectives: objectives,
      });

      if (res.data.success) {
        setShowCreate(false);
        // Clear fields
        setName('');
        setDescription('');
        setRepositoryUrl('');
        setDeadline('');
        setObjectives([]);
        
        fetchProjects(res.data.data._id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConnectRepo = async (e) => {
    e.preventDefault();
    if (!repositoryUrl || !selectedProject) return;

    setRepoLoading(true);
    setRepoError('');
    try {
      const res = await githubAPI.connect(selectedProject._id, repositoryUrl);
      if (res.data.success) {
        setRepositoryUrl('');
        setGitDetails(res.data.data);
        // Refresh project list to reflect repo URL
        fetchProjects(selectedProject._id);
      }
    } catch (err) {
      setRepoError(
        err.response?.data?.message ||
          'Failed to connect the repository. Please verify the URL and try again.'
      );
    } finally {
      setRepoLoading(false);
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail || !selectedProject) return;

    setInviteLoading(true);
    try {
      const res = await projectAPI.addMember(selectedProject._id, inviteEmail);
      if (res.data.success) {
        setInviteEmail('');
        setShowInvite(false);
        fetchProjects(selectedProject._id);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to invite team member');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleDeleteProject = async (id) => {
    if (window.confirm('Are you sure you want to delete this research project? All tasks and assessment reports will be removed.')) {
      try {
        await projectAPI.delete(id);
        setSelectedProject(null);
        fetchProjects();
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div className="fade-in-slide p-4 workspace-page projects-page">
      <Row className="g-4">
        {/* Left Side: Projects Directory list */}
        <Col lg={4}>
          <Card className="glass-card section-card border-0 p-3 h-100 shadow-sm">
            <div className="d-flex justify-content-between align-items-center mb-3 px-2">
              <h4 className="font-display fw-bold mb-0">Projects Directory</h4>
              <Button size="sm" className="btn-glow-primary" onClick={() => setShowCreate(true)}>
                <Plus size={16} />
              </Button>
            </div>

            {projects.length === 0 ? (
              <div className="text-center py-5 text-muted">No projects found. Create one to begin.</div>
            ) : (
              <ListGroup variant="flush">
                {projects.map((p) => (
                  <ListGroup.Item
                    key={p._id}
                    onClick={() => handleSelectProject(p)}
                    className={`border-0 rounded-3 mb-2 p-3 d-flex align-items-center justify-content-between cursor-pointer ${
                      selectedProject?._id === p._id ? 'bg-primary-subtle text-primary-emphasis border border-primary-subtle' : 'bg-body'
                    }`}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="fw-semibold text-truncate">{p.name}</div>
                      <div className="text-muted small">{p.domain}</div>
                    </div>
                    <ChevronRight size={16} />
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Card>
        </Col>

        {/* Right Side: Selected Project Workspace Detail */}
        <Col lg={8}>
          {selectedProject ? (
            <div className="d-flex flex-column gap-4">
              {/* Project Title Card */}
              <Card className="glass-card border-0 p-4 shadow-sm">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h3 className="font-display fw-bold mb-1">{selectedProject.name}</h3>
                    <p className="text-muted small mb-0">{selectedProject.description}</p>
                  </div>
                  <div className="d-flex gap-2">
                    <Button variant="outline-danger" size="sm" onClick={() => handleDeleteProject(selectedProject._id)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-3 align-items-center border-top pt-3">
                  <div>
                    <span className="text-muted small me-2">Domain:</span>
                    <span className="badge bg-secondary-subtle text-secondary-emphasis">{selectedProject.domain}</span>
                  </div>
                  <div>
                    <span className="text-muted small me-2">Quality Grade:</span>
                    <MaturityBadge score={selectedProject.maturityScore} />
                  </div>
                  <div>
                    <span className="text-muted small me-2">Status:</span>
                    <span className="badge bg-primary">{selectedProject.status}</span>
                  </div>
                </div>
              </Card>

              {/* Action Buttons to Modules */}
              <Row className="g-3">
                <Col md={4}>
                  <Button variant="outline-primary" className="w-100 py-3 d-flex flex-column align-items-center gap-2 rounded-3 fw-semibold shadow-sm" onClick={() => navigate(`/workspace?id=${selectedProject._id}`)}>
                    <FolderKanban size={24} />
                    <span>Workspace Hub</span>
                  </Button>
                </Col>
                <Col md={4}>
                  <Button variant="outline-primary" className="w-100 py-3 d-flex flex-column align-items-center gap-2 rounded-3 fw-semibold shadow-sm" onClick={() => navigate(`/assessments?id=${selectedProject._id}`)}>
                    <Goal size={24} />
                    <span>Assess Quality</span>
                  </Button>
                </Col>
                <Col md={4}>
                  <Button variant="outline-primary" className="w-100 py-3 d-flex flex-column align-items-center gap-2 rounded-3 fw-semibold shadow-sm" onClick={() => navigate(`/workspace?id=${selectedProject._id}&tab=notebooks`)}>
                    <Plus size={24} />
                    <span>Notebook Repo</span>
                  </Button>
                </Col>
              </Row>

              {/* Collaborators & Objectives details */}
              <Row className="g-4">
                <Col md={6}>
                  <Card className="glass-card border-0 p-4 shadow-sm h-100">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="font-display fw-bold mb-0 d-flex align-items-center gap-2">
                        <Users size={18} className="text-primary" />
                        <span>Team Collaborators</span>
                      </h5>
                      <Button size="sm" variant="outline-primary" onClick={() => setShowInvite(true)}>
                        Invite
                      </Button>
                    </div>

                    <ListGroup variant="flush">
                      {selectedProject.teamMembers?.map((m) => (
                        <ListGroup.Item key={m._id} className="px-0 py-2 border-0 bg-transparent d-flex align-items-center gap-3">
                          <UserAvatar user={m} size={32} />
                          <div>
                            <div className="fw-semibold small">{m.username}</div>
                            <span className="badge bg-secondary" style={{ fontSize: '9px' }}>{m.role}</span>
                          </div>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  </Card>
                </Col>

                <Col md={6}>
                  <Card className="glass-card border-0 p-4 shadow-sm h-100">
                    <h5 className="font-display fw-bold mb-3 d-flex align-items-center gap-2">
                      <Goal size={18} className="text-primary" />
                      <span>Research Objectives</span>
                    </h5>

                    {selectedProject.researchObjectives?.length === 0 ? (
                      <div className="text-muted small">No objectives defined yet.</div>
                    ) : (
                      <ul className="ps-3 mb-0 text-muted small">
                        {selectedProject.researchObjectives?.map((obj, i) => (
                          <li key={i} className="mb-2">{obj}</li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </Col>
              </Row>

              {/* Git Repository Connections */}
              <Card className="glass-card border-0 p-4 shadow-sm">
                <h5 className="font-display fw-bold mb-3 d-flex align-items-center gap-2">
                  <GitBranch size={18} className="text-primary" />
                  <span>GitHub Repository Connection</span>
                </h5>

                {gitDetails ? (
                  <div>
                    <div className="d-flex align-items-center justify-content-between p-3 bg-body-secondary rounded-3 border mb-3 flex-wrap gap-2">
                      <div style={{ minWidth: 0 }}>
                        <div className="fw-semibold font-display text-primary d-flex align-items-center gap-2">
                          <Link2 size={16} />
                          <span>{gitDetails.repoName}</span>
                        </div>
                        <a href={gitDetails.repoUrl} target="_blank" rel="noopener noreferrer" className="text-muted small d-flex align-items-center gap-1 text-decoration-none">
                          <span>{gitDetails.repoUrl}</span>
                          <ExternalLink size={12} />
                        </a>
                        {gitDetails.description && (
                          <div className="text-muted small text-truncate mt-1" style={{ maxWidth: '420px' }}>{gitDetails.description}</div>
                        )}
                      </div>
                      <div className="d-flex gap-3 small">
                        <div title="Stars">★ {gitDetails.stars ?? 0}</div>
                        <div title="Forks">⑂ {gitDetails.forks ?? 0}</div>
                      </div>
                    </div>

                    {/* Real repository metadata from GitHub (shown only when available) */}
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {gitDetails.defaultBranch && (
                        <Badge bg="primary-subtle" className="text-primary-emphasis" style={{ fontSize: '11px' }}>
                          Branch: {gitDetails.defaultBranch}
                        </Badge>
                      )}
                      {typeof gitDetails.openIssuesCount === 'number' && (
                        <Badge bg="secondary-subtle" className="text-secondary-emphasis" style={{ fontSize: '11px' }}>
                          Open issues: {gitDetails.openIssuesCount}
                        </Badge>
                      )}
                      {gitDetails.license && (
                        <Badge bg="secondary-subtle" className="text-secondary-emphasis" style={{ fontSize: '11px' }}>
                          License: {gitDetails.license}
                        </Badge>
                      )}
                      {gitDetails.pushedAt && (
                        <Badge bg="secondary-subtle" className="text-secondary-emphasis" style={{ fontSize: '11px' }}>
                          Last push: {new Date(gitDetails.pushedAt).toLocaleDateString()}
                        </Badge>
                      )}
                      <Badge bg={gitDetails.readmePresent ? 'success-subtle' : 'secondary-subtle'} className={gitDetails.readmePresent ? 'text-success-emphasis' : 'text-secondary-emphasis'} style={{ fontSize: '11px' }}>
                        README {gitDetails.readmePresent ? '✓' : '—'}
                      </Badge>
                      <Badge bg={(gitDetails.testFiles || []).length > 0 ? 'success-subtle' : 'secondary-subtle'} className={(gitDetails.testFiles || []).length > 0 ? 'text-success-emphasis' : 'text-secondary-emphasis'} style={{ fontSize: '11px' }}>
                        Tests {(gitDetails.testFiles || []).length > 0 ? '✓' : '—'}
                      </Badge>
                      <Badge bg={(gitDetails.documentationFiles || []).length > 0 ? 'success-subtle' : 'secondary-subtle'} className={(gitDetails.documentationFiles || []).length > 0 ? 'text-success-emphasis' : 'text-secondary-emphasis'} style={{ fontSize: '11px' }}>
                        Docs {(gitDetails.documentationFiles || []).length > 0 ? '✓' : '—'}
                      </Badge>
                      {gitDetails.lastSyncedAt && (
                        <Badge bg="light" text="muted" className="border" style={{ fontSize: '11px' }}>
                          Synced {new Date(gitDetails.lastSyncedAt).toLocaleString()}
                        </Badge>
                      )}
                    </div>

                    <div className="fw-semibold small mb-2 text-muted">
                      {gitDetails.emptyRepository ? 'Repository is empty — no commits yet.' : 'Recent Repository Commits:'}
                    </div>
                    {!gitDetails.emptyRepository && (
                      <ListGroup variant="flush">
                        {(gitDetails.commits || []).length === 0 ? (
                          <ListGroup.Item className="px-0 py-2 border-0 bg-transparent text-muted small">
                            No commit data available.
                          </ListGroup.Item>
                        ) : (
                          (gitDetails.commits || []).slice(0, 3).map((commit, idx) => (
                            <ListGroup.Item key={idx} className="px-0 py-2 border-0 bg-transparent d-flex justify-content-between align-items-start gap-2">
                              <div style={{ minWidth: 0 }}>
                                <div className="text-body small fw-semibold text-truncate">{commit.message}</div>
                                <span className="text-muted" style={{ fontSize: '11px' }}>by {commit.author}</span>
                              </div>
                              <Badge bg="secondary-subtle" className="text-secondary-emphasis" style={{ fontSize: '10px' }}>{commit.sha}</Badge>
                            </ListGroup.Item>
                          ))
                        )}
                      </ListGroup>
                    )}
                  </div>
                ) : (
                  <div>
                    <Form onSubmit={handleConnectRepo} className="d-flex gap-2">
                      <Form.Control
                        type="url"
                        placeholder="Paste repository link, e.g. https://github.com/user/project"
                        value={repositoryUrl}
                        onChange={(e) => setRepositoryUrl(e.target.value)}
                        required
                      />
                      <Button type="submit" variant="primary" disabled={repoLoading}>
                        {repoLoading ? <Spinner size="sm" /> : 'Connect'}
                      </Button>
                    </Form>
                    {repoError && (
                      <div className="alert alert-danger py-2 px-3 mt-3 mb-0 small" role="alert">
                        {repoError}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <div className="text-center py-5 text-muted glass-card">Select a project to inspect files and configurations.</div>
          )}
        </Col>
      </Row>

      {/* Modal: Create Project */}
      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered size="lg">
        <Form onSubmit={handleCreateProject}>
          <Modal.Header closeButton className="border-0">
            <Modal.Title className="font-display fw-bold">Bootstrap Research Workspace</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3" controlId="projName">
              <Form.Label className="small fw-semibold">Project Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. Deep Genomic Alignment Tool"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="projDesc">
              <Form.Label className="small fw-semibold">Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="State the scientific problem, code pipeline, or methodology objectives..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </Form.Group>

            <Row className="mb-3">
              <Col md={6}>
                <Form.Group controlId="projDomain">
                  <Form.Label className="small fw-semibold">Academic Domain</Form.Label>
                  <Form.Select value={domain} onChange={(e) => setDomain(e.target.value)}>
                    <option value="Bioinformatics">Bioinformatics</option>
                    <option value="Machine Learning">Machine Learning</option>
                    <option value="Astrophysics">Astrophysics</option>
                    <option value="Climate Modeling">Climate Modeling</option>
                    <option value="Computational Chemistry">Computational Chemistry</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="projDeadline">
                  <Form.Label className="small fw-semibold">Target Publication Deadline</Form.Label>
                  <Form.Control
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">Research Objectives</Form.Label>
              <div className="d-flex gap-2 mb-2">
                <Form.Control
                  type="text"
                  placeholder="e.g. Parallelize genomic alignment calculations"
                  value={objectiveInput}
                  onChange={(e) => setObjectiveInput(e.target.value)}
                />
                <Button type="button" variant="outline-primary" onClick={handleAddObjective}>
                  Add
                </Button>
              </div>
              <div className="d-flex flex-wrap gap-1.5">
                {objectives.map((obj, idx) => (
                  <Badge key={idx} bg="primary-subtle" className="text-primary-emphasis d-flex align-items-center gap-1.5 p-2" style={{ fontSize: '11px' }}>
                    <span>{obj}</span>
                    <Trash2 size={12} className="cursor-pointer text-danger" onClick={() => handleRemoveObjective(idx)} />
                  </Badge>
                ))}
              </div>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-0">
            <Button variant="outline-secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" className="btn-glow-primary">Initialize Workspace</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal: Invite Collaborator */}
      <Modal show={showInvite} onHide={() => setShowInvite(false)} centered>
        <Form onSubmit={handleInviteMember}>
          <Modal.Header closeButton className="border-0">
            <Modal.Title className="font-display fw-bold">Invite Collaborator</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group controlId="inviteEmail">
              <Form.Label className="small fw-semibold">Collaborator Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="e.g. peer_reviewer@university.edu"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-0">
            <Button variant="outline-secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={inviteLoading}>
              {inviteLoading ? <Spinner size="sm" /> : 'Send Invitation'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
