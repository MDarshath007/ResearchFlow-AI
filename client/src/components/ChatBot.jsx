import React, { useState, useRef, useEffect } from 'react';
import { aiAPI } from '../services/api';
import { MessageSquare, X, Send, User, Compass, HelpCircle } from 'lucide-react';
import { Button, Form, Spinner } from 'react-bootstrap';

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: "Hello! I am your Research Software Engineering (RSE) mentor. How can I help you adopt coding standards for your research today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e, customText = null) => {
    if (e) e.preventDefault();
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage = { role: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Send message to backend, including simplified history.
      // No project context is available in this global widget — projectId omitted.
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      const res = await aiAPI.mentorChat(textToSend, history);
      
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
      const errMsg = err.response?.data?.message || 'Sorry, I encountered an error connecting to the AI service. Please try again.';
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: errMsg, isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePromptClick = (prompt) => {
    handleSend(null, prompt);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <div className="chat-mentor-bubble" onClick={() => setIsOpen(true)}>
          <MessageSquare size={24} />
        </div>
      )}

      {/* Expanded Chat Dialog */}
      {isOpen && (
        <div
          className="glass-card position-fixed shadow-lg d-flex flex-column"
          style={{
            bottom: '24px',
            right: '24px',
            width: '380px',
            height: '520px',
            zIndex: 1050,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center px-3 py-2 bg-primary text-white">
            <div className="d-flex align-items-center gap-2">
              <Compass size={20} />
              <div>
                <div className="fw-semibold font-display" style={{ fontSize: '14px' }}>RSE Mentor Chat</div>
                <div className="small" style={{ fontSize: '11px', opacity: 0.8 }}>AI Research Guide</div>
              </div>
            </div>
            <Button variant="link" className="text-white p-1" onClick={() => setIsOpen(false)}>
              <X size={18} />
            </Button>
          </div>

          {/* Messages Feed */}
          <div className="flex-grow-1 p-3 overflow-y-auto bg-body-tertiary" style={{ fontSize: '13px' }}>
            {messages.map((m, idx) => (
              <div key={idx} className={`d-flex mb-3 ${m.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>
                <div className={`d-flex gap-2 max-width-80 ${m.role === 'user' ? 'flex-row-reverse' : ''}`} style={{ maxWidth: '80%' }}>
                  <div className={`rounded-circle p-1.5 d-flex align-items-center justify-content-center border`} 
                       style={{ width: '28px', height: '28px', background: m.role === 'user' ? 'var(--bs-primary-bg-subtle)' : 'var(--bs-secondary-bg-subtle)' }}>
                    {m.role === 'user' ? <User size={14} /> : <Compass size={14} className="text-primary" />}
                  </div>
                  <div className="flex-grow-1">
                    <div className={`p-2.5 rounded-3 border ${m.role === 'user' ? 'bg-primary text-white border-primary' : 'bg-body border-light-subtle'}`} style={{ whiteSpace: 'pre-line' }}>
                      {m.text}
                    </div>
                    {m.source === 'local-fallback' && (
                      <div className="text-warning mt-1" style={{ fontSize: '10.5px' }}>
                        ⚠ Local fallback — Gemini unavailable{m.fallbackReason ? `: ${m.fallbackReason}` : ''}. Not a Gemini reply.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="d-flex gap-2 mb-3 justify-content-start">
                <Spinner animation="grow" size="sm" variant="primary" />
                <Spinner animation="grow" size="sm" variant="primary" />
                <Spinner animation="grow" size="sm" variant="primary" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Suggested Prompts */}
          {messages.length === 1 && (
            <div className="px-3 py-2 bg-body-secondary border-top d-flex flex-wrap gap-1.5 justify-content-center">
              <Button size="sm" variant="outline-primary" style={{ fontSize: '11px' }} onClick={() => handlePromptClick("How do I write unit tests?")}>
                Unit Tests?
              </Button>
              <Button size="sm" variant="outline-primary" style={{ fontSize: '11px' }} onClick={() => handlePromptClick("How do I use Git branches?")}>
                Git branches?
              </Button>
              <Button size="sm" variant="outline-primary" style={{ fontSize: '11px' }} onClick={() => handlePromptClick("How can I improve reproducibility?")}>
                Reproducibility?
              </Button>
            </div>
          )}

          {/* Form Input */}
          <Form onSubmit={handleSend} className="p-2 border-top bg-body d-flex gap-2 align-items-center">
            <Form.Control
              type="text"
              placeholder="Ask the mentor a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              style={{ fontSize: '13px' }}
            />
            <Button type="submit" variant="primary" disabled={loading || !input.trim()} className="p-2 d-flex align-items-center justify-content-center" style={{ width: '38px', height: '38px' }}>
              <Send size={16} />
            </Button>
          </Form>
        </div>
      )}
    </>
  );
}
