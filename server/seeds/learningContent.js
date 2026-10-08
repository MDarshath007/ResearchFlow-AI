// Learning content for ResearchFlow AI — RSE learning modules.
// Kept separate from the seed script so content stays reviewable and
// the seeding logic stays minimal. Static data only: no secrets.

const learningModules = [
  // ─────────────────────────────────────────────────────────────
  // 1. Version Control & Branching
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Version Control & Branching',
    slug: 'version-control-branching',
    description:
      'Use Git as a reliable lab notebook for code: meaningful commits, safe branching, and history you can trust when a paper deadline is close.',
    category: 'Version Control',
    difficulty: 'Beginner',
    estimatedMinutes: 30,
    lessons: [
      {
        title: 'Commits as a Research Record',
        order: 1,
        content: `A version control history is the audit trail of your research code. When a reviewer asks "why does this line exist?", the commit that introduced it should answer.

Commit small and often:
- One logical change per commit. A commit that renames a variable AND fixes a bug cannot be reverted safely.
- Write the commit message for a future reader: "Fix off-by-one in fold split for small datasets", not "fix bug".
- Commit the code, not the results of running it. Generated outputs belong in .gitignore or a release artifact.

Things that must never enter history:
- Secrets: API keys, .env files, private tokens. Rotate immediately if one is committed — Git remembers forever.
- Large datasets: use a data versioning tool (DVC, Zenodo, OSF) or a documented download script instead.
- One-off scratch scripts: delete them or keep them in a clearly named experiments/ folder with a note.

A good test: if you had to hand your repository to a stranger with no explanation, would the last 20 commits tell a coherent story of how the code evolved?`,
      },
      {
        title: 'Branching That Keeps main Working',
        order: 2,
        content: `The core branching rule for teams: the main branch should always work. Everything risky happens on a branch and reaches main only after review.

A simple, effective workflow:
1. Create a short-lived branch from main for each unit of work (feature/fix/refactor).
2. Keep the branch short-lived — hours or a day, not weeks. Long-lived branches drift and merge painfully.
3. Open a pull request. CI runs, a teammate reviews, and only then does it merge.
4. Delete the branch after merging.

Branch naming carries context: fix/empty-chart-on-new-project, feature/export-report-pdf, refactor/move-scan-logic.

Merging conflicts are information, not failure. They mean two people changed the same lines — resolve by understanding both intents, then re-run tests before merging.

Avoid these common traps:
- Committing directly to main "because it is small" — small breaks are still breaks.
- One giant branch for a whole semester of work — reviews become impossible and conflicts pile up.
- Deleting a branch before the pull request is merged — the work exists only in your clone.`,
      },
      {
        title: 'Tags, Releases, and Reproducible Checkpoints',
        order: 3,
        content: `Papers need citable, frozen versions of code. Git tags give you that checkpoint.

Practices that make releases reproducible:
- Tag every published version: git tag -a v1.0 -m "Version used for paper submission". The tag points to an exact commit — anyone can check it out.
- Tie releases to DOIs: push the release to GitHub and archive it on Zenodo to get a DOI you can put in the paper.
- Keep a changelog: a short CHANGELOG.md entry per release tells readers what changed since the last one.
- Record dependencies at the tag: a requirements.txt or environment.yml committed alongside the code means the tagged version can be reinstalled exactly.

For a review checklist:
- Does the repository have at least one tag matching the paper's submitted version?
- Can a stranger reinstall that tagged version from the committed dependency file alone?
- Does the README state which version was used for the reported results?

Tags are cheap and permanent. When in doubt, tag.`,
      },
    ],
    quiz: [
      {
        question: 'You are about to commit. Which change should be split into a separate commit?',
        options: [
          'A variable rename plus a bug fix in the fold-splitting logic, in the same file',
          'A commit message correction (typo fix in the message itself)',
          'Adding a new test file that covers the function you just changed',
          'Updating .gitignore to exclude generated output files',
        ],
        correctAnswer: 0,
        explanation:
          'A rename and a bug fix are two logical changes: reverting one should not revert the other. Commits should be atomic so each can be reviewed, understood, and reverted independently.',
      },
      {
        question: 'A teammate committed an API key to a public repository. What is the correct first response?',
        options: [
          'Delete the file in a new commit — the key is now safe',
          'Rotate/revoke the key immediately, then purge it from history and use environment variables going forward',
          'Make the repository private and do nothing else — private repos hide the key',
          'Leave it; API keys in Git are automatically detected and protected by GitHub',
        ],
        correctAnswer: 1,
        explanation:
          'Deleting the file in a new commit leaves the key in history, which stays accessible. The key must be revoked/rotated first (it is already exposed), then history cleaned and the secret moved to an environment variable.',
      },
      {
        question: 'What is the main purpose of keeping the main branch always in a working state?',
        options: [
          'It makes git log shorter',
          'Anyone (including CI) can trust that a fresh clone of main passes tests at any time',
          'It avoids the need for pull requests entirely',
          'It prevents merge conflicts from ever occurring',
        ],
        correctAnswer: 1,
        explanation:
          'A always-working main means every clone and every CI run starts from a known-good state, so failures come from new changes — not from an unclear baseline. It does not remove pull requests or eliminate conflicts.',
      },
      {
        question: 'Why should large research datasets normally be excluded from a Git repository?',
        options: [
          'Git cannot store binary files at all',
          'Large files bloat the clone forever (Git keeps every version) and datasets belong in versioned data stores or documented downloads',
          'Datasets are automatically deleted by GitHub after 30 days',
          'Excluding data makes the code reproducible',
        ],
        correctAnswer: 1,
        explanation:
          'Git keeps every version of every file, so a large dataset permanently inflates every clone. Data should live in data versioning tools (DVC) or archived stores (Zenodo/OSF) with the repository documenting how to fetch it.',
      },
      {
        question: 'What does tagging a release (e.g., v1.0) achieve?',
        options: [
          'It locks the repository so no one can push anymore',
          'It marks an exact commit as a citable checkpoint, so the precise code version behind a paper can be recovered',
          'It converts the repository into a package registry',
          'It automatically archives the code to Zenodo without any further action',
        ],
        correctAnswer: 1,
        explanation:
          'A tag is a permanent pointer to one commit. Tagging the version used in a paper lets anyone check out exactly that code. Archiving to a DOI (Zenodo) and writing a changelog are separate, additional steps.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 2. Testing & Test Automation
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Testing & Test Automation',
    slug: 'testing-test-automation',
    description:
      'Build confidence in research code with unit tests, regression tests against known outputs, and automated test runs on every change.',
    category: 'Testing',
    difficulty: 'Beginner',
    estimatedMinutes: 35,
    lessons: [
      {
        title: 'What to Test in Research Code',
        order: 1,
        content: `Research code fails in characteristic ways: a silent numerical drift, a data-loading edge case, a refactor that quietly changes results. Tests target exactly these failures.

Priority order for a research repository:
1. Core scientific logic — the function that computes the metric, splits the data, fits the model. If this is wrong, every result is wrong.
2. Edge cases you have actually hit — empty inputs, single-sample datasets, missing columns, NaNs. Turn past bugs into tests so they never return.
3. Regression/golden tests — run the pipeline on a small fixed input and compare against a stored expected output (with a numeric tolerance for floats).
4. Data loading and parsing — file formats change silently between sources.

What NOT to waste early tests on:
- Trivial getters/setters.
- Third-party library behavior (test your usage of it, not the library itself).
- Exhaustive coverage percentage targets. Coverage is a map of where you have NOT looked, not a score.

A practical rule: if a bug in this function would change a number in your paper, it deserves a test.`,
      },
      {
        title: 'Writing Tests That Run Automatically',
        order: 2,
        content: `A test that nobody runs is documentation. Automation is what makes testing stick.

Test layout (Python/pytest example, same idea applies to Jest, JUnit, etc.):
- tests/test_statistics.py — tests live next to the code, named test_* so the runner finds them.
- Each test does three things: Arrange (build small inputs), Act (call the function), Assert (check the result).

Example shape:

    def test_mean_handles_empty_list():
        # Arrange
        data = []
        # Act
        result = mean(data)
        # Assert
        assert result is None

Tips that keep tests trustworthy:
- Tests must be deterministic: same input, same result, every run. Fix random seeds or inject them.
- Keep them fast — sub-second unit tests get run; slow suites get skipped.
- Give assert messages: assert score == 88, f"expected 88, got {score}".
- One behavior per test, named after the behavior: test_scanner_flags_missing_tests.

Running locally should be one command (pytest, npm test). Running on every push is the job of CI — see the next lesson.`,
      },
      {
        title: 'Continuous Integration: Tests on Every Change',
        order: 3,
        content: `Continuous integration (CI) runs your test suite automatically on every push or pull request, usually via GitHub Actions. It turns "did I break something?" from a hope into a check.

A minimal workflow does three steps:
1. Checkout the code.
2. Install dependencies (pip install -r requirements.txt).
3. Run the test suite (pytest). A failing test fails the job, and the pull request cannot merge silently.

Why this matters for research teams:
- It catches breakage at the moment it is introduced, not three months later when someone reruns an experiment.
- It frees reviewers from manually re-running everything — CI is the objective, mechanical check; reviewers focus on design and correctness.
- It documents how to run the tests: the workflow file is executable instructions.

Coverage reports (e.g., pytest-cov, codecov) are useful as a directional signal: new code without coverage is a review question, not an automatic blocker.

Start small: one job, install + test, required for merge. Add matrix testing (multiple Python versions) only after the basic pipeline is stable.`,
      },
      {
        title: 'Regression Tests for Numerical Results',
        order: 4,
        content: `Research pipelines produce numbers, and numbers drift. A regression test pins a known result so future changes cannot silently alter it.

How to build one:
1. Choose a tiny, fixed input (a small CSV checked into tests/fixtures/, not live API data).
2. Run the current pipeline once and verify the output manually — this is your golden reference.
3. Store the expected output alongside the fixture.
4. Assert with a tolerance, because floating point arithmetic is not bit-exact across platforms:

    assert abs(result - 0.8731) < 1e-4   # or pytest.approx(0.8731, abs=1e-4)

Rules that keep regression tests useful:
- The fixture must be tiny and stable — a few rows, not the full dataset.
- Updating a golden output must be a deliberate, reviewed act: when a result legitimately changes, the commit message must explain WHY the number moved.
- Test the summary statistics you report in the paper (accuracy, score, ranking), not every intermediate value.

A regression suite gives you the strongest claim a reviewer can check: "changing the code did not change the science, unless the commit says so."`,
      },
    ],
    quiz: [
      {
        question: 'Which function in a research repository most deserves its first unit test?',
        options: [
          'A property getter that returns a stored field',
          'The function computing the evaluation metric used in the paper',
          'A print-statement helper used for logging',
          'The third-party library function you imported',
        ],
        correctAnswer: 1,
        explanation:
          'Test the core scientific logic first: a bug there changes reported numbers. Getters, print helpers, and third-party internals give little value to test early.',
      },
      {
        question: 'A regression (golden) test compares pipeline output to a stored expected value of 0.8731. Why assert with a tolerance instead of exact equality?',
        options: [
          'Because pytest does not support == on floats',
          'Floating point results can differ slightly across platforms and versions, so exact equality would fail spuriously',
          'Tolerances make the test easier to pass when the code is wrong',
          'Because the stored value may itself be wrong',
        ],
        correctAnswer: 1,
        explanation:
          'Floating-point arithmetic is not bit-identical across machines/libraries. A small tolerance (e.g., 1e-4) accepts harmless numerical noise while still catching real logic changes.',
      },
      {
        question: 'What is the primary role of continuous integration (CI) in a testing workflow?',
        options: [
          'To host the production server',
          'To run the test suite automatically on every push/PR and block merging when tests fail',
          'To write new tests automatically',
          'To replace code review entirely',
        ],
        correctAnswer: 1,
        explanation:
          'CI mechanically runs tests on each change, catching breakage immediately and gating merges. It does not write tests or replace human review of design and correctness.',
      },
      {
        question: 'Your test suite takes 20 minutes and hits the live data API every run. What is the most likely consequence?',
        options: [
          'Developers skip or avoid running it, and flaky network results erode trust in failures',
          'The tests become more accurate over time',
          'CI costs go down automatically',
          'The API becomes faster',
        ],
        correctAnswer: 0,
        explanation:
          'Slow, network-dependent, nondeterministic suites get bypassed and their red results get ignored. Use small local fixtures and deterministic inputs for unit/regression tests; reserve live API calls for a separate, scheduled job.',
      },
      {
        question: 'A refactor changes a golden-test result from 0.8731 to 0.8732 (within tolerance). What should you do?',
        options: [
          'Delete the regression test — it is too brittle',
          'Accept it silently since the difference is small',
          'Confirm the change is expected and, if intentional, update the golden value with a commit message explaining why',
          'Rewrite the whole pipeline to avoid floating point',
        ],
        correctAnswer: 2,
        explanation:
          'Small, understood drift is fine — but the golden value update must be deliberate and documented so the history explains exactly when and why reported numbers changed.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 3. Documentation Standards
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Documentation Standards',
    slug: 'documentation-standards',
    description:
      'Write READMEs, docstrings, and citations that let a stranger install, run, and credit your research software without emailing you.',
    category: 'Documentation',
    difficulty: 'Beginner',
    estimatedMinutes: 30,
    lessons: [
      {
        title: 'The README: Your Software’s Front Door',
        order: 1,
        content: `Most readers decide whether to use your software in under a minute, based almost entirely on the README. Write it for someone who has never met you.

A research README answers, in this order:
1. What is this? — One or two sentences: the problem it solves, for whom.
2. Who made it and how do I cite it? — Authors, license, CITATION.cff or BibTeX. For research software, citation is a feature, not an afterthought.
3. How do I install it? — Exact commands, including prerequisites and versions ("Python 3.11+").
4. How do I run it? — The shortest path to a working example, with real commands and expected output.
5. Where is the data? — How to get input data, or a script that fetches it.
6. How do I contribute? — Link to CONTRIBUTING or a quick "open an issue" line.

Anti-patterns that lose readers:
- "Coming soon" install instructions.
- Commands that were never tested on a clean machine.
- A README that describes features the code no longer have — stale docs are worse than none; update docs in the same pull request as the change.

Test your README: clone the repo into a fresh folder and follow it literally. Every step that fails is a bug in the documentation.`,
      },
      {
        title: 'Docstrings and API Documentation',
        order: 2,
        content: `Inline documentation has two audiences: the human reading the source, and tools generating API references.

Function docstrings should state the contract:
- What it does (one line).
- Parameters with types and meaning.
- Return value with type and meaning.
- What can go wrong (exceptions, edge-case behavior like "returns None for empty input").

Example shape (Google style):

    def compute_score(predictions, references, k=10):
        """Compute precision@k over prediction/reference pairs.

        Args:
            predictions: list of ranked item ids, best first.
            references: set of relevant item ids.
            k: cutoff, defaults to 10.

        Returns:
            Float in [0, 1]; 0.0 when references is empty.
        """

Rules that keep API docs alive:
- Document non-obvious WHY in comments, obvious WHAT in code names. A comment that restates the code rots.
- Generate reference docs from docstrings (Sphinx, JSDoc) so documentation cannot drift from signatures — it is extracted from the code.
- Document units and shapes: "array of shape (n, 3) in meters", not "the data". Ambiguous units cause real bugs in research code.
- For a public API, note stability: which functions are intended for external use.`,
      },
      {
        title: 'Keeping Documentation Alive',
        order: 3,
        content: `Documentation fails not from bad writing but from drift. These practices keep it true.

1. Docs change with code — make it a review rule: any pull request that changes behavior must update the README/docstrings in the same PR. Reviewers check it.
2. One source of truth — do not duplicate the same instructions in README, wiki, and comments. Link instead; duplicated docs get updated in one place and rot in the others.
3. Executable docs — runnable examples (notebooks marked "Run me", doctest-style snippets) fail loudly when they stop working.
4. Changelogs and migration notes — when an interface changes, a short CHANGELOG entry saves every downstream user an hour of debugging.
5. A docs folder with purpose — docs/ for long-form guides (architecture, data schema, methodology); README for the fast path.

Citation and licensing are part of documentation:
- LICENSE file at the root — no license means no legal permission to reuse.
- CITATION.cff — lets GitHub show a "Cite this repository" button and tools parse the citation.
- A citation section in the README with BibTeX for the paper AND a software DOI (Zenodo).

The health check: can a new lab member answer their own question from docs alone? When they ask something the docs should have covered, add it the same day.`,
      },
    ],
    quiz: [
      {
        question: 'A pull request changes how the CLI arguments work. Where must the documentation be updated?',
        options: [
          'In a separate PR next month, once the release is ready',
          'In the same pull request, so docs and behavior change atomically',
          'Nowhere — users should read the source code',
          'Only in the wiki, which is decoupled from releases',
        ],
        correctAnswer: 1,
        explanation:
          'Docs updated in the same PR cannot drift from the code and are reviewed alongside the change. Delayed doc updates rot because the context is lost.',
      },
      {
        question: 'Which statement best describes how research software should treat citation?',
        options: [
          'Citation only matters for the paper, not the code',
          'A CITATION.cff / BibTeX + software DOI makes the code itself citable, which is a core part of research documentation',
          'Citation information belongs only in the published article text',
          'The README should not mention citation to stay concise',
        ],
        correctAnswer: 1,
        explanation:
          'Research software is a scholarly output: a CITATION.cff, README BibTeX, and a Zenodo DOI let others credit the code directly, alongside the paper.',
      },
      {
        question: 'What does a function docstring primarily document?',
        options: [
          'The personal schedule of the author',
          'The function’s contract: purpose, parameters, return value, and failure behavior',
          'The full source code of the module again',
          'Only the git history of the file',
        ],
        correctAnswer: 1,
        explanation:
          'A docstring states the contract — what it does, inputs, outputs, and edge cases/exceptions. Comments explain local WHY; names handle obvious WHAT.',
      },
      {
        question: 'Why are executable documentation examples (runnable snippets/notebooks) valuable?',
        options: [
          'They make the README longer and more impressive',
          'They fail visibly when the code changes, turning docs into a test instead of silently going stale',
          'They eliminate the need for unit tests',
          'They are required by MongoDB',
        ],
        correctAnswer: 1,
        explanation:
          'Runnable examples break loudly when behavior drifts, so documentation stays verified. They complement — not replace — the test suite.',
      },
      {
        question: 'A repository has no LICENSE file. What does that mean in practice?',
        options: [
          'It is automatically open source under MIT',
          'No permission is granted to reuse or modify — all rights are reserved by default',
          'GitHub licenses it for you after one year',
          'Only the paper, not the code, is protected',
        ],
        correctAnswer: 1,
        explanation:
          'Without a license, the default copyright applies: others may read it but have no legal right to reuse, modify, or redistribute the code.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 4. Reproducibility & Environment Management
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Reproducibility & Environment Management',
    slug: 'reproducibility-environment',
    description:
      'Make your results re-runnable anywhere: pinned dependencies, recorded randomness, captured configuration, and environment exports.',
    category: 'Reproducibility',
    difficulty: 'Intermediate',
    estimatedMinutes: 35,
    lessons: [
      {
        title: 'Pin Your Dependencies',
        order: 1,
        content: `The most common reproducibility failure is not wrong logic — it is an environment that cannot be rebuilt. "It works on my machine" means the environment was never captured.

Principles:
- Pin exact versions in requirements.txt (numpy==1.26.4, not numpy). Unpinned installs drift: a fresh install six months later gets different versions and different numbers.
- Commit the environment file — requirements.txt (Python), environment.yml (conda), package-lock.json (Node), renv.lock (R). The lockfile IS part of the artifact.
- Record the runtime version: state "Python 3.11" in the README; a note like the output of "python --version" in an environment export helps debugging.
- Regenerate deliberately: upgrading a pin is a reviewed change with a note on what moved, because upgrades can change numerical results.

Minimum viable environment capture:

    python -m venv .venv
    pip install -r requirements.txt   # exact pins
    pip freeze > requirements.lock    # full transitive tree

For containers, pin the base image too (python:3.11-slim, not python:latest): "latest" is a moving target.

The reviewer question this answers: "Can I recreate the exact environment that produced these numbers?" If the answer relies on memory, it is no.`,
      },
      {
        title: 'Containers: Ship the Whole Environment',
        order: 2,
        content: `A container (Docker) packages code, dependencies, and system libraries into one immutable image — the strongest practical guarantee that software runs the same on your laptop, a server, and a reviewer’s machine.

What belongs in an image:
- OS + system libs (libgl1 for OpenCV, etc.).
- The pinned language environment and dependencies.
- The application code.

What does NOT:
- Secrets — pass them at runtime as environment variables, never baked into layers (images are shared and inspectable).
- Large datasets — mount them or fetch them; images should stay small and versionable.
- Results — regenerate them by running the pipeline.

Workflow that keeps images reproducible:
1. Write a Dockerfile with pinned base image and pinned dependencies.
2. Rebuild from scratch on CI to prove the image builds anywhere.
3. Tag images by version (pipeline:v1.2), not just "latest".
4. Publish the image (GHCR/Docker Hub) so others can run results without assembling the stack.

A .dockerignore excluding .git, data/, and outputs keeps builds fast and deterministic.

Containers complement, not replace: you still need pinned application dependencies and recorded seeds inside the image.`,
      },
      {
        title: 'Randomness, Configuration, and Notebooks',
        order: 3,
        content: `Even with a perfect environment, results vary if inputs are not pinned. Three sources of hidden state to control:

1. Randomness — fix and RECORD seeds: random.seed(42), np.random.seed(42), torch.manual_seed(42), and pass seeds into CV splits (KFold(shuffle=True, random_state=42)). The seed belongs in the config you publish, not buried in code.
2. Configuration — no hardcoded paths or magic numbers in scripts. Keep parameters in a config file (YAML/JSON) or CLI arguments committed with the run: learning rate, k folds, thresholds. The config file is the recipe for the experiment.
3. Environment variables — document required vars in .env.example (name + placeholder, never real values); keep real values in .env, which stays untracked.

Notebook hygiene — Jupyter notebooks accumulate hidden state:
- "Restart & Run All" must succeed top-to-bottom before committing or submitting.
- Out-of-order cells produce results no one can reproduce — cells executed against memory that no longer exists.
- Extract reusable logic into importable modules; keep notebooks for exploration and figures.
- Decide consciously about outputs: strip them for clean diffs, or keep them if the notebook IS the artifact (then ensure it is deterministic).

The end state: someone can rebuild the environment, set the recorded seed, run the published config, and get your numbers.`,
      },
    ],
    quiz: [
      {
        question: 'Your requirements.txt lists "pandas" with no version. What is the reproducibility risk?',
        options: [
          'None — unpinned dependencies always install the same version',
          'Different install times can fetch different pandas versions, potentially changing behavior and results',
          'pip refuses to install unpinned packages',
          'The package will not work at all without a version',
        ],
        correctAnswer: 1,
        explanation:
          'Unpinned dependencies float to the latest compatible version, so two installs at different times get different code — and possibly different numerical results. Pin exact versions.',
      },
      {
        question: 'Which of the following should NEVER be baked into a Docker image?',
        options: [
          'The Python interpreter version',
          'Pinned application dependencies',
          'API keys and secrets (they must be injected at runtime)',
          'The system libraries your code needs',
        ],
        correctAnswer: 2,
        explanation:
          'Images are shareable and inspectable layers: baked-in secrets leak. Pass secrets as runtime environment variables and document them in .env.example with placeholders.',
      },
      {
        question: 'You set np.random.seed(42) in your training script. What else must be recorded for full reproducibility?',
        options: [
          'Nothing — a seed alone guarantees identical results',
          'The seed should also be logged alongside the config, versions, and data snapshot used for the run',
          'Only the GPU model',
          'The git commit hash of unrelated projects',
        ],
        correctAnswer: 1,
        explanation:
          'A seed fixes randomness, but identical results also require the same dependency versions, data, and parameters. Record the seed WITH the config/environment as part of the run’s recipe.',
      },
      {
        question: 'A Jupyter notebook shows a chart, but cells were run out of order over hours. What is the main reproducibility problem?',
        options: [
          'Charts cannot be saved from notebooks',
          'Hidden state — the output depends on intermediate variables from earlier runs that a fresh run would not recreate',
          'Notebooks cannot contain random numbers',
          'Out-of-order cells make the file larger',
        ],
        correctAnswer: 1,
        explanation:
          'Out-of-order execution means outputs rely on stale in-memory state. "Restart & Run All" must reproduce everything top-to-bottom; otherwise the notebook is not a reproducible artifact.',
      },
      {
        question: 'What should a committed .env.example contain?',
        options: [
          'Real API keys so new members can start immediately',
          'Variable names with placeholder values — documenting required configuration without leaking secrets',
          'Nothing — it should be gitignored like .env',
          'The full MongoDB connection string of production',
        ],
        correctAnswer: 1,
        explanation:
          '.env.example documents WHICH variables are needed using placeholders, and is committed. Real values live in untracked .env; committing them leaks credentials.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 5. Collaboration & Code Review
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Collaboration & Code Review',
    slug: 'collaboration-code-review',
    description:
      'Work as a team on shared research code: small pull requests, constructive reviews, shared ownership, and credit where it is due.',
    category: 'Collaboration',
    difficulty: 'Beginner',
    estimatedMinutes: 30,
    lessons: [
      {
        title: 'Small Pull Requests, Clear Ownership',
        order: 1,
        content: `The single highest-leverage collaboration habit: keep changes small and described clearly.

Why small pull requests win:
- A 40-line PR gets a real, careful review; a 900-line PR gets a rubber stamp.
- Small changes merge before they conflict, keeping everyone’s branch close to main.
- When something breaks later, git bisect can find the culprit commit.

A pull request that is ready for review:
1. Title says WHAT and WHY: "Fix empty chart when project has no assessments".
2. Description links the issue/task, explains the approach, and notes how it was tested.
3. CI is green — reviewers should not discover broken tests themselves.
4. No unrelated changes — reformatting the whole file in a bug fix hides the real diff.
5. Docs/tests included when behavior changed.

Shared ownership practices:
- Assign a reviewer, but let anyone pick up unmerged PRs — knowledge should not live in one person.
- Use the task board so "who is doing what" is visible without asking in chat.
- Keep discussions in the PR/issue, not only in chat — future contributors search the repository, not your messenger.

If a change grew too large mid-work, split it: refactor PR first, then behavior PR.`,
      },
      {
        title: 'Code Review as a Craft',
        order: 2,
        content: `Review is not about finding fault — it is how a team shares context and catches issues before they reach users. Both roles have responsibilities.

As an author:
- Self-review the diff first: fix what a linter and a second read catch before requesting review.
- Explain the non-obvious parts proactively in the description.
- Respond to feedback with rationale, not defensiveness. "I kept it explicit because readers see the units" is a good answer.

As a reviewer, check in this order:
1. Correctness — does it do what the description says? Edge cases handled? Bugs with severity labels (blocking / nit / question).
2. Tests — do tests cover the new behavior, and do they fail if the change is reverted?
3. Clarity — names, structure, comments on WHY. Could a new member follow this?
4. Docs and scope — README/API updated? Unrelated changes flagged.

Review hygiene:
- Be specific and kind: "This loop recomputes the cache on every call — hoisting it out avoids O(n²)" beats "this is inefficient".
- Approve when the change is good enough to merge — perfectionism on trivia blocks the team; save major concerns for blocking comments.
- Timeliness: review others’ PRs within a day. Slow reviews are the most common reason teams bypass the process.

Disagreement that does not resolve after two rounds: document both positions, decide, and move on — the team’s momentum has value too.`,
      },
      {
        title: 'Credit, Communication, and Onboarding',
        order: 3,
        content: `Research software runs on people. Fair credit and clear communication keep contributors engaged.

Credit practices:
- Commit authorship matters: pair on a machine so both names are on commits, or use Co-authored-by lines.
- Maintain CONTRIBUTORS/ AUTHORS (or use CRediT-style roles for papers) — include the software, not just the paper.
- Thank reviewers in release notes; mention people when their issue report led to a fix.

Communication habits:
- Default to public: decisions in issues/PRs, not private chat, so context survives graduations and departures.
- Write update notes a teammate could act on without you: what changed, what is blocked, what you need.
- Raise blockers early — a stuck PR sitting for days is a team problem, not an individual one.

Onboarding is a documentation exercise:
- A CONTRIBUTING.md with setup steps, code style, and how to get a first issue.
- "good first issue" labels that give newcomers a safe, small entry point.
- A named contact for questions during a contributor’s first week.

Healthy-team signals to watch in reviews:
- Bus factor: if only one person can review a module, spread knowledge deliberately (pair reviews).
- Review latency climbing — a leading indicator that the process is being bypassed.
- New members merging their first PR quickly — a working onboarding path.`,
      },
    ],
    quiz: [
      {
        question: 'Why are small, focused pull requests strongly preferred over one large PR?',
        options: [
          'They make git history shorter',
          'They receive genuinely careful reviews, merge before conflicting, and are easy to bisect when bugs appear',
          'They are required by GitHub limits',
          'They avoid the need for CI',
        ],
        correctAnswer: 1,
        explanation:
          'Large PRs get skimmed (review quality drops), rot and conflict, and obscure which commit introduced a bug. Small PRs get real review and safe, traceable merges.',
      },
      {
        question: 'A reviewer notices a blocking bug in a teammate’s PR. What is the best response style?',
        options: [
          'Merge it anyway to keep velocity, and fix it later',
          'Leave a specific, respectful blocking comment explaining the issue and where it occurs',
          'Open a separate public thread criticizing the author',
          'Silently edit the author’s branch yourself',
        ],
        correctAnswer: 1,
        explanation:
          'A precise, kind blocking comment fixes the defect while preserving trust. Merging known bugs or public criticism damages quality and teamwork; editing someone’s branch without consent breaks ownership.',
      },
      {
        question: 'Where should a design decision about how the team implements a feature be recorded?',
        options: [
          'In a private chat message that only two people see',
          'In the issue or PR discussion, so the rationale is searchable and survives member departures',
          'Nowhere — verbal agreement is enough',
          'In the code comment only, with no link to the discussion',
        ],
        correctAnswer: 1,
        explanation:
          'Public, repository-linked records outlive chat logs and team members. Future contributors search issues/PRs to understand WHY a decision was made.',
      },
      {
        question: 'What does the "bus factor" of a codebase mean, and how do reviews help?',
        options: [
          'How many users the server can serve at once',
          'The number of people who must be unavailable before the project stalls — pair reviews spread knowledge to raise it',
          'The speed of the CI pipeline',
          'How often the team meets each week',
        ],
        correctAnswer: 1,
        explanation:
          'A bus factor of 1 means one person holds all knowledge — a project risk. Rotating reviewers and pair work spread understanding, raising the bus factor.',
      },
      {
        question: 'A new lab member submits their first pull request. What best signals a healthy collaboration process?',
        options: [
          'It waits two weeks until a senior member has time',
          'It gets a timely review with actionable feedback and merges quickly, supported by good-first-issue onboarding',
          'It is merged with no review to be welcoming',
          'They are told to read the entire codebase first',
        ],
        correctAnswer: 1,
        explanation:
          'Fast, constructive review plus a guided entry point (good-first-issue, CONTRIBUTING.md) validates the newcomer and proves the collaboration process works. No review trades welcome for quality.',
      },
    ],
  },
];

export default learningModules;
