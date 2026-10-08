import React, { useState, useEffect, useCallback } from 'react';
import { learningAPI } from '../services/api';
import {
  BookOpen,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ListChecks,
  Award,
  AlertTriangle,
  Target,
} from 'lucide-react';
import { Card, Button, Spinner, Badge, Alert, Form } from 'react-bootstrap';

const difficultyVariant = (d) =>
  d === 'Advanced' ? 'danger' : d === 'Intermediate' ? 'warning' : 'success';

const errorMessage = (err, fallback) =>
  err.response?.data?.message || fallback;

export default function LearningModules() {
  // ── List state ─────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modules, setModules] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [hasAssessmentData, setHasAssessmentData] = useState(false);

  // ── Reader state ───────────────────────────────────────────────────────
  const [activeModule, setActiveModule] = useState(null); // detail payload
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleError, setModuleError] = useState(null);
  const [lessonIndex, setLessonIndex] = useState(0);

  // ── Quiz state ─────────────────────────────────────────────────────────
  const [answers, setAnswers] = useState({}); // questionId -> option index
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState(null); // server response data
  const [quizError, setQuizError] = useState(null);

  // ── Completion state ───────────────────────────────────────────────────
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await learningAPI.getModules();
      if (res.data?.success) {
        setModules(res.data.data.modules || []);
        setRecommendations(res.data.data.recommendations || []);
        setHasAssessmentData(!!res.data.data.hasAssessmentData);
      } else {
        setError('Unexpected response from the server.');
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to load learning modules.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openModule = async (id) => {
    setModuleLoading(true);
    setModuleError(null);
    setActiveModule(null);
    setLessonIndex(0);
    setAnswers({});
    setQuizResult(null);
    setQuizError(null);
    setCompleteError(null);
    try {
      const res = await learningAPI.getModule(id);
      if (res.data?.success) {
        setActiveModule(res.data.data);
      } else {
        setModuleError('Unexpected response from the server.');
      }
    } catch (err) {
      setModuleError(errorMessage(err, 'Failed to load this module.'));
    } finally {
      setModuleLoading(false);
    }
  };

  const backToList = () => {
    setActiveModule(null);
    setQuizResult(null);
    setAnswers({});
    loadList();
  };

  const allAnswered =
    activeModule &&
    activeModule.module.quiz.length > 0 &&
    activeModule.module.quiz.every((q) => answers[q._id] !== undefined);

  const submitQuiz = async () => {
    if (!activeModule || submittingQuiz || !allAnswered) return;
    setSubmittingQuiz(true);
    setQuizError(null);
    try {
      const payload = activeModule.module.quiz.map((q) => ({
        questionId: q._id,
        selectedAnswer: answers[q._id],
      }));
      const res = await learningAPI.submitQuiz(activeModule.module._id, payload);
      if (res.data?.success) {
        setQuizResult(res.data.data);
        setActiveModule((prev) => ({ ...prev, progress: res.data.data.progress }));
      } else {
        setQuizError('Unexpected response from the server.');
      }
    } catch (err) {
      setQuizError(errorMessage(err, 'Failed to submit the quiz.'));
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const retakeQuiz = () => {
    setAnswers({});
    setQuizResult(null);
    setQuizError(null);
  };

  const markComplete = async () => {
    if (!activeModule || completing) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await learningAPI.completeModule(activeModule.module._id);
      if (res.data?.success) {
        setActiveModule((prev) => ({ ...prev, progress: res.data.data.progress }));
      } else {
        setCompleteError('Unexpected response from the server.');
      }
    } catch (err) {
      setCompleteError(errorMessage(err, 'Failed to mark the module complete.'));
    } finally {
      setCompleting(false);
    }
  };

  // ── Render: module reader ──────────────────────────────────────────────
  if (moduleLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center p-5">
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  if (moduleError) {
    return (
      <div className="p-4">
        <Alert variant="danger" className="d-flex align-items-center gap-2">
          <AlertTriangle size={18} />
          <div>
            {moduleError}
            <div className="mt-2">
              <Button size="sm" variant="outline-secondary" onClick={backToList}>
                <ArrowLeft size={14} className="me-1" /> Back to modules
              </Button>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  if (activeModule) {
    const { module: mod, progress } = activeModule;
    const lesson = mod.lessons[lessonIndex];
    const progressPct =
      mod.lessons.length > 0
        ? Math.round(((lessonIndex + 1) / mod.lessons.length) * 100)
        : 0;

    return (
      <div className="p-4 workspace-page fade-in-slide">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <Button size="sm" variant="outline-secondary" className="mb-2" onClick={backToList}>
              <ArrowLeft size={14} className="me-1" /> All modules
            </Button>
            <h4 className="mb-1 fw-bold">{mod.title}</h4>
            <div className="d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '13px' }}>
              <Badge bg="info-subtle" text="info-emphasis">{mod.category}</Badge>
              <Badge bg={`${difficultyVariant(mod.difficulty)}-subtle`} text={`${difficultyVariant(mod.difficulty)}-emphasis`}>
                {mod.difficulty}
              </Badge>
              <span className="text-muted d-inline-flex align-items-center gap-1">
                <Clock size={13} /> {mod.estimatedMinutes} min
              </span>
              {progress.completed && (
                <span className="text-success d-inline-flex align-items-center gap-1">
                  <CheckCircle2 size={14} /> Completed
                  {progress.completedAt && (
                    <span className="text-muted">
                      ({new Date(progress.completedAt).toLocaleDateString()})
                    </span>
                  )}
                </span>
              )}
              {progress.quizScore !== null && (
                <span className="text-muted d-inline-flex align-items-center gap-1">
                  <Award size={13} /> Quiz best: {progress.quizScore}% ({progress.quizAttempts} attempt{progress.quizAttempts === 1 ? '' : 's'})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Lesson reader ─────────────────────────────────────────── */}
        <Card className="border-0 shadow-sm mb-4">
          <Card.Body className="p-4">
            <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
              <div className="fw-semibold">
                Lesson {lessonIndex + 1} of {mod.lessons.length}: {lesson?.title}
              </div>
              <Badge bg="primary-subtle" text="primary-emphasis">{progressPct}% read</Badge>
            </div>
            <div className="progress mb-3" style={{ height: '6px' }}>
              <div
                className="progress-bar"
                role="progressbar"
                style={{ width: `${progressPct}%` }}
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>

            <div className="mb-4" style={{ whiteSpace: 'pre-line', lineHeight: 1.7, fontSize: '14.5px' }}>
              {lesson?.content}
            </div>

            <div className="d-flex justify-content-between">
              <Button
                size="sm"
                variant="outline-primary"
                disabled={lessonIndex === 0}
                onClick={() => setLessonIndex((i) => Math.max(0, i - 1))}
              >
                <ArrowLeft size={14} className="me-1" /> Previous
              </Button>
              <Button
                size="sm"
                variant="outline-primary"
                disabled={lessonIndex >= mod.lessons.length - 1}
                onClick={() => setLessonIndex((i) => Math.min(mod.lessons.length - 1, i + 1))}
              >
                Next <ArrowLeft size={14} className="ms-1" style={{ transform: 'rotate(180deg)' }} />
              </Button>
            </div>
          </Card.Body>
        </Card>

        {/* ── Quiz section ──────────────────────────────────────────── */}
        <Card className="border-0 shadow-sm mb-4">
          <Card.Body className="p-4">
            <div className="d-flex align-items-center gap-2 mb-3">
              <ListChecks size={18} className="text-primary" />
              <h6 className="mb-0 fw-bold">Knowledge Check</h6>
            </div>

            {quizError && <Alert variant="danger">{quizError}</Alert>}

            {!quizResult ? (
              <>
                {mod.quiz.map((q, qi) => (
                  <div key={q._id} className="mb-4">
                    <div className="fw-semibold mb-2" style={{ fontSize: '14px' }}>
                      {qi + 1}. {q.question}
                    </div>
                    {q.options.map((opt, oi) => (
                      <Form.Check
                        type="radio"
                        id={`q-${q._id}-${oi}`}
                        name={`q-${q._id}`}
                        label={<span style={{ fontSize: '14px' }}>{opt}</span>}
                        checked={answers[q._id] === oi}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q._id]: oi }))}
                        className="mb-1"
                        disabled={submittingQuiz}
                      />
                    ))}
                  </div>
                ))}
                <Button
                  variant="primary"
                  disabled={!allAnswered || submittingQuiz}
                  onClick={submitQuiz}
                >
                  {submittingQuiz ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Submitting…
                    </>
                  ) : (
                    'Submit Quiz'
                  )}
                </Button>
                {!allAnswered && (
                  <span className="text-muted ms-2" style={{ fontSize: '13px' }}>
                    Answer every question to submit.
                  </span>
                )}
              </>
            ) : (
              <>
                <Alert variant={quizResult.percentage >= 70 ? 'success' : 'warning'} className="d-flex align-items-center gap-2">
                  <Target size={18} />
                  <div>
                    You scored <strong>{quizResult.score} / {quizResult.total}</strong> ({quizResult.percentage}%)
                    {quizResult.percentage >= 70 ? ' — well done!' : ' — review the explanations below and try again.'}
                  </div>
                </Alert>

                {quizResult.results.map((r, i) => (
                  <div
                    key={r.questionId}
                    className={`p-3 rounded border mb-2 ${r.isCorrect ? 'border-success bg-success-subtle' : 'border-danger bg-danger-subtle'}`}
                  >
                    <div className="fw-semibold mb-1" style={{ fontSize: '14px' }}>
                      {i + 1}. {r.question}{' '}
                      {r.isCorrect ? (
                        <CheckCircle2 size={15} className="text-success" />
                      ) : (
                        <AlertTriangle size={15} className="text-danger" />
                      )}
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      Your answer: {r.options[r.selectedAnswer]}
                      {!r.isCorrect && (
                        <div className="text-success">
                          Correct answer: {r.options[r.correctAnswer]}
                        </div>
                      )}
                    </div>
                    <div className="text-muted mt-1" style={{ fontSize: '13px' }}>
                      {r.explanation}
                    </div>
                  </div>
                ))}

                <Button variant="outline-primary" size="sm" className="mt-2" onClick={retakeQuiz}>
                  Retake Quiz
                </Button>
              </>
            )}
          </Card.Body>
        </Card>

        {/* ── Completion ────────────────────────────────────────────── */}
        <Card className="border-0 shadow-sm mb-4">
          <Card.Body className="p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <div className="fw-semibold">Finished all lessons?</div>
              <div className="text-muted" style={{ fontSize: '13px' }}>
                Your completion is saved to your account and will persist across sessions.
              </div>
              {completeError && <div className="text-danger mt-1" style={{ fontSize: '13px' }}>{completeError}</div>}
            </div>
            {progress.completed ? (
              <span className="text-success fw-semibold d-inline-flex align-items-center gap-2">
                <CheckCircle2 size={18} /> Module Completed
              </span>
            ) : (
              <Button variant="success" onClick={markComplete} disabled={completing}>
                {completing ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} className="me-2" />
                    Mark Module Complete
                  </>
                )}
              </Button>
            )}
          </Card.Body>
        </Card>
      </div>
    );
  }

  // ── Render: list ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center p-5">
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  return (
    <div className="p-4 workspace-page fade-in-slide">
      <div className="page-heading mb-4">
        <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
          <BookOpen size={22} /> Learning Modules
        </h4>
        <p className="text-muted mb-0" style={{ fontSize: '14px' }}>
          Practical Research Software Engineering lessons with quizzes — your progress is saved to your account.
        </p>
      </div>

      {error && (
        <Alert variant="danger" className="d-flex align-items-center gap-2">
          <AlertTriangle size={18} />
          <div>
            {error}
            <Button size="sm" variant="outline-danger" className="ms-3" onClick={loadList}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* ── RSE gap recommendations ─────────────────────────────────── */}
      {!error && recommendations.length > 0 && (
        <Card className="border-0 shadow-sm mb-4 border-start border-primary border-3">
          <Card.Body className="p-4">
            <div className="d-flex align-items-center gap-2 mb-2">
              <Target size={18} className="text-primary" />
              <h6 className="mb-0 fw-bold">Recommended for your RSE gaps</h6>
            </div>
            <div className="text-muted mb-3" style={{ fontSize: '13px' }}>
              Based on weaknesses found in your most recent RSE assessments.
            </div>
            <div className="d-flex flex-column gap-2">
              {recommendations.map((rec) => (
                <button
                  key={rec.slug}
                  type="button"
                  className="btn btn-outline-primary text-start p-3"
                  onClick={() => openModule(rec.module)}
                >
                  <div className="fw-semibold">{rec.title}</div>
                  <ul className="mb-0 ps-3 mt-1" style={{ fontSize: '12.5px' }}>
                    {rec.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {!error && recommendations.length === 0 && (
        <Alert variant="info" className="d-flex align-items-center gap-2">
          <Target size={16} />
          {hasAssessmentData
            ? 'No specific RSE gaps were flagged in your recent assessments — explore all modules below.'
            : 'Complete an RSE assessment to receive personalized learning recommendations.'}
        </Alert>
      )}

      {/* ── Module cards ───────────────────────────────────────────── */}
      {!error && modules.length === 0 && !loading && (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-5 text-center text-muted">
            <BookOpen size={32} className="mb-2" />
            <div>No learning modules are available yet.</div>
          </Card.Body>
        </Card>
      )}

      <div className="row g-3">
        {modules.map((m) => (
          <div className="col-12 col-md-6 col-xl-4" key={m._id}>
            <Card
              className="h-100 border-0 shadow-sm learning-card"
              style={{ cursor: 'pointer' }}
              onClick={() => openModule(m._id)}
            >
              <Card.Body className="d-flex flex-column p-4">
                <div className="d-flex align-items-start justify-content-between mb-2">
                  <h6 className="fw-bold mb-0">{m.title}</h6>
                  {m.progress.completed && <CheckCircle2 size={18} className="text-success" />}
                </div>
                <div className="d-flex align-items-center gap-2 flex-wrap mb-2" style={{ fontSize: '12px' }}>
                  <Badge bg="info-subtle" text="info-emphasis">{m.category}</Badge>
                  <Badge bg={`${difficultyVariant(m.difficulty)}-subtle`} text={`${difficultyVariant(m.difficulty)}-emphasis`}>
                    {m.difficulty}
                  </Badge>
                </div>
                <div className="text-muted mb-3" style={{ fontSize: '13px' }}>
                  {m.description}
                </div>
                <div className="mt-auto d-flex align-items-center justify-content-between" style={{ fontSize: '12.5px' }}>
                  <span className="text-muted d-flex align-items-center gap-3">
                    <span className="d-inline-flex align-items-center gap-1">
                      <Clock size={13} /> {m.estimatedMinutes} min
                    </span>
                    <span className="d-inline-flex align-items-center gap-1">
                      <BookOpen size={13} /> {m.lessonCount} lessons
                    </span>
                    <span className="d-inline-flex align-items-center gap-1">
                      <ListChecks size={13} /> {m.quizCount} questions
                    </span>
                  </span>
                  {m.progress.quizScore !== null && (
                    <Badge bg="primary-subtle" text="primary-emphasis">
                      Quiz {m.progress.quizScore}%
                    </Badge>
                  )}
                </div>
              </Card.Body>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
