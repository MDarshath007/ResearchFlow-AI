import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { projectAPI, analyticsAPI } from '../services/api';
import { BarChart3, Trophy, CheckSquare, Sparkles, FolderGit } from 'lucide-react';
import { Container, Row, Col, Card, Form, Table, Spinner, Badge } from 'react-bootstrap';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function AnalyticsPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [platformStats, setPlatformStats] = useState(null);

  const location = useLocation();

  const fetchAnalyticsData = async (project) => {
    if (!project) return;
    try {
      const res = await analyticsAPI.getProject(project._id);
      if (res.data.success) {
        setAnalytics(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const initData = async () => {
      try {
        const projRes = await projectAPI.getAll();
        if (projRes.data.success) {
          setProjects(projRes.data.data);
          
          const queryParams = new URLSearchParams(location.search);
          const urlId = queryParams.get('id');
          let matched = null;

          if (urlId) {
            matched = projRes.data.data.find(p => p._id === urlId);
          }
          
          if (!matched && projRes.data.data.length > 0) {
            matched = projRes.data.data[0];
          }

          if (matched) {
            setSelectedProject(matched);
            await fetchAnalyticsData(matched);
          }
        }

        // Fetch leaderboard & platform statistics
        const leadRes = await analyticsAPI.getLeaderboard();
        if (leadRes.data.success) {
          setLeaderboard(leadRes.data.data.leaderboard);
          setPlatformStats(leadRes.data.data.platformStats);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [location.search]);

  const handleSelectProject = async (p) => {
    setSelectedProject(p);
    await fetchAnalyticsData(p);
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  // 1. Task progress Doughnut config
  const taskProgressData = analytics ? {
    labels: ['Todo', 'In Progress', 'Review', 'Completed'],
    datasets: [
      {
        data: [
          analytics.taskStats.todo,
          analytics.taskStats.inProgress,
          analytics.taskStats.review,
          analytics.taskStats.completed,
        ],
        backgroundColor: [
          'rgba(245, 158, 11, 0.65)',  // amber
          'rgba(99, 102, 241, 0.65)',  // indigo
          'rgba(59, 130, 246, 0.65)',  // blue
          'rgba(16, 185, 129, 0.65)',  // emerald
        ],
        borderColor: [
          'rgba(245, 158, 11, 1)',
          'rgba(99, 102, 241, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
        ],
        borderWidth: 1.5,
      }
    ]
  } : null;

  // 2. Productivity Bar config
  const productivityData = analytics ? {
    labels: analytics.productivityData.map(d => d.name),
    datasets: [
      {
        label: 'Tasks Completed',
        data: analytics.productivityData.map(d => d.completed),
        backgroundColor: 'rgba(99, 102, 241, 0.6)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 1,
      }
    ]
  } : null;

  // 3. Weekly Commits Line config (real GitHub commit activity)
  const commitData = analytics && Array.isArray(analytics.commitStats) && analytics.commitStats.length > 0 ? {
    labels: analytics.commitStats.map(d => d.week),
    datasets: [
      {
        label: 'Commits',
        data: analytics.commitStats.map(d => d.commits),
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.3,
      }
    ]
  } : null;

  // 4. Quality score historical Trends Line config
  const historyData = analytics ? {
    labels: analytics.scoreHistory.map(d => d.date),
    datasets: [
      {
        label: 'Overall Grade',
        data: analytics.scoreHistory.map(d => d.overall),
        borderColor: 'rgba(99, 102, 241, 1)',
        backgroundColor: 'rgba(99, 102, 241, 0)',
        tension: 0.1,
      },
      {
        label: 'Testing',
        data: analytics.scoreHistory.map(d => d.testing),
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0)',
        tension: 0.1,
      },
      {
        label: 'Documentation',
        data: analytics.scoreHistory.map(d => d.documentation),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0)',
        tension: 0.1,
      }
    ]
  } : null;

  return (
    <div className="fade-in-slide p-4 workspace-page analytics-page">
      {/* Header */}
      <div className="page-heading d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display fw-bold mb-1">Analytics Cockpit</h2>
          <p className="text-muted small mb-0">Monitor sprint progress ratios, test history lines, and contributor scores</p>
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

      {selectedProject && analytics ? (
        <>
          {/* Charts Row 1 */}
          <Row className="g-4 mb-4">
            <Col lg={4}>
              <Card className="glass-card border-0 p-4 shadow-sm h-100">
                <h5 className="font-display fw-bold mb-3 d-flex align-items-center gap-2">
                  <CheckSquare size={18} className="text-primary" />
                  <span>Task Progress</span>
                </h5>
                <div style={{ height: '220px', position: 'relative' }} className="d-flex justify-content-center">
                  {taskProgressData && (
                    <Doughnut 
                      data={taskProgressData} 
                      options={{
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } }
                      }} 
                    />
                  )}
                </div>
              </Card>
            </Col>

            <Col lg={4}>
              <Card className="glass-card border-0 p-4 shadow-sm h-100">
                <h5 className="font-display fw-bold mb-3 d-flex align-items-center gap-2">
                  <Trophy size={18} className="text-primary" />
                  <span>Team Productivity</span>
                </h5>
                <div style={{ height: '220px', position: 'relative' }}>
                  {productivityData && (
                    <Bar 
                      data={productivityData} 
                      options={{
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
                      }} 
                    />
                  )}
                </div>
              </Card>
            </Col>

            <Col lg={4}>
              <Card className="glass-card border-0 p-4 shadow-sm h-100">
                <h5 className="font-display fw-bold mb-3 d-flex align-items-center gap-2">
                  <FolderGit size={18} className="text-primary" />
                  <span>Commit Frequency</span>
                </h5>
                <div style={{ height: '220px', position: 'relative' }}>
                  {commitData ? (
                    <Line 
                      data={commitData} 
                      options={{
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true } }
                      }} 
                    />
                  ) : (
                    <div className="h-100 d-flex align-items-center justify-content-center text-muted text-center small">
                      No commit activity available.<br />Connect a public GitHub repository to see commit frequency.
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          </Row>

          {/* Charts Row 2: Quality Trend Lines */}
          <Row className="g-4 mb-4">
            <Col lg={12}>
              <Card className="glass-card border-0 p-4 shadow-sm">
                <h5 className="font-display fw-bold mb-3 d-flex align-items-center gap-2">
                  <BarChart3 size={18} className="text-primary" />
                  <span>Readiness Grade Tracking Trends</span>
                </h5>
                <div style={{ height: '280px', position: 'relative' }}>
                  {historyData && (
                    <Line 
                      data={historyData} 
                      options={{
                        maintainAspectRatio: false,
                        scales: { y: { min: 0, max: 100 } }
                      }} 
                    />
                  )}
                </div>
              </Card>
            </Col>
          </Row>
        </>
      ) : (
        <div className="text-center py-5 text-muted glass-card mb-4">Initialize code scans to generate analytics charts.</div>
      )}

      {/* Leaderboard Row */}
      <Row className="g-4">
        <Col lg={12}>
          <Card className="glass-card border-0 p-4 shadow-sm">
            <h4 className="font-display fw-bold mb-3 d-flex align-items-center gap-2">
              <Trophy className="text-warning animate-bounce" />
              <span>Research Software Engineering (RSE) Leaderboard</span>
            </h4>
            <p className="text-muted small mb-4">
              Compare project achievements across active scholar teams. Scores are calculated by evaluating documentation depth, unit test presence, Docker completeness, and version configurations.
            </p>

            <Table responsive hover className="align-middle mb-0">
              <thead>
                <tr className="text-muted small border-bottom">
                  <th>Rank</th>
                  <th>Project Workspace Name</th>
                  <th>Principal Researcher</th>
                  <th>Academic Domain</th>
                  <th>Tasks Completed</th>
                  <th>Maturity Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={row.rank}>
                    <td>
                      {row.rank === 1 ? '🥇 1' : row.rank === 2 ? '🥈 2' : row.rank === 3 ? '🥉 3' : row.rank}
                    </td>
                    <td><div className="fw-semibold">{row.projectName}</div></td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <img src={row.ownerAvatar} alt="Avatar" className="rounded-circle border" style={{ width: '28px', height: '28px', objectFit: 'cover' }} />
                        <span className="small">{row.owner}</span>
                      </div>
                    </td>
                    <td><span className="badge bg-secondary-subtle text-secondary-emphasis">{row.domain}</span></td>
                    <td><span className="small fw-semibold">{row.completedTasks} Tasks</span></td>
                    <td>
                      <Badge bg={
                        row.maturityLevel === 'Platinum' ? 'info' :
                        row.maturityLevel === 'Gold' ? 'warning' : 'secondary'
                      } className="px-2.5 py-1.5 font-display fw-bold">
                        {row.maturityLevel} ({row.maturityScore}%)
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
