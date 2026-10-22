# Assertly: Architecture & Tech Stack (draft for approval)

> "Assertly" is a placeholder name. Everything below is free to run at launch.
> Status: **proposal**. No application code has been changed yet.

## 1. What we are building

A practice platform where QA testers do the whole job, not just find bugs:

**requirement → test plan → test cases → execution → bug reports → test summary**

against realistic systems under test (banking, payments, healthcare…) that contain
**hidden, seeded bugs**. The platform knows the bugs, so it can score what a tester
found, what they missed, and how good their bug reports were.

Product principles:

1. **Easy first.** Guest-first (no sign-up to try), smart defaults, one primary action per screen,
   keyboard shortcuts, empty states that say what to do next, a short first-run guide.
2. **Dense and professional.** Table-first, Jira/Linear-style conventions (see the v4 mockup).
3. **Works without AI.** AI only adds extras. Scoring and matching are deterministic.
4. **Free to run.** Free tiers only until we choose to scale.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js** (App Router) + **TypeScript (strict)** | You know it (DevFlow); one codebase for UI, API and sandbox apps. Today's repo is Next 15.2; we upgrade to the current stable. |
| Styling | **Tailwind** + design tokens from the v4 mockup; **Radix** primitives (already installed via shadcn/ui) | Accessible primitives, our own visual identity. |
| Fonts | IBM Plex Sans / Plex Mono via `next/font` | Distinctive, technical, free. |
| Data fetching | Server Components + **Server Actions**; **TanStack Query** for optimistic UI | Status changes and drag-and-drop must feel instant. |
| Tables | Plain React + pure sort/filter functions (`lib/workspace/selectors.ts`) | TanStack Table v9 was evaluated and skipped: a new API and more machinery than one table with a few hundred rows needs. Revisit if we need virtualization or column pinning. |
| Drag and drop | **@dnd-kit** | Touch + keyboard accessible (the mockup's HTML5 drag is not). |
| Forms / validation | react-hook-form + **zod** (already installed) | One schema for client and server. |
| Database | **Postgres on Neon** (free plan) + **Drizzle ORM** | DevFlow already uses Neon; Drizzle gives typed queries and migrations. |
| Auth | **Better Auth** (open source, self-hosted) | Used in DevFlow; email + password and optional GitHub/Google. |
| Guest mode | Cookie session id + same DB rows with a TTL | Try everything without signing up; claim the work after sign-up. |
| AI (optional) | **Groq** free tier behind a provider adapter | Swap providers by env var; feature disappears if no key. |
| Charts | Hand-built CSS/SVG (stacked bars, matrix) | No heavy chart lib needed. |
| Testing | **Vitest** (unit), **Playwright** (e2e) | The platform is tested the way it teaches, which is a good portfolio signal. |
| CI | **GitHub Actions** | Lint, typecheck, unit, e2e on every push. |
| Hosting | **Vercel Hobby** + Neon | Free. Hobby is non-commercial only. |

### Free-tier facts to keep in mind (checked, but re-verify before launch)

- **Vercel Hobby:** personal, non-commercial use only. Fine for a portfolio; must upgrade or move if we ever charge.
- **Neon free:** scales to zero after 5 minutes idle (first request after idle is slower). Storage cap is reported as 0.5 GB or 1 GB per project; sources disagree, so confirm on Neon's plans page.
- **Groq free:** no card required; limits vary by model and change often, so AI calls are rate-limited and cached on our side.
- **Supabase** was rejected: free projects pause after a week idle, which would take a portfolio link offline.

## 3. System overview

```
Browser
  ├─ Workspace UI  (plans, cases, board, bugs, reports)      /app/...
  └─ Sandbox UI    (the system under test, e.g. NovaBank)    /sandbox/[scenario]/...
          │                         │
          ▼                         ▼
   Server Actions / Route Handlers  ──►  Scoring + Matching engine (pure TS, unit-tested)
          │                         │
          ▼                         ▼
      Postgres (Neon)        Sandbox API  /api/sandbox/[scenario]/...
   users, runs, cases,        (seeded bugs behind a registry; every bug
   results, bugs, scores       trigger is logged as a "bug hit")
```

### The key idea: the bug registry

Each scenario ships a typed registry of seeded defects:

```ts
// src/scenarios/novabank/bugs.ts
export const bugs = [
  { id: 'negative-amount', severity: 'critical', area: 'transfer',
    summary: 'Transfer accepts a negative amount',
    hint: 'Try boundary values around zero.',
    keywords: ['negative', 'amount', '-'] },
  // …
] as const
```

The sandbox code asks the registry (`isActive('negative-amount')`) and, when the buggy
path actually runs, writes a **bug-hit event** for that user's session. That lets us tell
a tester: "you triggered 3 defects, reported 2, and never noticed 1", which is far more
useful than a simple checklist.

**Matching a reported bug to a seeded one** is deterministic first (linked test case +
area + keyword and field rules + whether the hit event exists). AI is only an optional
tie-breaker and a source of written feedback on report quality.

### Sandbox isolation

- Sandbox state is per user/session (rows keyed by `session_id`, TTL cleanup), never shared.
- A visible **Reset sandbox** button restores the starting data.
- Sandbox endpoints are rate-limited per session. No real money, email or third-party calls.
- All user-entered text is sanitized before rendering (testers will try XSS on the sandbox on purpose; the workspace must stay safe).

## 4. Data model (first cut)

```
users(id, name, email, …)                      -- Better Auth tables + profile
sessions_guest(id, created_at, claimed_by)
scenarios                                      -- static, defined in code (not a table)
enrollments(user_or_guest, scenario_id, started_at)
requirements(scenario_id, key, title, text)    -- static content per scenario
test_plans(id, owner, scenario_id, title, scope, environment, status)
test_cases(id, owner, plan_id, key, summary, priority, requirement_key,
           preconditions, steps jsonb, tags)
test_runs(id, owner, plan_id, name, build, environment, started_at, closed_at)
test_results(run_id, case_id, status, actual jsonb, executed_by, updated_at)
bugs(id, owner, run_id, case_id, key, summary, severity, steps, expected, actual,
     attachments, status)
bug_hits(session_id, scenario_id, bug_id, at)  -- written by the sandbox
bug_matches(bug_id, seeded_bug_id, confidence, quality jsonb)
exploratory_sessions(id, owner, charter, timebox, notes, started_at, ended_at)
activity(id, owner, type, ref, at)
scores(owner, scenario_id, points, grade)
shared_reports(token, run_id, created_at)      -- public read-only links
```

Status values: `notrun | in_progress | passed | failed | blocked`. Statuses are enums in
code and the DB so the table, board and report can never disagree.

## 5. Routes

```
/                              landing (what it is, try as guest)
/app                           For you (assigned work, runs in progress)
/app/[scenario]/cases          Test cases (table, default)
/app/[scenario]/board          Board (drag between statuses)
/app/[scenario]/plan           Test plan editor
/app/[scenario]/bugs           Bugs
/app/[scenario]/exploratory    Charters and timed sessions
/app/[scenario]/report         Test summary (live)
/r/[token]                     Shared, read-only report
/sandbox/[scenario]/…          The system under test
/learn                         Fundamentals track (today's 12 challenges)
```

## 6. Repo layout

```
src/
  app/                  routes only (thin)
  features/             cases/ runs/ board/ bugs/ reports/ plan/ exploratory/
  components/ui/        design-system primitives built from the tokens
  scenarios/            novabank/ paylane/ …   (app UI, API, bugs.ts, requirements)
  engine/               scoring, matching, report builder (pure TS + tests)
  db/                   schema.ts, migrations, queries
  lib/                  auth, ai (provider adapter), rate-limit, utils
docs/                   ARCHITECTURE.md, ADRs, scenario authoring guide
tests/                  unit/ e2e/
```

## 7. Roadmap

| Phase | Goal | Done when |
|---|---|---|
| **0 Foundation** | Rename, design tokens, app shell (sidebar + top bar), strict TS, lint, CI, git. Fix known bugs in the existing 12 challenges. | App runs with the new shell; CI green. |
| **1 Workspace core** | Test cases table, board with dnd-kit, drawer, keyboard shortcuts, live report, using a local-first data layer (guest mode). | A tester can write cases, run them and see a report without an account. |
| **2 First scenario** | NovaBank sandbox with the bug registry, bug-hit logging, scoring, bug report form, hints. | Finding and reporting seeded bugs is scored end to end. |
| **3 Accounts + persistence** | Better Auth, Neon + Drizzle, claim guest work, share links. | Work survives refresh and device change. |
| **4 Depth** | Test plan editor, exploratory sessions, 2–3 more scenarios, requirement traceability matrix. | Full QA lifecycle covered. |
| **5 Launch** | Optional AI feedback, onboarding tour, PDF export (print CSS), docs, README + case study. | Public and portfolio-ready. |

The 12 existing challenges become a **Fundamentals** track under `/learn`.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Free-tier limits change | Provider adapters, env-driven config, re-check before launch |
| Neon cold start after idle | Skeleton states; guest work cached locally until synced |
| Abuse of sandbox endpoints | Per-session rate limits, TTL cleanup, no external side effects |
| AI quota exhaustion | AI is optional, cached, rate-limited; core scoring is deterministic |
| Scope creep | Phased roadmap; each phase ships something usable |

## 9. Decisions

| Decision | Outcome |
|---|---|
| Name | **Assertly** |
| Database timing | Local-first in Phase 1 (repository layer in between); Neon + Drizzle in Phase 3. Firebase was considered: it suits simple document access, but this data is relational (runs, results, cases, requirements, bugs), reports need joins and aggregates, Firestore bills per read, and Cloud Storage now needs a paid plan. |
| Next.js | **16.4** from the start (latest stable at kickoff). |
| Repo | Build locally with git; public later (MIT). Never commit secrets: `.env*` is ignored, document variables in `.env.example`. |

## 10. Phase 0 outcome (done)

- git initialised; Next.js 16.4, React 19.3, TypeScript strict, ESLint 9 (flat config), Vitest, CI workflow.
- Error suppression removed from the build (`ignoreBuildErrors`, `ignoreDuringBuilds`); lint, typecheck, tests and build are all clean.
- Design tokens and app shell from mockup v4; routes: `/app`, `/learn`, `/learn/[slug]`.
- Fundamentals logic rebuilt: pure scenario detection that mirrors the server validators (62 tests, including a check against the real server actions), a `useSyncExternalStore` store, no stale completion check, no hydration warning.
- Fixed mislabelled scenarios (negative age, rate limits, select/date/file rate-limit ordering) and added missing ones (age out-of-range, leading zeros, rate limiting everywhere).
- Pruned 31 unused UI components and 28 unused packages; removed duplicate files and a stale lockfile.
- react-day-picker upgraded to v9 and vaul to v1 (both needed for React 19).
- Local Fundamentals progress from the old build is not migrated (new storage key).

## 11. Phase 1 progress (workspace core)

Done:
- **Data layer:** typed model (`lib/workspace/types.ts`), a pure reducer with explicit actions (create, update, status, move, delete), selectors, a zod form schema, and a browser-local store with undo and cross-tab sync (`store.ts`). The store is the only module that touches storage, so Phase 3 swaps it for the database. A starter NovaBank project is seeded on first visit.
- **Test cases table** (`/app/novabank/cases`): search, status and priority filters, sortable columns, row and bulk selection, hover quick actions, empty and loading states, and keyboard control (J/K, Enter, P/F/B, X, C, /, Esc).
- **Case drawer:** create and edit with validation (react-hook-form + zod), steps editor (reorder, add, remove), immediate status picker, activity history, unsaved-changes and delete confirmations.
- Undo toast on every status change, create and delete.
- 95 unit tests across the learn, workspace and formatting logic.

- **Board** (`/app/novabank/board`): @dnd-kit with mouse, touch and keyboard sensors, sunken lanes, raised cards, overlay elevation while dragging, screen-reader announcements, and Undo. Pure column logic (`lib/workspace/board.ts`) is unit-tested, including a round-trip proving the board and the store always agree.
- **Design pass:** type scale, weights, elevation levels and spacing documented in `docs/design/foundations.md`; JetBrains Mono for keys and code.

- **Test summary report** (`/app/novabank/report`): `lib/workspace/report.ts` is a pure, tested builder. Verdict rules: no executions means not started; any failure means not ready; no failures but work remaining means incomplete; all passed means ready. Coverage per requirement is one of no cases, not run, partial, passing or failing. Risks and next steps are derived from the same data. Print styles hide the app chrome and force the light palette.

- **End-to-end tests** (`tests/e2e`, Playwright against a production build on port 3100): the table (keyboard flow, filters, bulk actions, persistence), the case drawer (validation, tags, discard guard), the board (mouse and keyboard drags, cancel, undo, table agreement), the report (verdict, headings, live updates, empty project, print behavior and a real PDF export), and the Fundamentals challenges.
- **Accessibility pass:** automated axe-core scans (WCAG 2.0/2.1 A and AA) of every page, the open drawer and the drawer with validation errors, in light and dark mode; plus keyboard checks (skip link, visible focus on every Tab stop). Fixed: sidebar group labels and status-pill counts below 4.5:1 contrast, a progress bar with no name and no value (the stock component never forwarded `value`), and a missing skip-to-content link.
- **Print review (from a real exported PDF):** background colors were dropped (bars and the coverage matrix vanished) until `print-color-adjust: exact` was added; added a print-only brand header.

- **Theme without a provider:** `next-themes` rendered a `<script>` from a client component, which React 19 warns about (visible after Fast Refresh). Replaced by `lib/theme.ts` plus an inline script in the server-rendered root layout: no flash of the wrong theme, no script in any client component, no dependency. Guarded by a unit test, and by a dev-mode console test that fails on any console error or hydration warning.
- **Do not share `.next` between a dev server and builds.** Running `next build` (or the e2e suite) against the same folder as a running `next dev` can leave that server serving mismatched client and server code, which shows up as hydration errors. The e2e suite now uses its own folders. If you see a hydration error in dev: stop the server, delete `.next`, restart, and hard-refresh the tab.

Phase 1 is complete. Deferred from the mockup to later phases: bug and seeded-defect assessment (Phase 2), share links (Phase 3).

Bugs found and fixed while testing in the browser (board): the first dragover could fire before React re-rendered with the drag state and silently skip the move; keyboard dragging between lanes failed because lane droppables lacked the sortable metadata dnd-kit's keyboard helper reads.

Bugs found and fixed while testing in the browser (table and drawer): Enter opened the drawer and the same keypress then activated the newly focused status button (fixed with preventDefault and by focusing the drawer container); shortcuts were ignored during the drawer's closing animation (now only open dialogs block them).

## 12. Phase 2 progress (NovaBank sandbox and scoring)

Done:
- **Defect registry** (`lib/sandbox/novabank/bugs.ts`): ten seeded defects (1 critical, 3 high, 4 medium, 2 low) with severity, requirement, expected behavior, two hints, and text signals used for matching. This file is the answer key; nothing in it is shown to the tester until a defect is found or a hint is revealed.
- **Engine** (`engine.ts`): NovaBank's behavior as pure functions (state in, state out). Each defect is a deliberate deviation switched on by an `active` set, and records a **bug hit** only when the faulty path actually runs. 39 unit tests check every defect with the switch on and off.
- **Sandbox app** (`/sandbox/novabank/*`): sign in, accounts, transfer (form, review, confirm), activity, with its own layout and an "Assertly test environment" ribbon. State lives in a browser store (`assertly:sandbox:novabank:v1`), separate from the workspace. "Reset sandbox" keeps the hit log: that log is the tester's evidence.
- **Bug model:** `BugReport` (key, title, severity, linked case, steps, expected, actual, environment) with reducer actions for create, update, delete and hint reveal. Old stored workspaces are migrated on load (empty bugs and hints).
- **Scoring** (`lib/workspace/scoring.ts`, pure and tested): a report matches a defect when its text clears the signal rule (a strong signal counts 2, a weak one 1, at least one strong and a total of 3 or more; +1 if the linked case covers the same requirement). A match only earns points when the sandbox recorded a hit for that defect, otherwise it is "Not reproduced". A second report of the same defect is a "Duplicate". Quality is 0 to 10 (title, steps, expected, actual, linked case, correct severity). Points are the severity base (40/30/20/10) times (0.5 + quality/20). Each revealed hint costs 5 points; the total never goes below zero. Maximum is 230.
- **Bugs page and report form**, prefilled from a failed test case (`?case=<id>`); a Defects section and a Hidden defect assessment in the test summary (found, triggered but not reported, not found, with hints); a Requirements page with acceptance criteria (`lib/workspace/requirements.ts`, kept out of the stored state so it needs no migration); a bugs metric on For you.
- **Tests:** 178 unit tests; 95 end-to-end tests including the sandbox flows, scoring, hints, the new pages in the accessibility and dev-console checks.

Decisions and notes:
- The sandbox runs in the browser for now. Because the answer key ships to the client, a determined user could read it; that is acceptable for a practice tool and goes away when scoring moves to the server in Phase 3.
- Sandbox state is local to one browser, like the workspace. Phase 3 stores both per user.
- The summary shows only the requirement for a defect that has not been found. Severity and points appear once it is found or triggered.

Bug found while building: a visually hidden label (`sr-only`, absolutely positioned) inside the scrolling content area escaped it and stretched the whole page, leaving a blank strip under the sidebar. Fixed by making the content area `relative`; guarded by an e2e test that reveals a hint and asserts the window never scrolls.

Left for later in Phase 2/3: SMS alerts (REQ-04) are not implemented in the sandbox and are documented as untestable; more scenarios arrive in Phase 4.

## 13. Phase 3 progress (accounts, saving, share links)

Done:
- **Database** (`lib/db`): Drizzle ORM on Postgres. With `DATABASE_URL` it uses Neon over HTTP; without it, PGlite (Postgres compiled to WebAssembly) stored in `.data/pglite`, migrated on first use. One code path, no external service needed to develop or test. Nothing connects at import time, because Next imports route modules during the build. Schema: Better Auth's four tables, `workspace_doc` (one row per user holding the workspace and sandbox documents plus a revision number) and `share`. Migrations live in `drizzle/`; production applies them deliberately with `npm run db:migrate`.
- **Accounts** (`lib/auth.ts`, `/api/auth/*`, `/sign-in`, `/sign-up`): Better Auth with email and password, GitHub when configured. Sessions are cookies. `?next=` only redirects within the site. Email verification is off until an email service exists.
- **Saving** (`lib/persistence`, `/api/workspace`): the app stays local-first. Every change lands in the browser store at once; a controller copies it to the server about 800 ms later and again when the tab is hidden. Saves carry the revision they were based on; if another device saved first the server answers 409 and this device adopts the newer copy. The server validates and bounds everything it stores (zod, size caps, known defect ids) and accepts writes only from the same site.
- **Claiming guest work:** on first sign-in the browser's workspace becomes the account's. If the account already has one, the server copy wins and this browser's copy is kept under `assertly:guest-backup:v1`. Signing out clears the browser's copy so the next person on a shared computer does not see it.
- **Share links** (`/api/share`, `/s/[id]`): a frozen snapshot built on the server from the user's stored workspace, never from what a request carries. It holds the report, defects, score and found defects, and nothing about defects not found. Revocable by the owner only; an unknown or revoked link is a plain 404. `noindex`. Up to 20 active links per user.
- The report was split into a hook-free `ReportDocument` so the live page and the public page render the same document.
- **Tests:** 203 unit tests (repository against in-memory Postgres, including optimistic concurrency and revoke rules; payload validation; a leak test proving a snapshot excludes unfound defects; an on-disk database test) and 120 end-to-end tests (sign up and in, errors, claiming guest work, two devices, sign-out clearing, stale writes refused, anonymous access refused, share links public/read-only/revocable, only the owner can revoke, accessibility scans of the new pages in light and dark).

Decisions and notes:
- Scoring stays in the browser. The repository is public, so server-side scoring would not hide the answer key; the share snapshot is what must never leak it, and it does not. The cost is that a shared score is not tamper-proof.
- A document per user (not normalized tables) because the app is built on one pure reducer over one state object; the server needs no knowledge of cases or bugs. Revisit if cross-user features (teams, leaderboards) arrive.
- Bug found while checking in the real dev server: PGlite does not create its parent folder, so a fresh clone failed on first sign-in while every test (in memory) passed. Now fixed and covered by an on-disk test.
- Postgres `jsonb` does not keep object key order, so a document read back differs textually from the same document in the browser. Documents are compared in a canonical (sorted-key) form; without it every page load looked like a change and announced "Loaded your saved workspace". The e2e check for this uses a one-time count, because `toHaveCount(0)` retries until the toast fades and passed even with the bug.
- Accessibility finding: inline links distinguishable only by color failed WCAG (link-in-text-block). Now underlined.

Left for later: email verification and password reset (needs an email service), per-session rate limit for the Fundamentals challenge submissions, merging guest work into an existing account instead of keeping a backup, and trying GitHub sign-in with real credentials.

## 14. Phase 4 progress (depth)

Order agreed: test plan editor, then exploratory sessions, then a second scenario.

**Test plan editor (done)**
- **Model:** one `TestPlan` per project (`plans` in the workspace document): title, objective, requirements in scope, out of scope, approach, types of testing, environment, entry criteria, risks, and structured `ExitCriteria` (executed percentage, pass rate, maximum critical and high bugs, every in-scope requirement has a case). Reducer action `plan/save` creates or replaces; saving unchanged content returns the same state.
- **Closing the loop:** `evaluatePlan` (pure, `lib/workspace/plan.ts`) checks exit criteria against real results. Execution and pass rate count only cases linked to in-scope requirements; bug counts are project-wide; an empty scope never counts as a pass. The plan page shows the live status, the test summary gets a "Test plan and exit criteria" section with a Met / Not met table and an overall verdict, and a share link carries the same section.
- **Template:** `planTemplate(project)` gives a sensible starting plan (project-specific for NovaBank, including the SMS-gateway risk for REQ-04), so a tester edits instead of facing a blank page.
- **Migration:** `migrateWorkspace` (new, `lib/workspace/migrate.ts`) fills in fields that older saved documents lack. It now runs on every load from the browser and from the server; before, a document saved by an older version and read back from the server would not have been migrated. Add a line there whenever a field is added. The server schema defaults `plans` to `[]`.
- **Form UX:** validation runs on Save and then live as you fix things, not on blur. Blur validation inserted an error message above the control about to be clicked, shifting the page between mouse-down and mouse-up so the click missed (found by an e2e test). The report's sections are now numbered as they render, so optional sections never leave a gap.
- **Tests:** unit tests for the template, reducer, evaluation (scope, thresholds, empty scope, optional criterion), form schema, migration, payload and snapshot; 11 e2e tests for the editor and the summary, including a critical bug breaking otherwise-passing results; accessibility scans of the empty page, the editor with errors, and the summary with a plan, in light and dark.

**Data-loss race found and fixed in saving (affects every feature):** a change made and followed within the first second by a full page load (a typed address, a hard refresh, a link that is not a client navigation) was lost: the new page asked the server, saw an older copy than the browser's, and adopted it. Two safeguards now work together. (1) The page sends a last-gasp save on `pagehide` and when hidden. (2) The browser records what it knows about the server in `assertly:sync:v1` (account, last revision seen, whether it holds unsent changes) and also notices changes made while the server copy is still loading; on the next load, if the browser holds unsent changes and nobody else has saved since, it sends its copy instead of adopting the server's. Each safeguard alone masked the other in tests, so the e2e tests were verified against both removed; a separate test sets up "unsent work left by an earlier visit" directly. A server copy that is ahead (another device saved) still wins, and the browser's copy is kept under `assertly:guest-backup:v1`.

**Exploratory sessions (done)**
- **Model:** `ExploratorySession` (key ES-001, charter, area, time-box of 15/30/45/60/90 minutes, status planned, running or ended, start and end times, timestamped notes of four kinds, debrief) plus `nextSessionNumber`. Reducer actions create, update, start, end, add and delete a note, delete. Rules are enforced in the reducer, not the UI: only a planned session starts, only a running one ends or takes notes, an ended session is closed (but its debrief stays editable), starting twice never resets the clock. Deleting a session keeps its bugs and unlinks them. Bugs gain an optional `sessionId` (absent on older bugs, treated as unlinked).
- **Time:** the reducer stays pure: actions carry the timestamp, and elapsed time is derived (`elapsedMs`, `timeboxState`: within, almost, over). `useNow` is one shared clock that ticks each second only while something is subscribed, and reads 0 on the server and during hydration so the timer never causes a hydration mismatch; pages tick only while a session is actually running.
- **UI:** sessions list with metrics and a new-session drawer (charter examples that teach the shape without pointing at where any defect is), a session page (plan, timer with a time-box bar and warnings, keyboard note composer, bugs found with a "report a bug from this session" link, debrief), and a "Sessions" nav item. `/bugs?session=<id>` opens a report already linked to the session.
- **Summary and sharing:** a new "Exploratory sessions" section (time spent against the box, notes by kind, bugs, the debrief) appears when sessions exist, in the live report and in share links. "Exploratory" joined the plan's types of testing.
- **Tests:** unit tests for the reducer rules, clock and time-box states, row building, migration, server validation and the bug link; 17 e2e tests including a controllable clock (`page.clock`) to check the "almost out of time" and "time-box reached" warnings and that an ended session's time stops; accessibility scans of the new pages in light and dark; sharing.
- **Test-suite lessons:** accessibility scans now wait for running animations to finish, because a toast caught mid-fade is half transparent and briefly fails contrast; a test that re-opens a confirmation dialog must wait for the first to finish closing.

**Next:** a second scenario with its own seeded defects, then a traceability matrix.

## 15. Onboarding (tour, path, sidebar)

Added because the platform had grown past what a newcomer can take in at once. The principle: simple first, complexity on request, and always a visible "what next".

- **Sidebar** (`components/shell/nav-config.ts`): regrouped in the order the work happens, Learn, Plan (Requirements, Test plan), Test (the NovaBank app, Test cases, Board, Sessions), Report (Bugs, Test summary). The practice app is in the list as a new-tab link, because it is the thing being tested. Breadcrumbs now name every page (they showed the raw route segment before).
- **Tour** (`components/onboarding/tour-dialog.tsx`, steps in `lib/onboarding/tour.ts`): seven short steps, plain words, each with one "take me there" action. A modal, because it asks for attention once; offered only on the home page and only to someone who has never dismissed it, never on a deep link. Skip, Escape and finishing all count as done. Focus starts on Next, arrow keys step, the step counter is announced. Reopen from the sidebar or the home page.
- **Your path** (`lib/onboarding/path.ts`, `hooks/use-path.ts`): thirteen steps in three levels (Start simple, Do it properly, Go deeper), computed from real data so it cannot be ticked by clicking: a test case is "yours" only if its number is above the starter set, a session counts only when ended with notes, exit criteria need a plan. Two steps leave no trace in the data ("read the requirements", "read the summary"), so opening those pages records a flag in this browser. Nothing is locked.
- **Local, not synced, on purpose:** the tour-dismissed flag and the opened-pages flags live in this browser only (`lib/onboarding/flags.ts`). Putting a page view in the synced workspace would bump the saved revision on every visit and clobber Undo. The cost: a second device shows the tour again and two path steps unticked. Signing out clears both, so the next person on that computer starts fresh.
- **Tests:** unit tests for the path rules (including that the starter project's executed cases are not progress) and the tour; e2e for the tour (first visit, not forced elsewhere, Next/Back, keyboard, skip and Escape persist, reopen, finish, new-tab link, accessibility on first and last step in light and dark), the path (ticks from real actions), the sidebar order and breadcrumbs. Playwright now goes through `tests/e2e/fixtures.ts`, which marks the tour dismissed so it does not block unrelated tests; tour tests opt out with `test.use({ tourDone: false })`.
- One intermittent failure was seen once (four light-mode accessibility checks failing in a single full run, message not captured) and did not reproduce in three further full runs or in a threefold repeat of that spec. Noted, not explained.

## 16. Launch checklist (data and first impressions)

The platform will look new at launch because nothing here is shared:
- **Production database:** create a fresh Neon database and run `npm run db:migrate`. It starts empty. Nothing from development reaches it; the development database is the gitignored `.data/` folder on this machine.
- **Visitors:** every new visitor gets the starter project and an empty path. Test data in this browser's storage (`assertly:*` keys) is local to this browser.
- **Before launching:** delete `.data/`, check that no `assertly:*` development data or personal test accounts were ever created against the production database, set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, and decide the landing page (Phase 5).
- If the stored data shape changes after launch, add a line to `migrateWorkspace`; do not bump the storage key, which would discard people's work.

