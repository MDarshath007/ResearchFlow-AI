import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { projectAPI, assessmentAPI, aiAPI, reproducibilityAPI } from '../services/api';
import MaturityBadge from '../components/MaturityBadge';
import { 
  ShieldCheck, FileCode, CheckSquare, Upload, HelpCircle, 
  Terminal, Sparkles, Download, FileText, ChevronRight, AlertTriangle, RefreshCw 
} from 'lucide-react';
import { Container, Row, Col, Card, Button, Form, Spinner, Alert, Tabs, Tab, ProgressBar, Badge } from 'react-bootstrap';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Radar, Bar } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

export default function AssessmentReports() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanLoading, setScanLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('assessment');

  // Reports data
  const [assessmentReport, setAssessmentReport] = useState(null);
  const [reproReport, setReproReport] = useState(null);

  // Uploader states
  const [codebaseFile, setCodebaseFile] = useState(null);
  const [reproFiles, setReproFiles] = useState([]);

  // AI Doc Generator states
  const [docType, setDocType] = useState('readme');
  const [docText, setDocText] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [docSource, setDocSource] = useState(null); // 'gemini' | 'local-fallback'
  const [docFallbackReason, setDocFallbackReason] = useState(null);
  const [docError, setDocError] = useState(null);

  const location = useLocation();

  const fetchReportsData = async (project) => {
    if (!project) return;
    try {
      // Fetch assessment reports
      const assessRes = await assessmentAPI.getByProject(project._id);
      if (assessRes.data.success && assessRes.data.data.length > 0) {
        setAssessmentReport(assessRes.data.data[0]); // latest report
      } else {
        setAssessmentReport(null);
      }

      // Fetch reproducibility reports
      const reproRes = await reproducibilityAPI.getByProject(project._id);
      if (reproRes.data.success && reproRes.data.data.length > 0) {
        setReproReport(reproRes.data.data[0]); // latest report
      } else {
        setReproReport(null);
      }
    } catch (err) {
      console.error(err);
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
          let matched = null;

          if (urlId) {
            matched = res.data.data.find(p => p._id === urlId);
          }
          
          if (!matched && res.data.data.length > 0) {
            matched = res.data.data[0];
          }

          if (matched) {
            setSelectedProject(matched);
            await fetchReportsData(matched);
          }
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
    await fetchReportsData(p);
  };

  // Assessment scan trigger
  const handleScanCodebase = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;

    setScanLoading(true);
    try {
      let res;
      if (codebaseFile) {
        const formData = new FormData();
        formData.append('codebase', codebaseFile);
        res = await assessmentAPI.scan(selectedProject._id, formData);
      } else {
        res = await assessmentAPI.scanSimulated(selectedProject._id);
      }

      if (res.data.success) {
        setCodebaseFile(null);
        setAssessmentReport(res.data.data);
        // Refresh selected project details (maturity score)
        const updatedProj = { ...selectedProject, maturityScore: res.data.project.maturityScore, maturityLevel: res.data.project.maturityLevel };
        setSelectedProject(updatedProj);
        setProjects(prev => prev.map(p => p._id === selectedProject._id ? updatedProj : p));
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Scanning failed. Make sure ZIP file format is valid.');
    } finally {
      setScanLoading(false);
    }
  };

  // AI documentation generation
  const handleGenerateAI = async () => {
    if (!selectedProject) return;
    setDocLoading(true);
    setDocText('');
    setDocSource(null);
    setDocFallbackReason(null);
    setDocError(null);
    try {
      const res = await aiAPI.generateDoc(selectedProject._id, { docType });
      if (res.data.success) {
        setDocText(res.data.data);
        setDocSource(res.data.source || null);
        setDocFallbackReason(res.data.fallbackReason || null);
      }
    } catch (err) {
      console.error(err);
      setDocError(err.response?.data?.message || 'Document generation failed. Please try again.');
    } finally {
      setDocLoading(false);
    }
  };

  const handleDownloadDoc = () => {
    if (!docText) return;
    const blob = new Blob([docText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedProject.name.replace(/\s+/g, '_')}_${docType}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    if (!docText) return;
    try {
      const title = `${selectedProject.name} - ${docType.toUpperCase()}`;
      const res = await aiAPI.exportPdf({ title, content: docText });
      
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedProject.name.replace(/\s+/g, '_')}_${docType}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  // Reproducibility validation trigger
  const handleReproducibilityCheck = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;

    setScanLoading(true);
    try {
      let res;
      if (reproFiles.length > 0) {
        const formData = new FormData();
        Array.from(reproFiles).forEach(file => {
          formData.append('files', file);
        });
        res = await reproducibilityAPI.check(selectedProject._id, formData);
      } else {
        res = await reproducibilityAPI.checkSimulated(selectedProject._id);
      }

      if (res.data.success) {
        setReproFiles([]);
        setReproReport(res.data.data);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Reproducibility audit failed. Select valid project files and try again.');
    } finally {
      setScanLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  // Quality assessment chart mapping
  const chartData = {
    labels: ['Documentation', 'Testing', 'Git Versioning', 'Collaboration'],
    datasets: [
      {
        label: 'Quality Score (%)',
        data: assessmentReport
          ? [
              assessmentReport.documentationScore,
              assessmentReport.testingScore,
              assessmentReport.gitScore,
              assessmentReport.collaborationScore,
            ]
          : [0, 0, 0, 0],
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
      },
    ],
  };

  return (
    <div className="fade-in-slide p-4 workspace-page assessment-page">
      {/* Target Project Selection */}
      <div className="page-heading d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display fw-bold mb-1">Software Readiness Assessment</h2>
          <p className="text-muted small mb-0">Inspect repository layouts and dependency conflicts using RSE criteria</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted small">Active Project:</span>
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
          {/* TAB 1: SE Quality Assessment */}
          <Tab eventKey="assessment" title="Quality Assessment">
            <Row className="g-4">
              {/* Scan setup and parameters */}
              <Col lg={5}>
                <Card className="glass-card border-0 p-4 h-100 shadow-sm">
                  <h4 className="font-display fw-bold mb-3 d-flex align-items-center gap-2">
                    <ShieldCheck className="text-primary" />
                    <span>Trigger Codebase Scan</span>
                  </h4>
                  <p className="text-muted small">
                    Run an automated RSE readiness sweep. With no ZIP uploaded, the assessment analyses your connected GitHub repository. Upload a ZIP file containing the project source folder structure to perform an actual parse.
                  </p>

                  <Form onSubmit={handleScanCodebase} className="mt-4 border-top pt-4">
                    <Form.Group className="mb-4" controlId="codebaseZip">
                      <Form.Label className="small fw-semibold">Upload Codebase ZIP (Optional)</Form.Label>
                      <Form.Control 
                        type="file" 
                        accept=".zip"
                        onChange={(e) => setCodebaseFile(e.target.files[0])}
                      />
                      <Form.Text className="text-muted small">Only standard .zip archives supported.</Form.Text>
                    </Form.Group>

                    <Button type="submit" className="w-100 btn-glow-primary py-2 fw-semibold d-flex align-items-center justify-content-center gap-2" disabled={scanLoading}>
                      {scanLoading ? <Spinner size="sm" /> : <RefreshCw size={16} />}
                      <span>{codebaseFile ? 'Scan Zipped Directory' : 'Analyze Repository'}</span>
                    </Button>
                  </Form>
                </Card>
              </Col>

              {/* Assessment Scan Results visualization */}
              <Col lg={7}>
                <Card className="glass-card border-0 p-4 h-100 shadow-sm">
                  <h4 className="font-display fw-bold mb-3">Assessment Metrics Overview</h4>
                  {assessmentReport ? (
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-4">
                        <div>
                          <div className="fw-semibold">Overall Software Quality Score</div>
                          <h2 className="display-5 font-display fw-bold text-primary mb-0">{assessmentReport.overallScore}%</h2>
                        </div>
                        <MaturityBadge score={assessmentReport.overallScore} />
                      </div>

                      <Row className="align-items-center">
                        <Col md={6}>
                          <div style={{ height: '240px', position: 'relative' }}>
                            <Radar 
                              data={chartData} 
                              options={{
                                scales: {
                                  r: {
                                    angleLines: { display: true },
                                    suggestedMin: 0,
                                    suggestedMax: 100
                                  }
                                },
                                plugins: { legend: { display: false } },
                                maintainAspectRatio: false
                              }} 
                            />
                          </div>
                        </Col>
                        <Col md={6}>
                          <div className="fw-semibold small text-muted mb-2">Scan Details:</div>
                          <ul className="ps-3 mb-0 text-muted small" style={{ listStyleType: 'circle' }}>
                            <li className="mb-1.5">README Found: <strong>{assessmentReport.details?.readmeFound ? 'Yes' : 'No'}</strong></li>
                            <li className="mb-1.5">API Documentation: <strong>{assessmentReport.details?.apiDocsFound ? 'Yes' : 'No'}</strong></li>
                            <li className="mb-1.5">Installation Guides: <strong>{assessmentReport.details?.installGuideFound ? 'Yes' : 'No'}</strong></li>
                            <li className="mb-1.5">Test Suite files count: <strong>{assessmentReport.details?.testFilesCount}</strong></li>
                            <li className="mb-1.5">Test Runner detected: <strong>{assessmentReport.details?.testFrameworkDetected}</strong></li>
                            <li className="mb-1.5">Version Control detected: <strong>{assessmentReport.details?.gitRepoDetected ? 'Yes' : 'No'}</strong></li>
                          </ul>
                        </Col>
                      </Row>

                      {/* Evidence-based findings */}
                      {assessmentReport.details?.unmeasurable?.length > 0 && (
                        <div className="alert alert-warning py-2 px-3 small mt-3 mb-0" role="alert">
                          <strong>Not measured:</strong>{' '}
                          {assessmentReport.details.unmeasurable.map((u) => `${u.category} — ${u.reason}`).join(' · ')}
                        </div>
                      )}

                      {assessmentReport.details?.strengths?.length > 0 && (
                        <div className="mt-3">
                          <div className="fw-semibold small text-success mb-1">Strengths</div>
                          <ul className="ps-3 mb-0 text-muted small" style={{ listStyleType: 'circle' }}>
                            {assessmentReport.details.strengths.map((s, i) => (
                              <li key={`s-${i}`} className="mb-1">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {assessmentReport.details?.weaknesses?.length > 0 && (
                        <div className="mt-3">
                          <div className="fw-semibold small text-danger mb-1">Weaknesses</div>
                          <ul className="ps-3 mb-0 text-muted small" style={{ listStyleType: 'circle' }}>
                            {assessmentReport.details.weaknesses.map((w, i) => (
                              <li key={`w-${i}`} className="mb-1">{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {assessmentReport.details?.recommendations?.length > 0 && (
                        <div className="mt-3">
                          <div className="fw-semibold small text-primary mb-1">Recommendations</div>
                          <ul className="ps-3 mb-0 text-muted small" style={{ listStyleType: 'circle' }}>
                            {assessmentReport.details.recommendations.map((r, i) => (
                              <li key={`r-${i}`} className="mb-1">{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-5 text-muted">No assessment reports found. Trigger a scan above to calculate quality scores.</div>
                  )}
                </Card>
              </Col>
            </Row>
          </Tab>

          {/* TAB 2: AI Doc Generator */}
          <Tab eventKey="docs" title="AI Doc Generator">
            <Card className="glass-card border-0 p-4 shadow-sm mb-4">
              <Row className="g-4">
                <Col lg={4}>
                  <h4 className="font-display fw-bold mb-3 d-flex align-items-center gap-2">
                    <Sparkles className="text-primary" />
                    <span>Gemini AI Generator</span>
                  </h4>
                  <p className="text-muted small">
                    Use Gemini LLMs to write RSE compliant documentation matching your project goals and active domain.
                  </p>

                  <Form.Group className="mb-4" controlId="docSelectType">
                    <Form.Label className="small fw-semibold">Document Target Type</Form.Label>
                    <Form.Select value={docType} onChange={(e) => setDocType(e.target.value)}>
                      <option value="readme">README.md</option>
                      <option value="install">Installation Guide</option>
                      <option value="api">API Reference Guide</option>
                      <option value="structure">Folder Structure Explanations</option>
                    </Form.Select>
                  </Form.Group>

                  <Button className="w-100 btn-glow-primary py-2 fw-semibold d-flex align-items-center justify-content-center gap-2" onClick={handleGenerateAI} disabled={docLoading}>
                    {docLoading ? <Spinner size="sm" /> : <Sparkles size={16} />}
                    <span>Generate Document</span>
                  </Button>
                </Col>

                <Col lg={8}>
                  {docError && (
                    <Alert variant="danger" className="py-2 small mb-3">
                      {docError}
                    </Alert>
                  )}
                  {docSource === 'local-fallback' && docText && (
                    <Alert variant="warning" className="py-2 small mb-3">
                      Generated from local templates — Gemini unavailable{docFallbackReason ? ` (${docFallbackReason})` : ''}. This document was not written by Gemini.
                    </Alert>
                  )}
                  {docLoading ? (
                    <div className="d-flex flex-column align-items-center justify-content-center border rounded-3 p-5" style={{ minHeight: '300px' }}>
                      <Spinner animation="grow" variant="primary" />
                      <div className="mt-3 text-muted small">Drafting technical documentation with Gemini...</div>
                    </div>
                  ) : docText ? (
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <div className="fw-semibold">Generated Output ({docType.toUpperCase()})</div>
                        <div className="d-flex gap-2">
                          <Button size="sm" variant="outline-primary" className="d-flex align-items-center gap-1.5" onClick={handleDownloadDoc}>
                            <Download size={14} />
                            <span>Download MD</span>
                          </Button>
                          <Button size="sm" variant="outline-primary" className="d-flex align-items-center gap-1.5" onClick={handleExportPDF}>
                            <FileText size={14} />
                            <span>Export PDF</span>
                          </Button>
                        </div>
                      </div>
                      <Form.Control
                        as="textarea"
                        rows={12}
                        readOnly
                        value={docText}
                        className="font-monospace text-body"
                        style={{ fontSize: '13px', background: 'var(--bs-body-bg)' }}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-5 text-muted border rounded-3 border-dashed" style={{ minHeight: '300px' }}>
                      Click "Generate Document" to create custom structured guides.
                    </div>
                  )}
                </Col>
              </Row>
            </Card>
          </Tab>

          {/* TAB 3: Reproducibility Checker */}
          <Tab eventKey="repro" title="Reproducibility Audit">
            <Row className="g-4">
              <Col lg={5}>
                <Card className="glass-card border-0 p-4 shadow-sm h-100">
                  <h4 className="font-display fw-bold mb-3 d-flex align-items-center gap-2">
                    <Terminal className="text-primary" />
                    <span>Check Environment Configs</span>
                  </h4>
                  <p className="text-muted small">
                    Audit files like <code>requirements.txt</code>, <code>package.json</code>, <code>Dockerfile</code>, or <code>.env</code> configurations to detect unpinned dependencies, credential leakage, or missing runtime packaging. Uploaded Jupyter <code>.ipynb</code> notebooks are analysed for cell order, saved outputs, randomness seeding, and declared imports.
                  </p>

                  <Form onSubmit={handleReproducibilityCheck} className="mt-4 border-top pt-4">
                    <Form.Group className="mb-4" controlId="reproFilesInput">
                      <Form.Label className="small fw-semibold">Select Configuration Files (Optional)</Form.Label>
                      <Form.Control 
                        type="file" 
                        multiple
                        onChange={(e) => setReproFiles(e.target.files)}
                      />
                      <Form.Text className="text-muted small">Select multiple files together (requirements.txt, Dockerfile, .env, or .ipynb notebooks).</Form.Text>
                    </Form.Group>

                    <Button type="submit" className="w-100 btn-glow-primary py-2 fw-semibold d-flex align-items-center justify-content-center gap-2" disabled={scanLoading}>
                      {scanLoading ? <Spinner size="sm" /> : <Terminal size={16} />}
                      <span>{reproFiles.length > 0 ? 'Run File Audit' : 'Run Reproducibility Audit'}</span>
                    </Button>
                  </Form>
                </Card>
              </Col>

              <Col lg={7}>
                <Card className="glass-card border-0 p-4 shadow-sm h-100">
                  <h4 className="font-display fw-bold mb-3">Reproducibility Report</h4>
                  {reproReport ? (
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <div>
                          <div className="fw-semibold">Reproducibility Score</div>
                          <h2 className="display-6 font-display fw-bold text-primary mb-0">{reproReport.overallScore}/100</h2>
                        </div>
                        <Badge bg={reproReport.reproducibilityReport?.readinessRating === 'High' ? 'success' : 
                                  reproReport.reproducibilityReport?.readinessRating === 'Medium' ? 'warning' : 'danger'} className="px-3 py-2">
                          {reproReport.reproducibilityReport?.readinessRating} Readiness
                        </Badge>
                      </div>

                      {/* File Audited indicators */}
                      <div className="d-flex gap-2.5 flex-wrap mb-4">
                        <span className={`badge ${reproReport.reproducibilityReport?.dockerFilePresent ? 'bg-success' : 'bg-danger-subtle text-danger-emphasis border'}`}>
                          {reproReport.reproducibilityReport?.dockerFilePresent ? '✓ Dockerfile Present' : '✗ Dockerfile Missing'}
                        </span>
                        <span className={`badge ${reproReport.reproducibilityReport?.requirementsTxtPresent || reproReport.reproducibilityReport?.packageJsonPresent ? 'bg-success' : 'bg-danger-subtle text-danger-emphasis border'}`}>
                          {reproReport.reproducibilityReport?.requirementsTxtPresent ? '✓ requirements.txt Present' : 
                           reproReport.reproducibilityReport?.packageJsonPresent ? '✓ package.json Present' : '✗ Dependency manifest missing'}
                        </span>
                        <span className={`badge ${reproReport.reproducibilityReport?.envExamplePresent ? 'bg-success' : 'bg-warning-subtle text-warning-emphasis border'}`}>
                          {reproReport.reproducibilityReport?.envExamplePresent ? '✓ .env config Present' : '⚠ .env configs Missing'}
                        </span>
                      </div>

                      {/* Checks performed (deterministic evidence) */}
                      {reproReport.reproducibilityReport?.checks?.length > 0 && (
                        <div className="mt-3">
                          <div className="fw-semibold small text-muted mb-2">
                            Checks performed ({reproReport.reproducibilityReport.checks.length}) · {' '}
                            <span className="text-success">{reproReport.reproducibilityReport.passedChecks?.length || 0} passed</span>
                            {' · '}
                            <span className="text-danger">{reproReport.reproducibilityReport.failedChecks?.length || 0} failed</span>
                          </div>
                          <div className="d-flex flex-column gap-1.5">
                            {reproReport.reproducibilityReport.checks.map((check, idx) => (
                              <div
                                key={idx}
                                className={`d-flex align-items-start gap-2 small border rounded px-2.5 py-1.5 ${
                                  check.status === 'passed' ? 'border-success-subtle' :
                                  check.status === 'failed' ? 'border-danger-subtle' :
                                  check.status === 'warning' ? 'border-warning-subtle' : 'border-light'
                                }`}
                              >
                                <span className={check.status === 'passed' ? 'text-success' :
                                  check.status === 'failed' ? 'text-danger' :
                                  check.status === 'warning' ? 'text-warning' : 'text-muted'}>
                                  {check.status === 'passed' ? '✓' : check.status === 'failed' ? '✗' : check.status === 'warning' ? '⚠' : '○'}
                                </span>
                                <span className="text-muted">
                                  <strong className="text-body">{check.label}</strong> — {check.detail}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notebook analysis (.ipynb JSON inspection) */}
                      {reproReport.reproducibilityReport?.notebooks?.length > 0 && (
                        <div className="mt-4">
                          <div className="fw-semibold small text-muted mb-2">
                            Notebook analysis ({reproReport.reproducibilityReport.notebooks.length})
                          </div>
                          {reproReport.reproducibilityReport.notebooks.map((nb, idx) => (
                            <div key={idx} className="border rounded p-3 mb-2 small">
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="fw-semibold text-truncate me-2">{nb.file}</span>
                                <Badge bg={nb.valid ? 'success' : 'danger'} className="flex-shrink-0">
                                  {nb.valid ? `Valid nbformat ${nb.nbformat}` : 'Malformed'}
                                </Badge>
                              </div>
                              {nb.valid ? (
                                <ul className="mb-0 text-muted ps-3" style={{ listStyleType: 'circle' }}>
                                  <li className="mb-1">Cells: {nb.cells.total} ({nb.cells.code} code, {nb.cells.markdown} markdown)</li>
                                  <li className="mb-1">Executed: {nb.cells.executed}/{nb.cells.code} code cells · missing outputs: {nb.cells.missingOutputs}</li>
                                  <li className="mb-1">
                                    Execution order: {nb.execution.outOfOrder
                                      ? `out of order${nb.execution.duplicateCounts?.length ? ` (re-run counts: ${nb.execution.duplicateCounts.join(', ')})` : ''}`
                                      : nb.execution.counts.length > 0 ? 'top-to-bottom (strictly increasing)' : 'no executed cells'}
                                    {nb.execution.gaps > 0 && ` · ${nb.execution.gaps} gap(s)`}
                                  </li>
                                  <li className="mb-1">Cells depending on earlier state: {nb.cells.stateDependent}</li>
                                  <li className="mb-1">
                                    Randomness: {nb.randomness.used ? nb.randomness.sources.join(', ') : 'none detected'}
                                    {' · seed: '}
                                    <strong className={!nb.randomness.seedSet && nb.randomness.used ? 'text-danger' : 'text-success'}>
                                      {nb.randomness.seedSet ? `set (${nb.randomness.seedEvidence?.[0] || 'detected'})` : nb.randomness.used ? 'not set' : 'n/a'}
                                    </strong>
                                  </li>
                                  <li className="mb-1">
                                    Imports: {nb.imports.modules.length} module(s)
                                    {nb.imports.thirdParty.length > 0 ? ` · third-party: ${nb.imports.thirdParty.join(', ')}` : ' · stdlib only'}
                                  </li>
                                  {nb.envVariables?.length > 0 && (
                                    <li className="mb-1">Environment variables referenced: {nb.envVariables.join(', ')}</li>
                                  )}
                                </ul>
                              ) : (
                                <div className="text-danger small">⚠ {nb.error}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Suggestions list */}
                      {reproReport.reproducibilityReport?.suggestions?.length > 0 && (
                        <div className="mt-3">
                          <div className="fw-semibold small text-muted mb-2 d-flex align-items-center gap-1.5">
                            <AlertTriangle size={14} className="text-warning" />
                            <span>Recommendations & Warnings</span>
                          </div>
                          {reproReport.reproducibilityReport.suggestions.map((suggestion, idx) => (
                            <Alert key={idx} variant="warning" className="py-2.5 px-3 mb-2 small d-flex align-items-start gap-2">
                              <span>•</span>
                              <span>{suggestion}</span>
                            </Alert>
                          ))}
                        </div>
                      )}

                      {/* Unpinned Dependencies detail */}
                      {reproReport.reproducibilityReport?.unversionedDependencies?.length > 0 && (
                        <div className="mt-4">
                          <div className="fw-semibold small text-muted mb-2">Unpinned dependencies detected ({reproReport.reproducibilityReport.unversionedDependencies.length})</div>
                          <div className="d-flex flex-wrap gap-1.5">
                            {reproReport.reproducibilityReport.unversionedDependencies.map((dep, idx) => (
                              <Badge key={idx} bg="danger-subtle" className="text-danger-emphasis p-2" style={{ fontSize: '11px' }}>
                                {dep.name} ({dep.type})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-5 text-muted">No reproducibility reports found. Trigger an environment audit above to verify build locks.</div>
                  )}
                </Card>
              </Col>
            </Row>
          </Tab>
        </Tabs>
        ) : (
          <div className="text-center py-5 text-muted glass-card">No projects created yet. Create a project to run software assessments.</div>
        )}
    </div>
  );
}
