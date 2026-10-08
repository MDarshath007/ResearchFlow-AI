import React, { useState, useRef, useEffect } from 'react';
import { aiAPI, projectAPI } from '../services/api';
import { MessageSquare, Send, Compass, User, Sparkles, BookOpen } from 'lucide-react';
import { Container, Row, Col, Card, Button, Form, Spinner, ListGroup } from 'react-bootstrap';

export default function AIMentorPage() {
  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: "Hello! I am your Research Software Engineering (RSE) mentor. I can help you adopt industry best practices like version control (Git), automated unit testing, containerization (Docker), and reproducibility checklists. Ask me anything!",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [contextProjectId, setContextProjectId] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load the user's projects so the mentor can receive stored project evidence
  useEffect(() => {
    let active = true;
    projectAPI.getAll()
      .then((res) => {
        if (active && res.data?.success) setProjects(res.data.data || []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handleSend = async (e, customText = null) => {
    if (e) e.preventDefault();
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage = { role: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      const res = await aiAPI.mentorChat(textToSend, history, contextProjectId || undefined);

      if (res.data.success) {
        setMessages((prev) => [...prev, {
          role: 'model',
          text: res.data.data,
          source: res.data.source,
          fallbackReason: res.data.fallbackReason || null,
        }]);
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Sorry, I encountered an error. Please verify server connections.';
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: errMsg, isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const tutorials = [
    { title: "Writing Unit Tests", query: "How do I write unit tests for python?" },
    { title: "Using Git Branches", query: "Explain git branches workflows." },
    { title: "Reproducibility Setup", query: "How can I improve my project reproducibility rating?" },
    { title: "Dockerizing Pipelines", query: "How do I dockerize my research application?" },
  ];

  return (
    <div className="fade-in-slide p-4 workspace-page mentor-page">
      <div className="page-heading mb-4">
        <h2 className="font-display fw-bold mb-1">AI Research Mentor</h2>
        <p className="text-muted small">Learn how to write high-quality research software conforming to modern RSE standards</p>
      </div>

      <Row className="g-4">
        {/* Left Column: Quick Tutorials/Prompts */}
        <Col lg={4}>
          <Card className="glass-card section-card border-0 p-4 shadow-sm h-100">
            <h5 className="font-display fw-bold mb-3 d-flex align-items-center gap-2">
              <BookOpen className="text-primary" />
              <span>Recommended Topics</span>
            </h5>
            <p className="text-muted small mb-3">Click any topic to ask the AI mentor for detailed instructions and boilerplate templates.</p>

            {/* Optional: ground the mentor in stored project evidence */}
            <div className="mb-3">
              <Form.Label className="small fw-semibold mb-1">Project context (optional)</Form.Label>
              <Form.Select
                size="sm"
                value={contextProjectId}
                onChange={(e) => setContextProjectId(e.target.value)}
                aria-label="Select project context"
              >
                <option value="">No project context — general questions only</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </Form.Select>
              {contextProjectId && (
                <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                  The mentor will answer project questions from this project's stored assessment, reproducibility and GitHub evidence.
                </div>
              )}
            </div>

            <ListGroup variant="flush">
              {tutorials.map((tut, i) => (
                <ListGroup.Item 
                  key={i} 
                  action 
                  onClick={() => handleSend(null, tut.query)}
                  className="px-3 py-3 border rounded-3 mb-2 small bg-body text-body-emphasis hover-primary"
                  style={{ cursor: 'pointer' }}
                >
                  <div className="fw-semibold mb-1">{tut.title}</div>
                  <div className="text-muted small text-truncate">{tut.query}</div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
        </Col>

        {/* Right Column: Chat Window */}
        <Col lg={8}>
          <Card className="glass-card chat-card border-0 shadow-sm p-4 d-flex flex-column" style={{ height: '550px' }}>
            {/* Messages Feed */}
            <div className="flex-grow-1 overflow-y-auto mb-3 bg-body-tertiary rounded-3 p-3" style={{ fontSize: '13.5px' }}>
              {messages.map((m, idx) => (
                <div key={idx} className={`d-flex mb-3 ${m.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>
                  <div className={`d-flex gap-2 max-width-80 ${m.role === 'user' ? 'flex-row-reverse' : ''}`} style={{ maxWidth: '85%' }}>
                    <div className="rounded-circle p-1.5 d-flex align-items-center justify-content-center border" 
                         style={{ width: '32px', height: '32px', background: m.role === 'user' ? 'var(--bs-primary-bg-subtle)' : 'var(--bs-secondary-bg-subtle)' }}>
                      {m.role === 'user' ? <User size={16} /> : <Compass size={16} className="text-primary" />}
                    </div>
                    <div className="flex-grow-1">
                      <div className={`p-3 rounded-3 border ${m.role === 'user' ? 'bg-primary text-white border-primary' : 'bg-body border-light-subtle'}`} style={{ whiteSpace: 'pre-line' }}>
                        {m.text}
                      </div>
                      {m.source === 'local-fallback' && (
                        <div className="text-warning mt-1 d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                          <span>⚠ Local fallback — Gemini unavailable{m.fallbackReason ? `: ${m.fallbackReason}` : ''}. This reply was not generated by Gemini.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="d-flex gap-2 mb-3 justify-content-start align-items-center">
                  <Spinner animation="grow" size="sm" variant="primary" />
                  <Spinner animation="grow" size="sm" variant="primary" />
                  <Spinner animation="grow" size="sm" variant="primary" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <Form onSubmit={handleSend} className="d-flex gap-2 border-top pt-3">
              <Form.Control
                type="text"
                placeholder="Ask about git merges, Docker configs, writing test assertions..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
              <Button type="submit" className="btn-glow-primary px-4 fw-semibold d-flex align-items-center gap-2" disabled={loading || !input.trim()}>
                <Sparkles size={16} />
                <span>Send</span>
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
