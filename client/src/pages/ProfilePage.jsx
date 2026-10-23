import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { projectAPI, authAPI } from '../services/api';
import { Award, Mail, Shield, Download, FileText, Star, Trophy, Camera, Trash2, Upload } from 'lucide-react';
import { Row, Col, Card, Button, Badge, Modal, Spinner, ListGroup, Alert } from 'react-bootstrap';
import UserAvatar from '../components/UserAvatar';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState(null);
  const fileInputRef = useRef(null);
  
  // Certificate states
  const [showCertificate, setShowCertificate] = useState(false);
  const [certProject, setCertProject] = useState(null);

  useEffect(() => {
    const fetchProfileProjects = async () => {
      try {
        const res = await projectAPI.getAll();
        if (res.data.success) {
          setProjects(res.data.data);
        }
      } catch (err) {
        console.error(err);
        setAvatarMessage({
          type: 'danger',
          text: err.response?.data?.message || 'Failed to load your projects.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfileProjects();
  }, []);

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    setUploadingAvatar(true);
    setAvatarMessage(null);

    try {
      const res = await authAPI.uploadAvatar(formData);
      if (res.data.success) {
        setUser(res.data.data);
        setAvatarMessage({ type: 'success', text: 'Real profile photo uploaded successfully!' });
      }
    } catch (err) {
      console.error(err);
      setAvatarMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to upload photo.' });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    setAvatarMessage(null);

    try {
      const res = await authAPI.removeAvatar();
      if (res.data.success) {
        setUser(res.data.data);
        setAvatarMessage({ type: 'info', text: 'Profile photo removed. Showing plain avatar.' });
      }
    } catch (err) {
      console.error(err);
      setAvatarMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to remove photo.' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleOpenCertificate = (proj) => {
    setCertProject(proj);
    setShowCertificate(true);
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  // Count achievements
  const goldPlatinumProjects = projects.filter(p => p.maturityLevel === 'Gold' || p.maturityLevel === 'Platinum');
  const silverProjects = projects.filter(p => p.maturityLevel === 'Silver');
  const bronzeProjects = projects.filter(p => p.maturityLevel === 'Bronze');

  return (
    <div className="profile-page-shell fade-in-slide">
      <div className="profile-header">
        <h2 className="font-display fw-bold mb-1">Scholar Profile</h2>
        <p>Manage credential configurations and track RSE achievements</p>
      </div>

      {avatarMessage && (
        <Alert variant={avatarMessage.type} dismissible onClose={() => setAvatarMessage(null)} className="profile-alert mb-4">
          {avatarMessage.text}
        </Alert>
      )}

      <Row className="profile-layout g-4">
        <Col lg={4}>
          <Card className="profile-panel profile-card-primary border-0">
            <div className="profile-avatar-wrap">
              <UserAvatar user={user} size={120} />

              <button
                className="profile-upload-trigger"
                title="Upload Real Profile Photo (Multer)"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? <Spinner animation="border" size="sm" /> : <Camera size={16} />}
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarFileChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>

            <h3 className="profile-name font-display fw-bold text-center">{user?.username}</h3>
            <span className="profile-role-badge">{user?.role}</span>

            <div className="profile-actions">
              <Button
                variant="outline-primary"
                size="sm"
                className="profile-action-btn primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                <Upload size={14} />
                <span>Upload Photo</span>
              </Button>

              {user?.avatar ? (
                <Button
                  variant="outline-danger"
                  size="sm"
                  className="profile-action-btn danger"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </Button>
              ) : (
                <Badge bg="light" className="profile-plain-badge">
                  Plain Avatar Active
                </Badge>
              )}
            </div>

            <div className="profile-meta">
              <div className="profile-meta-item">
                <Mail size={16} className="profile-meta-icon" />
                <span>{user?.email}</span>
              </div>
              <div className="profile-meta-item">
                <Shield size={16} className="profile-meta-icon" />
                <span>Account Status: Verified</span>
              </div>
            </div>
          </Card>
        </Col>

        <Col lg={8}>
          <Card className="profile-panel profile-card-secondary border-0">
            <div className="profile-section-heading">
              <Star className="text-warning" />
              <span>Research RSE Achievements</span>
            </div>

            <p className="profile-section-copy">
              Achievements and certified badges unlock dynamically based on codebase assessment logs. Reaching <strong>Gold</strong> or <strong>Platinum</strong> tiers qualifies projects for RSE Quality Certifications.
            </p>

            <Row className="g-3 mb-4 profile-stats-grid">
              <Col md={4}>
                <div className="profile-stat-box elite">
                  <Trophy className="profile-stat-icon" size={24} />
                  <div className="profile-stat-label">Elite Certificates</div>
                  <h3>{goldPlatinumProjects.length}</h3>
                </div>
              </Col>
              <Col md={4}>
                <div className="profile-stat-box silver">
                  <Star className="profile-stat-icon" size={24} />
                  <div className="profile-stat-label">Silver Badges</div>
                  <h3>{silverProjects.length}</h3>
                </div>
              </Col>
              <Col md={4}>
                <div className="profile-stat-box bronze">
                  <Award className="profile-stat-icon" size={24} />
                  <div className="profile-stat-label">Bronze Badges</div>
                  <h3>{bronzeProjects.length}</h3>
                </div>
              </Col>
            </Row>

            <h5 className="profile-cert-header">RSE Quality Certificates</h5>
            {goldPlatinumProjects.length === 0 ? (
              <div className="profile-empty-state">
                No certificates unlocked yet. Elevate project maturity scores to Gold (71+) or Platinum (91+) to generate certificates.
              </div>
            ) : (
              <ListGroup variant="flush" className="profile-list-group">
                {goldPlatinumProjects.map((proj) => (
                  <ListGroup.Item key={proj._id} className="profile-list-item">
                    <div>
                      <div className="profile-list-title">{proj.name} Quality Certificate</div>
                      <span className="profile-list-meta">Grade: <strong>{proj.maturityLevel}</strong> ({proj.maturityScore}%)</span>
                    </div>
                    <Button size="sm" className="btn-glow-primary profile-view-btn" onClick={() => handleOpenCertificate(proj)}>
                      <FileText size={14} />
                      <span>View Certificate</span>
                    </Button>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Card>
        </Col>
      </Row>

      <Modal show={showCertificate} onHide={() => setShowCertificate(false)} size="lg" centered>
        <Modal.Header closeButton className="border-0">
          <Modal.Title className="font-display fw-bold">RSE Software Certification</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4 d-flex justify-content-center bg-dark">
          {certProject && (
            <div 
              className="p-5 border border-5 border-warning bg-white text-dark shadow-lg text-center position-relative" 
              style={{ 
                width: '100%', 
                maxWidth: '680px', 
                borderStyle: 'double',
                fontFamily: 'serif',
                backgroundImage: 'radial-gradient(circle, #fffdf0 0%, #fff 100%)'
              }}
            >
              <div className="position-absolute" style={{ border: '1px solid #d97706', top: '10px', left: '10px', right: '10px', bottom: '10px', pointerEvents: 'none' }} />

              <Trophy size={48} className="text-warning mb-3" />

              <h2 className="font-display fw-bold" style={{ letterSpacing: '2px', color: '#111827' }}>CERTIFICATE OF ACHIEVEMENT</h2>
              <div className="text-muted fs-6 mb-4" style={{ fontStyle: 'italic' }}>RESEARCH SOFTWARE ENGINEERING READINESS</div>

              <p className="fs-6 text-muted mb-2">This official document is awarded to principal scholar</p>
              <h3 className="fw-bold mb-4 font-display text-gradient text-primary" style={{ fontFamily: 'sans-serif' }}>{user?.username}</h3>

              <p className="fs-6 text-muted mb-2">for demonstrating software quality practices, automated testing architectures,</p>
              <p className="fs-6 text-muted mb-2">complete API definitions, environment containment, and reproduci-readiness grades for</p>

              <h4 className="fw-bold my-4 text-dark" style={{ fontFamily: 'sans-serif' }}>"{certProject.name}"</h4>

              <div className="d-flex justify-content-center align-items-center gap-3 my-4">
                <span className="badge bg-warning text-dark px-3 py-2 fs-6 fw-bold shadow">
                  {certProject.maturityLevel} TIER (REACHED: {certProject.maturityScore}%)
                </span>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-5 pt-4 border-top">
                <div className="text-center" style={{ width: '150px' }}>
                  <div className="small fw-semibold text-muted border-bottom pb-1" style={{ fontSize: '11px' }}>August 19, 2026</div>
                  <span className="text-muted small" style={{ fontSize: '10px' }}>ISSUE DATE</span>
                </div>
                <div className="text-center" style={{ width: '150px' }}>
                  <div className="small fw-bold text-gradient text-primary border-bottom pb-1" style={{ fontFamily: 'sans-serif', fontSize: '12px' }}>ResearchFlow AI</div>
                  <span className="text-muted small" style={{ fontSize: '10px' }}>VERIFYING AUTHORITY</span>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button variant="outline-secondary" onClick={() => setShowCertificate(false)}>Close</Button>
          <Button className="btn-glow-primary d-flex align-items-center gap-2" onClick={handlePrintCertificate}>
            <Download size={16} />
            <span>Print / Save PDF</span>
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
