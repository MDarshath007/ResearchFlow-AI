// Learning Modules — Phase 8 test suite (temp users only, cleaned up at the end).
// Usage: node learning-tests.mjs <baseUrl>
import fs from "fs";
import path from "path";
import os from "os";

const BASE = process.argv[2] || "http://localhost:5052/api";
let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) {
    pass += 1;
    console.log(`PASS  ${name}${extra ? " — " + extra : ""}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${name}${extra ? " — " + extra : ""}`);
  }
};

const req = async (method, url, { token, body, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: form ? form : body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
};

const api = { req };

// Unique temp users per run to avoid collisions with prior runs.
const stamp = Date.now().toString(36);
const USER1 = {
  username: `learntest1-${stamp}`,
  email: `learntest1-${stamp}@example.com`,
  password: "Test@1234",
};
const USER2 = {
  username: `learntest2-${stamp}`,
  email: `learntest2-${stamp}@example.com`,
  password: "Test@1234",
};

let t1 = null;
let t2 = null;
let modules = [];
let testingModule = null;
let quizQuestions = [];
let projectId = null;

const results = [];

async function main() {
  // ── Setup: register two temp users ────────────────────────────────────
  let r = await api.req("POST", "/auth/register", { body: USER1 });
  t1 = r.json?.data?.token;
  r = await api.req("POST", "/auth/register", { body: USER2 });
  t2 = r.json?.data?.token;
  check("Setup: temp users registered", !!t1 && !!t2);

  // ── 3. Unauthenticated access rejected ────────────────────────────────
  r = await api.req("GET", "/learning/modules");
  check(
    "T3: GET /learning/modules unauthenticated → 401",
    r.status === 401,
    `got ${r.status}`,
  );
  r = await api.req("GET", "/learning/modules/aaaaaaaaaaaaaaaaaaaaaaaa");
  check(
    "T3: GET module detail unauthenticated → 401",
    r.status === 401,
    `got ${r.status}`,
  );

  // ── 1. Module list returns seeded modules ─────────────────────────────
  r = await api.req("GET", "/learning/modules", { token: t1 });
  const listOk =
    r.status === 200 && r.json?.success && Array.isArray(r.json.data.modules);
  check(
    "T1: GET /learning/modules → 200 with modules array",
    listOk,
    `got ${r.status}`,
  );
  modules = listOk ? r.json.data.modules : [];
  check(
    "T1: 5 modules returned",
    modules.length === 5,
    `got ${modules.length}`,
  );
  const slugs = modules.map((m) => m.slug).sort();
  check(
    "T1: expected slugs present",
    JSON.stringify(slugs) ===
      JSON.stringify(
        [
          "collaboration-code-review",
          "documentation-standards",
          "reproducibility-environment",
          "testing-test-automation",
          "version-control-branching",
        ].sort(),
      ),
    slugs.join(","),
  );
  check(
    "T1: list includes lesson/quiz counts + progress",
    modules.every(
      (m) =>
        m.lessonCount >= 2 &&
        m.quizCount >= 3 &&
        m.progress &&
        m.completed === undefined,
    ),
    "",
  );
  check(
    "T1: no correctAnswer/explanation leaked in list",
    !JSON.stringify(modules).includes("correctAnswer"),
  );

  testingModule = modules.find((m) => m.slug === "testing-test-automation");
  check("T1: testing module present", !!testingModule);

  // ── 2. Module detail returns lessons and quiz (without answers) ───────
  r = await api.req("GET", `/learning/modules/${testingModule._id}`, {
    token: t1,
  });
  const detailOk = r.status === 200 && r.json?.success;
  check("T2: GET module detail → 200", detailOk, `got ${r.status}`);
  const mod = r.json.data.module;
  quizQuestions = mod.quiz;
  check(
    "T2: detail has lessons with content",
    Array.isArray(mod.lessons) &&
      mod.lessons.length >= 2 &&
      mod.lessons.every((l) => l.title && l.content && l.order >= 1),
    `${mod.lessons.length} lessons`,
  );
  check(
    "T2: detail has quiz questions with options",
    Array.isArray(mod.quiz) &&
      mod.quiz.length >= 3 &&
      mod.quiz.every(
        (q) => q.question && Array.isArray(q.options) && q.options.length >= 2,
      ),
    `${mod.quiz.length} questions`,
  );
  check(
    "T2: correctAnswer/explanation NOT returned before submission",
    !JSON.stringify(r.json.data).includes("correctAnswer") &&
      !JSON.stringify(r.json.data).includes("explanation"),
  );
  check(
    "T2: progress present (unattempted)",
    r.json.data.progress.quizAttempts === 0 &&
      r.json.data.progress.completed === false,
  );

  // Ground truth from DB (seed content) for scoring verification:
  const truthPath = path.join(
    process.cwd(),
    "..",
    "server",
    "seeds",
    "learningContent.js",
  );
  const contentMod = await import("file://" + truthPath.replace(/\\/g, "/"));
  const truth = contentMod.default.find(
    (m) => m.slug === "testing-test-automation",
  );
  const correctByQuestion = new Map(
    truth.quiz.map((q) => [q.question, q.correctAnswer]),
  );

  // ── 4. Invalid module ID handling ─────────────────────────────────────
  r = await api.req("GET", "/learning/modules/not-an-object-id", { token: t1 });
  check("T4: invalid module id → 400", r.status === 400, `got ${r.status}`);
  r = await api.req("GET", "/learning/modules/aaaaaaaaaaaaaaaaaaaaaaaa", {
    token: t1,
  });
  check(
    "T4: valid-format but nonexistent id → 404",
    r.status === 404,
    `got ${r.status}`,
  );
  r = await api.req("POST", "/learning/modules/not-an-object-id/quiz", {
    token: t1,
    body: { answers: [] },
  });
  check(
    "T4: quiz with invalid module id → 400",
    r.status === 400,
    `got ${r.status}`,
  );
  r = await api.req(
    "POST",
    "/learning/modules/aaaaaaaaaaaaaaaaaaaaaaaa/complete",
    { token: t1, body: {} },
  );
  check(
    "T4: complete nonexistent module → 404",
    r.status === 404,
    `got ${r.status}`,
  );

  // ── 5+6. Server-side scoring: all correct, then all wrong ─────────────
  const correctAnswers = quizQuestions.map((q) => ({
    questionId: q._id,
    selectedAnswer: correctByQuestion.get(q.question),
  }));
  r = await api.req("POST", `/learning/modules/${testingModule._id}/quiz`, {
    token: t1,
    body: { answers: correctAnswers },
  });
  const scoreAll = r.json?.data;
  check(
    "T5/T6: all-correct submission → score = total",
    r.status === 200 && scoreAll?.score === scoreAll?.total,
    `score ${scoreAll?.score}/${scoreAll?.total} (${scoreAll?.percentage}%)`,
  );
  check(
    "T5: response includes explanations per question",
    scoreAll?.results?.every(
      (x) => typeof x.explanation === "string" && x.explanation.length > 0,
    ),
  );
  check(
    "T5: percentage matches score/total",
    scoreAll &&
      scoreAll.percentage ===
        Math.round((scoreAll.score / scoreAll.total) * 100),
  );

  // Client cannot provide its own score: send score: 100 with wrong answers.
  const wrongAnswers = quizQuestions.map((q) => ({
    questionId: q._id,
    selectedAnswer: (correctByQuestion.get(q.question) + 1) % q.options.length,
  }));
  r = await api.req("POST", `/learning/modules/${testingModule._id}/quiz`, {
    token: t1,
    body: {
      answers: wrongAnswers,
      score: 100,
      percentage: 100,
      quizScore: 100,
    },
  });
  const scoreWrong = r.json?.data;
  check(
    "T5: client-supplied score field ignored (server-calculated)",
    r.status === 200 && scoreWrong?.score === 0 && scoreWrong?.percentage === 0,
    `score ${scoreWrong?.score}/${scoreWrong?.total}`,
  );

  // ── 8. Retake updates attempts/score ──────────────────────────────────
  r = await api.req("POST", `/learning/modules/${testingModule._id}/quiz`, {
    token: t1,
    body: { answers: correctAnswers },
  });
  check(
    "T8: retake → quizAttempts = 3, quizScore updated",
    r.json?.data?.progress?.quizAttempts === 3 &&
      r.json?.data?.progress?.quizScore === 100,
    `attempts ${r.json?.data?.progress?.quizAttempts}, score ${r.json?.data?.progress?.quizScore}`,
  );

  // ── Validation of answer format / question ids ────────────────────────
  r = await api.req("POST", `/learning/modules/${testingModule._id}/quiz`, {
    token: t1,
    body: { answers: "nope" },
  });
  check("T5: non-array answers → 400", r.status === 400, `got ${r.status}`);
  r = await api.req("POST", `/learning/modules/${testingModule._id}/quiz`, {
    token: t1,
    body: { answers: correctAnswers.slice(0, 2) },
  });
  check("T5: missing answers → 400", r.status === 400, `got ${r.status}`);
  r = await api.req("POST", `/learning/modules/${testingModule._id}/quiz`, {
    token: t1,
    body: {
      answers: [{ questionId: "bbbbbbbbbbbbbbbbbbbbbbbb", selectedAnswer: 0 }],
    },
  });
  check("T5: unknown question id → 400", r.status === 400, `got ${r.status}`);
  const badRange = correctAnswers.map((a, i) =>
    i === 0 ? { ...a, selectedAnswer: 99 } : a,
  );
  r = await api.req("POST", `/learning/modules/${testingModule._id}/quiz`, {
    token: t1,
    body: { answers: badRange },
  });
  check("T5: out-of-range answer → 400", r.status === 400, `got ${r.status}`);

  // ── 7. Quiz score persists after "refresh" (fresh GET) ────────────────
  r = await api.req("GET", `/learning/modules/${testingModule._id}`, {
    token: t1,
  });
  check(
    "T7: quiz progress persists on fresh GET",
    r.json?.data?.progress?.quizAttempts === 3 &&
      r.json?.data?.progress?.quizScore === 100,
    `attempts ${r.json?.data?.progress?.quizAttempts}, score ${r.json?.data?.progress?.quizScore}`,
  );

  // ── 9. Completion persists ────────────────────────────────────────────
  r = await api.req("POST", `/learning/modules/${testingModule._id}/complete`, {
    token: t1,
    body: { completed: false, evil: "ignored" },
  });
  check(
    "T9: complete → 200 with completed=true + completedAt",
    r.status === 200 &&
      r.json?.data?.progress?.completed === true &&
      !!r.json?.data?.progress?.completedAt,
    `completedAt ${r.json?.data?.progress?.completedAt ? "set" : "missing"}`,
  );
  // Body fields must not overwrite: completed:false in body was ignored.
  check(
    "T9: body cannot un-complete (mass-assignment ignored)",
    r.json?.data?.progress?.completed === true,
  );

  // ── 10. Completed state appears in module list ────────────────────────
  r = await api.req("GET", "/learning/modules", { token: t1 });
  const listed = r.json?.data?.modules?.find(
    (m) => m._id === testingModule._id,
  );
  check(
    "T10: list shows completed=true + quizScore after refresh",
    listed?.progress?.completed === true && listed?.progress?.quizScore === 100,
    `completed ${listed?.progress?.completed}, quizScore ${listed?.progress?.quizScore}`,
  );

  // ── 11. Second user cannot modify first user's progress ───────────────
  r = await api.req("GET", "/learning/modules", { token: t2 });
  const t2Listed = r.json?.data?.modules?.find(
    (m) => m._id === testingModule._id,
  );
  check(
    "T11: user2 sees own (uncompleted) progress, not user1's",
    t2Listed?.progress?.completed === false &&
      t2Listed?.progress?.quizAttempts === 0,
    `completed ${t2Listed?.progress?.completed}, attempts ${t2Listed?.progress?.quizAttempts}`,
  );

  // user2 tries to submit user1-shaped progress payloads — no progress id is
  // ever accepted by the API; record is keyed by (user, module).
  r = await api.req("POST", `/learning/modules/${testingModule._id}/complete`, {
    token: t2,
    body: { user: "someone-else", progressId: "cccccccccccccccccccccccc" },
  });
  check(
    "T11: user2 completing does not affect user1 progress",
    r.status === 200 && r.json?.data?.progress?.completed === true,
  );
  r = await api.req("GET", `/learning/modules/${testingModule._id}`, {
    token: t1,
  });
  check(
    "T11: user1 progress unchanged after user2 action",
    r.json?.data?.progress?.completed === true &&
      r.json?.data?.progress?.quizAttempts === 3,
    `attempts ${r.json?.data?.progress?.quizAttempts}`,
  );
  r = await api.req("POST", `/learning/modules/${testingModule._id}/quiz`, {
    token: t2,
    body: { answers: wrongAnswers },
  });
  check(
    "T11: user2 quiz recorded only on user2 record",
    r.json?.data?.progress?.quizAttempts === 1 &&
      r.json?.data?.progress?.quizScore === 0,
    `user2 attempts ${r.json?.data?.progress?.quizAttempts}`,
  );
  r = await api.req("GET", `/learning/modules/${testingModule._id}`, {
    token: t1,
  });
  check(
    "T11: user1 attempts still 3 after user2 quiz",
    r.json?.data?.progress?.quizAttempts === 3,
    `got ${r.json?.data?.progress?.quizAttempts}`,
  );

  // ── Phase 6: recommendation from a REAL assessment weakness ───────────
  // Create a project + upload a test-less ZIP to generate a real assessment.
  r = await api.req("POST", "/projects", {
    token: t1,
    body: {
      name: `Learn Rec ${stamp}`,
      description: "temp for learning rec test",
      domain: "Research Software Engineering",
    },
  });
  projectId = r.json?.data?._id || r.json?._id;
  check(
    "Phase6: temp project created for assessment",
    !!projectId,
    `status ${r.status}`,
  );

  if (projectId) {
    const zipPath = path.join(os.tmpdir(), "learning-no-tests.zip");
    const form = new FormData();
    form.append(
      "codebase",
      new Blob([fs.readFileSync(zipPath)], { type: "application/zip" }),
      "learning-no-tests.zip",
    );
    r = await api.req("POST", `/assessments/scan/${projectId}`, {
      token: t1,
      form,
    });
    check(
      "Phase6: real assessment ran on test-less ZIP",
      r.status === 200,
      `status ${r.status}`,
    );

    r = await api.req("GET", "/learning/modules", { token: t1 });
    const recs = r.json?.data?.recommendations || [];
    check(
      "Phase6: hasAssessmentData = true",
      r.json?.data?.hasAssessmentData === true,
    );
    const testingRec = recs.find((x) => x.slug === "testing-test-automation");
    check(
      'Phase6: Testing module recommended from actual "No test files detected" weakness',
      !!testingRec && testingRec.reasons.some((s) => /test/i.test(s)),
      testingRec
        ? `reason: ${testingRec.reasons[0]}`
        : `recs: ${recs.map((x) => x.slug).join(",") || "none"}`,
    );

    // user2 (no assessment) sees the neutral message data instead.
    r = await api.req("GET", "/learning/modules", { token: t2 });
    check(
      "Phase6: user without assessment → hasAssessmentData false + no recs",
      r.json?.data?.hasAssessmentData === false &&
        (r.json?.data?.recommendations || []).length === 0,
      `hasAssessmentData ${r.json?.data?.hasAssessmentData}`,
    );
  }

  // ── 14. Existing non-learning functionality still works ───────────────
  r = await fetch("http://localhost:5000/");
  let rootJson = null;
  try {
    rootJson = await r.json();
  } catch {}
  check("T14: root endpoint works", r.status === 200 && !!rootJson?.message);
  r = await api.req("POST", "/auth/login", {
    body: { email: USER1.email, password: USER1.password },
  });
  check("T14: auth login works", r.status === 200 && !!r.json?.data?.token);
  r = await api.req("GET", "/projects", { token: t1 });
  check("T14: projects list works", r.status === 200, `got ${r.status}`);
  r = await api.req("GET", "/collaboration/notifications", { token: t1 });
  check(
    "T14: collaboration notifications work",
    r.status === 200,
    `got ${r.status}`,
  );

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);

  // ── Cleanup: temp users (cascades progress) + temp project ────────────
  try {
    const { default: mongoose } = await import("mongoose");
    const { default: User } = await import("../models/User.js");
    const { default: UserProgress } = await import("../models/UserProgress.js");
    const { default: Project } = await import("../models/Project.js");
    const { default: Report } = await import("../models/Report.js");
    const { default: Repository } = await import("../models/Repository.js");
    const { default: Task } = await import("../models/Task.js");
    const { default: Message } = await import("../models/Message.js");
    const { default: Notification } = await import("../models/Notification.js");
    dotenv.config();
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({
      email: { $in: [USER1.email, USER2.email] },
    }).select("_id");
    const ids = users.map((u) => u._id);
    if (projectId) {
      await Report.deleteMany({ project: projectId });
      await Repository.deleteMany({ project: projectId });
      await Task.deleteMany({ project: projectId });
      await Message.deleteMany({ project: projectId });
      await Notification.deleteMany({ project: projectId });
      await Project.deleteOne({ _id: projectId });
    }
    await UserProgress.deleteMany({ user: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
    await mongoose.disconnect();
    console.log(
      "Cleanup: temp users, their progress, and temp project removed. Seeded modules kept.",
    );
  } catch (err) {
    console.log(`Cleanup note: manual cleanup needed (${err.message})`);
  }

  process.exit(fail > 0 ? 1 : 0);
}

import dotenv from "dotenv";
dotenv.config();

main().catch((err) => {
  console.error("Test run crashed:", err.message);
  process.exit(1);
});
