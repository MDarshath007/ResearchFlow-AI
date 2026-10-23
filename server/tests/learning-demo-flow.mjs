// Phase 9 — Review-3 demo flow verification (temp user, cleaned up after).
// Login → Learning → open Testing module → read lessons → quiz → server score
// → mark complete → "refresh" (fresh GET) → completion persists → assessment
// → recommendation from actual weakness.
const BASE = 'http://localhost:5052/api';
const stamp = Date.now().toString(36);
const USER = { username: 'Demo Flow', email: `demoflow-${stamp}@example.com`, password: 'Test@1234' };
let failures = 0;
const step = (n, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  Step ${n}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
};
const call = async (method, url, token, body) => {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method !== 'GET' && body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

const run = async () => {
  // 1. Login (register acts as first login; then verify login works)
  let r = await call('POST', '/auth/register', null, USER);
  const token = r.json?.data?.token;
  step('1. Register/login', !!token, r.json?.message);
  r = await call('POST', '/auth/login', null, { email: USER.email, password: USER.password });
  const loginToken = r.json?.data?.token;
  step('1b. Login with same credentials', !!loginToken);
  const T = loginToken || token;

  // 2. Open Learning Modules
  r = await call('GET', '/learning/modules', T);
  const modules = r.json?.data?.modules || [];
  step('2. Learning Modules list loads', r.status === 200 && modules.length === 5, `${modules.length} modules`);

  // 3. Open "Testing & Test Automation"
  const testing = modules.find((m) => m.slug === 'testing-test-automation');
  r = await call('GET', `/learning/modules/${testing?._id}`, T);
  const mod = r.json?.data?.module;
  step('3. Testing module opens', !!mod && mod.title === 'Testing & Test Automation');

  // 4. Read lessons (4 lessons with content)
  const lessonsOk = (mod?.lessons || []).length >= 2 && mod.lessons.every((l) => l.content.length > 100);
  step('4. Lessons readable', lessonsOk, `${mod?.lessons?.length} lessons with real content`);

  // 5. Take quiz → server-calculated score (answers from seed ground truth)
  const { default: content } = await import('../seeds/learningContent.js');
  const truth = content.find((m) => m.slug === 'testing-test-automation');
  const truthByQ = new Map(truth.quiz.map((q) => [q.question, q.correctAnswer]));
  const answers = mod.quiz.map((q) => ({ questionId: q._id, selectedAnswer: truthByQ.get(q.question) }));
  r = await call('POST', `/learning/modules/${testing._id}/quiz`, T, { answers });
  const scoreData = r.json?.data;
  step('5. Quiz → server-calculated score', scoreData?.score === scoreData?.total && scoreData?.percentage === 100,
    `${scoreData?.score}/${scoreData?.total} (${scoreData?.percentage}%) source: server-stored answers`);
  step('5b. Explanations returned', scoreData?.results?.every((x) => x.explanation?.length > 0));

  // 6. Mark module complete
  r = await call('POST', `/learning/modules/${testing._id}/complete`, T, {});
  step('6. Mark complete', r.json?.data?.progress?.completed === true && !!r.json?.data?.progress?.completedAt);

  // 7. Refresh (fresh requests as the browser would) → completion remains
  r = await call('GET', '/learning/modules', T);
  const after = (r.json?.data?.modules || []).find((m) => m.slug === 'testing-test-automation');
  step('7. After refresh: completion + score persist',
    after?.progress?.completed === true && after?.progress?.quizScore === 100,
    `completed ${after?.progress?.completed}, quizScore ${after?.progress?.quizScore}`);

  // 8. Open RSE assessment → create real assessment from test-less ZIP
  r = await call('POST', '/projects', T, { name: `Demo ${stamp}`, description: 'demo flow project', domain: 'General Research' });
  const projectId = r.json?.data?._id || r.json?._id;
  const form = new FormData();
  const fs = await import('fs');
  const os = await import('os');
  const path = await import('path');
  form.append('codebase', new Blob([fs.readFileSync(path.join(os.tmpdir(), 'learning-no-tests.zip'))]), 'demo.zip');
  r = await fetch(`${BASE}/assessments/scan/${projectId}`, { method: 'POST', headers: { Authorization: `Bearer ${T}` }, body: form });
  const assessmentOk = r.status === 200;
  step('8. RSE assessment completes on real evidence', assessmentOk, `status ${r.status}`);

  // 9. Return to Learning → recommendation based on ACTUAL weakness
  r = await call('GET', '/learning/modules', T);
  const recs = r.json?.data?.recommendations || [];
  const testingRec = recs.find((x) => x.slug === 'testing-test-automation');
  step('9. Personalized recommendation from actual assessment weakness',
    r.json?.data?.hasAssessmentData === true && !!testingRec && testingRec.reasons.some((s) => s.includes('test files')),
    testingRec ? `reason: "${testingRec.reasons.find((s) => s.includes('test files'))}"` : `recs: ${recs.map((x) => x.slug).join(',')}`);

  // Cleanup temp user/progress/project
  try {
    const { default: mongoose } = await import('mongoose');
    const dotenv = await import('dotenv');
    dotenv.default.config();
    await mongoose.connect(process.env.MONGO_URI);
    const { default: User } = await import('../models/User.js');
    const { default: UserProgress } = await import('../models/UserProgress.js');
    const { default: Project } = await import('../models/Project.js');
    const { default: Report } = await import('../models/Report.js');
    const { default: Repository } = await import('../models/Repository.js');
    const { default: Task } = await import('../models/Task.js');
    const { default: Message } = await import('../models/Message.js');
    const { default: Notification } = await import('../models/Notification.js');
    const user = await User.findOne({ email: USER.email }).select('_id');
    if (user) {
      if (projectId) {
        await Report.deleteMany({ project: projectId });
        await Repository.deleteMany({ project: projectId });
        await Task.deleteMany({ project: projectId });
        await Message.deleteMany({ project: projectId });
        await Notification.deleteMany({ project: projectId });
        await Project.deleteOne({ _id: projectId });
      }
      await UserProgress.deleteMany({ user: user._id });
      await User.deleteOne({ _id: user._id });
    }
    await mongoose.disconnect();
    console.log('Cleanup: demo user + project removed. Seeded modules kept.');
  } catch (e) {
    console.log(`Cleanup note: ${e.message}`);
  }

  console.log(failures === 0 ? '\nDEMO FLOW: ALL STEPS PASS' : `\nDEMO FLOW: ${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => { console.error('Demo crashed:', e.message); process.exit(1); });
