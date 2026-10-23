import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { projectAPI, collaborationAPI } from '../services/api';
import MaturityBadge from '../components/MaturityBadge';
import { FolderKanban, ShieldCheck, Clock, UserPlus, FileCode, CheckSquare, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Row, Col, Card, Button, Spinner, Table, ListGroup, ProgressBar, Alert } from 'react-bootstrap';

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const projRes = await projectAPI.getAll();
      if (projRes.data.success) {
        setProjects(projRes.data.data);
        
        // Get activities from the first project if projects exist
        if (projRes.data.data.length > 0) {
          const actRes = await collaborationAPI.getActivity(projRes.data.data[0]._id);
          if (actRes.data.success) {
            setActivities(actRes.data.data);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard metrics. Please verify the backend API server is operational.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Intentional one-time data fetch on mount (loading spinner covers the async gap).
    // oxlint-disable-next-line react/set-state-in-effect
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  // Calculate global platform metrics
  const activeCount = projects.filter(p => p.status === 'Active').length;
  const completedCount = projects.filter(p => p.status === 'Completed').length;
  const avgMaturity = projects.length > 0 
    ? Math.round(projects.reduce((acc, p) => acc + (p.maturityScore || 0), 0) / projects.length) 
    : 0;

  return (
    <div className="fade-in-slide p-4 workspace-page dashboard-page">
      {/* Greetings */}
      <div className="page-heading d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="font-display fw-bold mb-1">Welcome back, {user?.username}!</h2>
          <p className="text-muted small">Here is your RSE status and project health summaries</p>
        </div>
        <Button as={Link} to="/projects" className="btn-glow-primary d-flex align-items-center gap-2">
          <Plus size={18} />
          <span>New Project</span>
        </Button>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)} className="d-flex align-items-center justify-content-between mb-4">
          <div><strong>Connection Notice:</strong> {error}</div>
          <Button variant="outline-danger" size="sm" onClick={fetchDashboardData}>Retry</Button>
        </Alert>
      )}

      {/* Metrics Row */}
      <Row className="metric-grid g-3 mb-4">
        <Col md={3}>
          <Card className="glass-card stat-card border-0 p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-semibold">Total Projects</span>
              <FolderKanban className="text-primary" size={20} />
            </div>
            <h3 className="fw-bold font-display">{projects.length}</h3>
            <span className="text-muted small">{activeCount} active development runs</span>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="glass-card stat-card border-0 p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-semibold">Average Quality Score</span>
              <ShieldCheck className="text-success" size={20} />
            </div>
            <h3 className="fw-bold font-display">{avgMaturity}%</h3>
            <div className="w-100 mt-2">
              <ProgressBar now={avgMaturity} variant={avgMaturity > 70 ? 'success' : 'warning'} style={{ height: '6px' }} />
            </div>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="glass-card stat-card border-0 p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-semibold">Completed Runs</span>
              <CheckSquare className="text-info" size={20} />
            </div>
            <h3 className="fw-bold font-display">{completedCount}</h3>
            <span className="text-muted small">Archived and published research</span>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="glass-card stat-card border-0 p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-semibold">System Role</span>
              <UserPlus className="text-warning" size={20} />
            </div>
            <h3 className="fw-bold font-display" style={{ fontSize: '20px', paddingTop: '4px' }}>{user?.role}</h3>
            <span className="text-muted small">Access level configurations</span>
          </Card>
        </Col>
      </Row>

      {/* Main Grid */}
      <Row className="g-4">
        {/* Projects List */}
        <Col lg={8}>
          <Card className="glass-card border-0 p-4 h-100 shadow-sm">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 className="font-display fw-bold mb-0">Active Research Workspaces</h4>
              <Link to="/projects" className="small text-primary text-decoration-none fw-semibold">View All</Link>
            </div>

            {projects.length === 0 ? (
              <div className="text-center text-muted py-5 border rounded-3 border-dashed">
                <FileCode size={40} className="mb-2 text-secondary" />
                <div>No active research projects found. Create one to begin assessments.</div>
              </div>
            ) : (
              <Table responsive hover className="align-middle mb-0">
                <thead>
                  <tr className="text-muted small border-bottom">
                    <th>Project Name</th>
                    <th>Domain</th>
                    <th>Readiness Level</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <div className="fw-semibold">{p.name}</div>
                        <div className="text-muted small text-truncate" style={{ maxWidth: '200px' }}>{p.description}</div>
                      </td>
                      <td><span className="badge bg-secondary-subtle text-secondary-emphasis">{p.domain}</span></td>
                      <td>
                        <MaturityBadge score={p.maturityScore} />
                      </td>
                      <td>
                        <span className={`badge ${
                          p.status === 'Completed' ? 'bg-success' :
                          p.status === 'Active' ? 'bg-primary' : 'bg-warning'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <Button as={Link} to={`/projects?id=${p._id}`} size="sm" variant="outline-primary">
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </Col>

        {/* Recent Activities */}
        <Col lg={4}>
          <Card className="glass-card border-0 p-4 h-100 shadow-sm">
            <h4 className="font-display fw-bold mb-3 d-flex align-items-center gap-2">
              <Clock size={20} className="text-primary" />
              <span>Workspace Timeline</span>
            </h4>

            {activities.length === 0 ? (
              <div className="text-center text-muted py-5">
                No recent workspace activities. Upload notebooks or run codebase checks.
              </div>
            ) : (
              <ListGroup variant="flush" className="overflow-y-auto" style={{ maxHeight: '350px' }}>
                {activities.map((act) => (
                  <ListGroup.Item key={act.id} className="px-0 py-3 border-bottom bg-transparent">
                    <div className="d-flex justify-content-between align-items-start mb-1">
                      <div className="fw-semibold small">{act.title}</div>
                      <span className="text-muted small" style={{ fontSize: '10px' }}>
                        {new Date(act.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="text-muted small text-truncate">{act.description}</div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
