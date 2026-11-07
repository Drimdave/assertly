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
/account                       Account: name, password, delete (signed in only)
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
- **Accounts** (`lib/auth.ts`, `/api/auth/*`, `/sign-in`, `/sign-up`): Better Auth with email and password, GitHub when configured. Sessions are cookies. `?next=` only redirects within the site. Password reset and email confirmation work when email is configured (section 18).
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

Left for later: per-session rate limit for the Fundamentals challenge submissions, merging guest work into an existing account instead of keeping a backup, and trying GitHub sign-in with real credentials.

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
- **Model:** `ExploratorySession` (key ES-001, charter, requirement (optional), time-box of 15/30/45/60/90 minutes, status planned, running or ended, start and end times, timestamped notes of four kinds, debrief) plus `nextSessionNumber`. Reducer actions create, update, start, end, add and delete a note, delete. Rules are enforced in the reducer, not the UI: only a planned session starts, only a running one ends or takes notes, an ended session is closed (but its debrief stays editable), starting twice never resets the clock. Deleting a session keeps its bugs and unlinks them. Bugs gain an optional `sessionId` (absent on older bugs, treated as unlinked).
- **Time:** the reducer stays pure: actions carry the timestamp, and elapsed time is derived (`elapsedMs`, `timeboxState`: within, almost, over). `useNow` is one shared clock that ticks each second only while something is subscribed, and reads 0 on the server and during hydration so the timer never causes a hydration mismatch; pages tick only while a session is actually running.
- **UI:** sessions list with metrics and a new-session drawer (charter examples that teach the shape without pointing at where any defect is), a session page (plan, timer with a time-box bar and warnings, keyboard note composer, bugs found with a "report a bug from this session" link, debrief), and a "Sessions" nav item. `/bugs?session=<id>` opens a report already linked to the session.
- **Summary and sharing:** a new "Exploratory sessions" section (time spent against the box, notes by kind, bugs, the debrief) appears when sessions exist, in the live report and in share links. "Exploratory" joined the plan's types of testing.
- **Tests:** unit tests for the reducer rules, clock and time-box states, row building, migration, server validation and the bug link; 17 e2e tests including a controllable clock (`page.clock`) to check the "almost out of time" and "time-box reached" warnings and that an ended session's time stops; accessibility scans of the new pages in light and dark; sharing.
- **Test-suite lessons:** accessibility scans now wait for running animations to finish, because a toast caught mid-fade is half transparent and briefly fails contrast; a test that re-opens a confirmation dialog must wait for the first to finish closing.

**Next:** a traceability matrix (done: 14c). The second scenario this section once named became the practice systems in 14b.

## 14b. Practice systems (NovaBank, Cobalt Goods, Lendwell and Marlowe Clinic)

The platform assumed one system. Adding the online shop meant first making "a practice system" a thing, then building the shop on it; Lendwell and Marlowe Clinic then went in with no changes to the registry, only a new entry each.

- **Registry** (`lib/systems`): a `SystemDef` bundles everything the workspace needs to test one system: slug, name, difficulty, where its app lives, build label, **answer key** (its seeded defects), its project and requirements, starter test cases, acceptance criteria per requirement, plan defaults and session charter examples. Adding a system is writing one of these and listing it in `registry.ts`. Everything that used to say "NovaBank" (scoring, the summary, the sidebar, the plan template, the requirements page, bug reports' environment, share links) now asks the registry for the project it is looking at.
- **Scoring is per system.** `assess(reports, cases, hits, hints, bugs)` takes the system's registry, and the hit log is per system, so a defect triggered in the shop is never credited to NovaBank. `lib/sandbox/types.ts` holds what every system shares (severities, points, the shape of a seeded defect and of a hit); each system keeps its own typed defect ids.
- **Sandbox state is saved per system**: `{ novabank, shop, loans, booking }`. `lib/sandbox/stores.ts` puts every practice app's browser store behind one interface (sync, reset, hits). `normalizeSandboxes` upgrades the old single-NovaBank format, so documents saved before there were two systems still load and still pass server validation.
- **Upgrading existing workspaces:** `migrateWorkspace` now also adds the starter project of any system a saved workspace has never seen. It seeds relative to the document's own newest timestamp, not the clock, so the same document always migrates to the same result; otherwise a browser and the server would disagree about a document neither changed.
- **Cobalt Goods** (`lib/sandbox/shop`, `/sandbox/shop`): catalog, cart with quantity box and coupons, checkout with Standard and Express shipping and test cards, order confirmation and history. All money is integer cents and the engine is pure. Ten defects across the cart (a quantity of zero or less; a quantity above stock), coupons (stacking; a coupon surviving a cart that falls below its minimum), shipping and tax (tax on shipping; $75.00 not getting free shipping; tax cut off instead of rounded), payment (an earlier month this year accepted; an email like a@b accepted) and orders (the cart not emptied, so it can be ordered twice). The points total 230, like NovaBank. Defects that show up in the numbers on screen are logged by a `recordQuote` call while the page is displayed; the rest when the faulty path runs.
- **Lendwell** (`lib/sandbox/loans`, `/sandbox/loans`, advanced): a four-step application (about you, work and money, the loan, review), a live quote with the monthly payment, APR, fee and total cost, an approve / refer / decline decision and a list of applications. The form checks each step (an applicant must be 18 or older, amounts run from $1,000 to $50,000, phone numbers are digits). The decision is then a pure function of the application: declined if the applicant is unemployed, the credit score is under 580 or the debt-to-income ratio is above 45%; referred for a score of 580 to 639 or a ratio above 36%; approved otherwise. Ten defects, in the places where loan software really breaks: boundaries (exactly 18 today, exactly $50,000, a score of exactly 580, a ratio of exactly 45%), calculations (the payment formula, the 48-month APR surcharge, the total cost leaving out the 2% fee), validation (a phone number of letters), a rule that is simply missing (an unemployed applicant approved) and state (going back after submitting and submitting again creates a second application). Points total 230.
  - **The ratio is rounded to one decimal before it is compared.** Compared unrounded, "exactly 45%" can only be reached with income and debt that divide evenly, so the boundary defect would be almost impossible to trigger on purpose. The rounded ratio is also what the page shows, so what a tester sees and what the rule uses agree.
  - **Draft, then submit.** The wizard keeps a draft that survives Back and refresh; only Submit makes an application. The submit-twice defect lives in that gap: the faulty build lets a second Submit on the same draft create another record, the correct one returns the first. A defect that needs a sequence of actions, not one bad input, is what makes this system the hard one.
  - **Dates.** The age rule depends on today, so tests fix the browser clock (`page.clock.setFixedTime`) rather than depend on the day they run.
- **Marlowe Clinic** (`lib/sandbox/booking`, `/sandbox/booking`, expert): three services (30, 60 and 90 minutes) booked through four steps (service, date and time, details, review), a confirmation with a reference, a list, cancelling and rescheduling. Opening hours are Monday to Friday 9 to 5, Saturday 9 to 1, closed on Sundays, 11 November and 25 December; start times are every 30 minutes and an appointment has to end by closing; today's times are offered from two hours from now; bookings go up to 60 days ahead; a Saturday adds a $10 surcharge; cancelling with less than 24 hours' notice costs half the price. Ten defects, 230 points: the diary not blocking the times a longer appointment covers (critical), times that have already passed offered today, rescheduling leaving the original behind, a closed day being bookable (high), day 61 accepted, Saturday afternoon times offered after closing, the Saturday surcharge never charged, and exactly 24 hours' notice being charged a fee (medium), and noon shown as AM and the list not soonest first (low). What makes it the hardest system to test is that almost every rule depends on the date, the time now or what is already booked.
  - **A clock the engine never reads.** The engine is pure, so "now" is a `Clock` handed in by the caller: a date (`YYYY-MM-DD`) and minutes since midnight at the clinic. Only the browser store builds one, from the browser's own clock and time zone, so 10:00 on your computer is 10:00 at the clinic. Every date and time inside the engine is wall-clock arithmetic on those two values, with no time zones and no daylight saving. The cost is that the clinic is wrong for someone booking from another time zone; for a practice system that is the right trade, and the unit tests need no time zone at all. A clock hook (`useClock`) gives components a stable object for each minute, so rendering stays pure.
  - **Availability is asked, not stored.** The diary is the list of appointments; which times are free is computed each time for a service and a date (`dayView`), including why a time is not free. That one function is the specification of REQ-02 and REQ-03, and the defects are switches inside it. Rescheduling asks it with the appointment's own time left out, which is why an appointment can move onto a time that overlaps its old one.
  - **What counts as "triggered".** A defect the tester can see on a screen is logged while that screen shows it: the availability defects when a day's times are on screen, the surcharge on the review step, the noon and sort defects when an appointment or the list is shown. A defect that needs an action (the cancellation fee, rescheduling) is logged when the action is taken. All of them use the same test as the other systems: ask once with every defect off and once with only this one on, and if the answers differ the defect is visible. The sort defect is logged only when the order shown is actually different from the right one, because a tester who happened to book in date order has seen nothing wrong.
  - **Tests need a fixed moment and a fixed time zone.** The browser tests run on Friday 23 October 2026 at 10:00 (`page.clock.setFixedTime`) with `timezoneId: "UTC"`; the one cross-system test that runs in the machine's own zone uses a defect (a closed day a month ahead) that does not depend on the time of day. The time of day matters for the lead-time rule, and a test that books "today" is the one case where it does.
- **Switching:** a native `<select>` at the top of the sidebar keeps you on the same page of the workflow for the other system. The home page has a Practice systems panel with progress in each. "Your path" and the tour follow all of them (see 15).
- **Found while building:** (1) a data-loss race in saving: when a page is replaced the instant it sends a save, that save can land on the server while its reply is never seen, so on the next page the browser thought the server was ahead because of another device and adopted it, overwriting an edit made in the first moments. The browser now counts saves it started that were never answered, so it can tell its own late-landing save from another device's; (2) the open state of every Radix Select in the app trips the `aria-hidden-focus` accessibility rule. It was never caught because no test scanned a select while open. The new switcher was made native to avoid adding another, and the older ones were fixed afterwards (see 14d).
- **Shared pieces:** the form field used by all three practice apps with forms (`components/sandbox/field.tsx`) was copied into the shop and Lendwell; Marlowe Clinic was the third copy, so it is one component now. The ribbon (`components/sandbox/ribbon.tsx`) was already shared.
- **Tests:** unit tests for the engine (correct behaviour, then each defect on and off with its hit, mutation-checked), the registry, scoring per system, migration and the server schema; e2e for the shop's, Lendwell's and the clinic's normal flows and all ten defects of each through the real screens (the clinic's include the time and the time zone being fixed), scoring and hints per system, the shop's workspace, switching, upgrading an old workspace, and saving every system to an account (including accepting the old format).

## 14c. Traceability matrix

A requirement is only as tested as the things that point at it, so the matrix answers one question per requirement: what traces back to it, and what is missing.

- **What traces to what.** A test case and an exploratory session each name a requirement directly (on a session this is the optional Requirement field; it used to be labelled "Area", which read as a different thing). A bug does not: it traces through the test case it was found by, and failing that the session it was found in. The test case wins when both are set, because it is the more specific link. A bug with neither, or whose case or session names no requirement (or one the project does not have), cannot be traced and is listed apart. `lib/workspace/traceability.ts` is a pure function of a project, its cases, sessions and bugs; the page (`/app/<system>/traceability`) only draws it.
- **Coverage is the test summary's rule.** The row's lozenge uses the same `coverageState` as the summary's coverage table (exported from `report.ts`), so the two pages cannot disagree about what "failing" means.
- **Gaps** are the three things a reviewer would ask about: a requirement with no test cases, a requirement whose test cases have never been run, and a failed test case with no bug reported against it (matched by the bug's test case, so a bug logged loosely for the same problem does not close it). They are listed in requirement order above the matrix, with the totals (requirements covered, passing, with a failing case, bugs traced) in the usual metric strip.
- **Every key is a link that opens the item.** That needed the cases and bugs pages to accept `?open=TC-005` and `?open=BUG-001`: the drawer opens on load, and closing it removes the parameter so a refresh does not reopen it (the same pattern the bugs page already used for `?case=` and `?session=`). Keys, not ids, because they are what a person sees and types; an unknown key opens nothing.
- **Colour is never the only signal.** Every chip carries the word for its state (Passed, Failed, Critical, Ended) beside its dot.
- **Removed:** the home page's "Coming next" card, whose last item was this.
- **A third saving race, found by this feature's test run:** the cross-system account test failed under load, and only there. The page can be used before the app has learned who is signed in (the session check is a request), and a change made in that gap was in neither of the places the sync looks for unsent work: the saved meta (an earlier page never saw the change) and the watch that `startSync` runs while loading (not running yet). With the server one copy "equal" in revision, the sync concluded nothing of the browser's was newer and adopted the server's copy, silently replacing, for example, a NovaBank sign-in made a moment after the page opened. The evidence was in the guest backup the sync takes just before adopting: it already contained the change. The sync now watches the stores from the moment it is loaded, so changes made before it starts count as unsent. A regression test holds the session check back, signs in to NovaBank meanwhile, and fails 3 of 3 times without the fix. Worth knowing: on a fast machine the window is a few milliseconds; on a slow connection it is as long as the session request.
- **Tests:** unit tests for the builder (the starter project, an empty one, each way a bug can be traced or fail to be, other projects' data ignored, natural ordering of keys with a case that distinguishes it from text ordering), mutation-checked; e2e for the matrix, the gaps, a bug reported from a case, sessions and loose items, the links opening items and closing cleanly, every system's own matrix, switching systems from the page, and an accessibility scan with bugs, sessions and untraced items present. One mutation was not caught: the cases page's own check that an open drawer blocks keyboard shortcuts is redundant with its check for any open dialog, so changing it is not observable.

## 14d. Dropdowns and the inert app

While a Radix dropdown is open it hides the rest of the page from assistive technology (`aria-hidden`), yet the page behind still holds links and buttons that can be focused. The accessibility rule `aria-hidden-focus` refuses that. Dialogs and drawers escape it because their overlay tells the checker the page behind is meant to be out of reach; a dropdown has no overlay. It went unnoticed because no test had scanned a dropdown while open.

- **Cause, confirmed:** every dropdown outside a dialog failed the scan (five places: the priority filter on test cases and on the board, the two filters on the Fundamentals list, the Fundamentals select challenge, the requirement picker on a session page), and the one inside a drawer passed, as the overlay explanation predicts. The newest Radix Select (2.4.1) still hides the page without making it inert, so upgrading would not have helped.
- **Fix** (`components/ui/select.tsx`): while the list is open the app root (`#app-root`, set on the shell, id in `lib/app-root.ts`) is `inert`, so what is hidden is also unreachable, and it is released the moment the list closes so focus can return to the trigger. If something else already made the root inert it is left alone, and the effect cleans up when the dropdown unmounts mid-open (a client-side navigation under an open list). axe accepts `inert`; a native `<select>`, the fallback, was not needed.
- **A second find:** the Fundamentals select challenge labelled its control with `htmlFor="country"` but the control had no such id, so the label named nothing. It has the id now.
- **Tests** (`tests/e2e/selects.spec.ts`, written first and failing for the right reason): an open-state scan of each of the five page-level dropdowns and of one inside a drawer, in light and dark; the app is inert while open and not after choosing, after Escape, after the page changes under an open list, or after a dropdown in a drawer closes; and the keyboard still works inside the list. Removing the cleanup fails five of them. One test was racing, not wrong: Radix moves focus to the next item in a `setTimeout`, so two key presses a millisecond apart take one step, which a person never does; the test now waits for focus after each key.

## 14e. Two more saving races

The cross-system account test failed in three of five full runs, always the slow ones, and was first put down to load. Keeping the complete output and then logging inside the sync showed it was two real races, both of which lose a user's change. (The first one found is in 14c.)

- **A refused save adopted the older copy, even when the refusal was the browser's own doing.** A page that is left sends a last-gasp save that nobody sees answered. If it lands after the next page has read the server but before that page sends its own, the second is refused for being one revision behind, and the sync took that to mean another device had saved and replaced the browser's newer copy with the server's. The sync now works out whether every revision it is behind by is one of its own earlier saves (the `sent` count already kept in `assertly:sync:v1` says how many could have landed); if so, nobody else saved, the browser's copy is the newer one, and it is sent again on top. If a revision is not accounted for, another device did save, and its copy is still adopted. A last-gasp save never retries, and a retry happens once. Reproduced deterministically by sending the earlier save from inside the test just before the page's own, which fails without the fix: the edited case goes back to "Not run".
- **A change made while a page's first save was in flight was never sent.** Sync stops watching for edits once it has read the server and only starts listening again when its first save has finished. An edit in that gap was recorded locally but never scheduled, and stayed unsent until something else changed (and the last-gasp save was not attached yet either). It now looks for unsent changes as soon as it is listening again. Reproduced by holding the first save open, changing another case meanwhile, and releasing it: without the fix the second change never reaches the server.
- **How they were found:** the output of a failing run is the evidence, so the run now keeps all of it. A request log was not enough (last-gasp saves cannot be seen from the page), so a temporary trace inside the sync, printed only on failure, showed the sequence: a save answered with a revision the next page did not expect, and a last save with nothing after it. Both reproductions are in `tests/e2e/account.spec.ts`.
- **What remains:** on this 16 GB machine with its other applications (RAM full, five gigabytes being compressed, a load average above 100) four browsers and two servers in parallel can still time out a page load. At two workers the test passed 16 times in 16. The suite has not been made to run at a lower concurrency; it is worth doing if it is run on a machine like this.

## 14f. Wording and notes for beginners

A review of how easy the platform is to pick up found it fine for someone who already tests, and steeper for a beginner, for two reasons: one thing had two names, and several terms were never explained.

- **"Area" is now "Requirement".** A session's optional link to a requirement was labelled "Area" on the form, "Requirement" on the session page and nothing on the table, and the empty choice read "Anywhere". It is "Requirement" in all three places, the empty choice is "No requirement", and the table cell shows the key and title or "None". `SessionRow.area` became `SessionRow.requirement`. (The defect `area` label, a short word shown once a hidden defect is triggered, is a different thing and kept.)
- **Old share links keep working.** A share link stores its snapshot as JSON and it is never rewritten, so links made before the rename hold `area` where new ones hold `requirement`. The summary reads either (`rowRequirement` in `lib/workspace/sessions.ts`, three unit tests, checked by taking the fallback out); without it an old link would quietly lose the requirement line under each session.
- **Notes beside the terms**, as text and not tooltips (see `docs/design/foundations.md`, "Explaining terms"): severity (with what each level means), found by test case, found in session, environment, priority (and that it is not severity), a test case's requirement, acceptance criteria, exit criteria, what the coverage words mean (one exported string, `COVERAGE_NOTE`, used by the test summary and the traceability matrix), and how the hidden-defect score is earned. The session's Requirement field is also tied to its note with `aria-describedby`.
- **Layout check:** the bug drawer's severity note is the longest, so the two-column row beside it aligns to the top (`items-start`) instead of stretching.
- **Tests** (`tests/e2e/hints.spec.ts`, 7): the label and the empty choice, the described-by link, the table heading and cell, each drawer's notes, the requirements page, the shared coverage wording on both pages, and the summary's two notes. The session field in the bug drawer only exists once a session does, and the test says so. Mutations checked: the old "Area" label put back, the priority note removed, the coverage note emptied. The screenshots were regenerated and looked at, because the notes changed the drawers' height.

## 15. Onboarding (tour, path, sidebar)

Added because the platform had grown past what a newcomer can take in at once. The principle: simple first, complexity on request, and always a visible "what next".

- **Sidebar** (`components/shell/nav-config.ts`): regrouped in the order the work happens, Learn, Plan (Requirements, Test plan), Test (the NovaBank app, Test cases, Board, Sessions), Report (Bugs, Traceability, Test summary). The practice app is in the list as a new-tab link, because it is the thing being tested. Breadcrumbs now name every page (they showed the raw route segment before).
- **Tour** (`components/onboarding/tour-dialog.tsx`, steps in `lib/onboarding/tour.ts`): ten short steps, plain words, each with one "take me there" action. Nine of them point at the real sidebar item (`data-tour` markers from `nav-config.ts`): the page is dimmed with a cut-out around the item, a pulsing ring marks it, and the cut-out and the card glide to the next item on Next (a guard test fails if a step points at an item that does not exist). The dimming is the highlight's own huge `box-shadow`, so the hole and the dim cannot drift apart; a zero-size box paints no shadow, so "nothing to point at" is a 2px speck in the middle. On a phone there is no sidebar, so the card is simply centered. For people who ask for reduced motion it neither glides nor pulses. A modal, because it asks for attention once; only Skip or Escape ends it (a stray click on the page does not); offered only on the home page and only to someone who has never dismissed it, never on a deep link. Skip, Escape and finishing all count as done. Focus starts on Next, arrow keys step, the step counter is announced. Reopen from the sidebar or the home page.
- **Your path** (`lib/onboarding/path.ts`, `hooks/use-path.ts`): seventeen steps in four levels (Start simple, Do it properly, Go deeper, Take it further), computed from real data so it cannot be ticked by clicking. "Try a Fundamentals challenge" counts once one is started (a first version waited for a whole challenge to be completed, which felt broken to someone who had clearly begun). A test case is "yours" only if its number is above the starter set, a session counts only when ended with notes, exit criteria need a plan. Two steps leave no trace in the data ("read the requirements", "read the summary"), so opening those pages records a flag in this browser. Nothing is locked.
- **Local, not synced, on purpose:** the tour-dismissed flag and the opened-pages flags live in this browser only (`lib/onboarding/flags.ts`). Putting a page view in the synced workspace would bump the saved revision on every visit and clobber Undo. The cost: a second device shows the tour again and two path steps unticked. Signing out clears both, so the next person on that computer starts fresh.
- **Tests of the spotlight:** each step's highlight is checked against the real position of its sidebar item(s) once it has settled, the card is checked to sit beside it and fully on screen, Back returns the highlight, the glide is checked (sampled midway, and by its transition), and a phone and reduced motion are covered. Test helpers wait for animations to finish before an accessibility scan, but skip animations that loop forever (the ring), or they would wait for ever.
- **Tests:** unit tests for the path rules (including that the starter project's executed cases are not progress) and the tour; e2e for the tour (first visit, not forced elsewhere, Next/Back, keyboard, skip and Escape persist, reopen, finish, new-tab link, accessibility on first and last step in light and dark), the path (ticks from real actions), the sidebar order and breadcrumbs. Playwright now goes through `tests/e2e/fixtures.ts`, which marks the tour dismissed so it does not block unrelated tests; tour tests opt out with `test.use({ tourDone: false })`.
- One intermittent failure was seen once (four light-mode accessibility checks failing in a single full run, message not captured) and did not reproduce in three further full runs or in a threefold repeat of that spec. Noted, not explained.

### The tour and the path across systems

Both were written when NovaBank was the only system, and said so: the tour's copy and links were fixed to it, and the path counted only its work. They now know about every system.

- **The tour is built for the system you are on** (`buildTour(system)`): its name and tagline, its app, and its pages, so reopened from a Lendwell page it is about Lendwell. Two steps were added: choosing a system (it names every system, easiest first, and points at the switcher, which carries `data-tour="switcher"`) and the traceability matrix (a `data-tour` marker on that sidebar item). The count in the step counter and the copy about how many systems there are come from the registry. The first-visit tour is on the home page, which is about NovaBank, the easiest system.
- **The path counts the skills in any system.** Writing a test case, running it, reporting a bug, linking it to a case or a session, planning, running a session and meeting a plan's exit criteria are done wherever the tester did them (a plan and the criteria it is measured by must be in the same system). What stays tied to NovaBank is the easy start ("try the NovaBank app", "find a hidden defect" in level 3). A "test case of your own" is one numbered above that system's own starter set, which differs by system, and a unit test executes exactly the last starter case of every system to hold that boundary (a mutation shifting it by one survived until it did).
- **Level 4, "Take it further":** a hidden defect to find in each of the other systems, one step per system read from the registry (so a fifth system adds a step by itself), each ticked by that system's own matched reports and nothing else. A new step in level 2 asks the tester to open the traceability matrix, recorded with the same page-seen flag as the requirements and the summary.
- **Why not one path per system, or the last system you used:** the skills are the point, not where they are practised, and a path that resets for each system would tell someone who has just learned to report a bug that they have not. The cost is that a generic step's link goes to NovaBank's page; the sidebar switches system.
- **Tests:** unit tests for the path rules over every system and for the tour for every system (mutation-checked: seven changes to the rules, then the boundary, were each caught) and e2e for the new steps, the tour reopened on each system's page, a hidden defect found in Cobalt Goods ticking its own step only, a case written in Lendwell counting, and the marker wiring (four mutations caught).

### Button colors and the dev-server warm-up (follow-ups)

- **Action colors** follow one convention, written down in `docs/design/foundations.md` ("Color of actions"): solid blue for the main action, neutral for everything else, red for what deletes, discards or cannot be taken back. Before this, every confirmation button was blue, including Delete and Discard. `AlertDialogAction` now takes `destructive`; `Button` gained `destructive-outline` (the opener for a risky action, e.g. End session) and `destructive-ghost` (a quiet Delete). Sign out stays neutral on purpose: nothing is lost by it. `tests/e2e/buttons.spec.ts` reads the colors the browser actually painted (not class names) and was checked to fail against the old blue buttons.
- **Warm-up:** the dev-server console test and its warm-up now share one route list (`tests/e2e/routes.ts`). The warm-up had six routes while the test visited thirteen, so newer pages compiled cold inside parallel tests and timed out under load. Verified with an empty dev cache.

## 16. Launch checklist (data and first impressions)

The platform will look new at launch because nothing here is shared:
- **Production database:** create a fresh Neon database and run `npm run db:migrate`. It starts empty. Nothing from development reaches it; the development database is the gitignored `.data/` folder on this machine.
- **Visitors:** every new visitor gets the starter project and an empty path. Test data in this browser's storage (`assertly:*` keys) is local to this browser.
- **Before launching:** delete `.data/`, check that no `assertly:*` development data or personal test accounts were ever created against the production database, set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, and (the landing page is done: see 16b) check the metadata that needs the real address, below.
- **Dependencies:** run `npm audit` and check for a newer patch of Next.js right before launch (and after, regularly). The dev overlay warned that 16.4.0 had a critical advisory (unauthenticated remote code execution in the image optimizer and in `use cache`, and a denial of service through Server Actions); it was upgraded to 16.4.2 with the whole suite re-run. What `npm audit` still reports is the Tailwind 3 and ESLint build tooling, which never ships to users; its suggested "fix" is a downgrade, so it is left until the Tailwind 4 move.
- If the stored data shape changes after launch, add a line to `migrateWorkspace`; do not bump the storage key, which would discard people's work.

## 16b. Landing page

`/` used to redirect into the app, so a stranger arrived in a workspace with no explanation. It is now a page of its own (`app/page.tsx`, parts in `components/landing/`), a server component with almost no client code.

- **What it follows, and a mistake worth recording.** The design references sent at the start of the project were 12 product screens (task boards, a detail panel, Jira dashboards, a dark and light pair) plus logo variations. A first landing page was built from notes about them, not from the images, and looked like documentation: small type, a small card for a product, boxes of text. The products those screens come from have landing pages, and they were never looked at. Jira's and Linear's pages were opened and studied, and the page was rebuilt on what they share: a large plain headline, the real product shown big and framed directly under it and cropped by the fold, a few words per section each tied to a piece of the product, a dark band for the explanation, one solid button. Structure and feel only; no copy, imagery or layout is copied.
- **Type:** two sizes added for this page only, `text-display` (56/60) and `text-display-sm` (36/40, also the hero on a phone), recorded in `docs/design/foundations.md`. The app never goes above `heading-xl`.
- **The product frame** (`product-frame.tsx`) is drawn with the app's own pieces, not a screenshot: it stays sharp, follows the theme and uses the real status dots, lozenges and tokens. The board shows NovaBank's real starter test cases, read from the registry. The bug in the side panel is invented and deliberately not one of the ten hidden in NovaBank, because the page is public and the defects are the point; a test fails if any defect title or expected result in any system appears on the page. It is hidden from assistive technology and has nothing in it to tab to, and its title is a paragraph, not a heading, so the page's heading outline is not affected.
- **The dark band** (`scoring.tsx`) is the app's dark theme applied to one section (`className="dark"`), so it is black and blue whatever the page theme, using real tokens (a test reads its computed colour in the light theme). Its sample test summary (`score-panel.tsx`) uses the app's own wording for found, triggered and not found. A first draft of the copy said a missed defect is revealed at the end; the app only narrows it to a requirement, and the copy was corrected against the code.
- **One source of truth:** the system cards read the registry (name, difficulty, tagline, requirement titles, counts of requirements, starter cases and defects), and the words "four" and "ten" in the copy and the page description come from it (`components/landing/counts.ts`). A unit test checks every system hides the same number of defects, so one number can describe them all; add a system and it appears, with its own link, without touching the page.
- **Conventions kept:** one solid blue button in view (the hero's; the header's account link is an outline or ghost, and the closing band's button is white on blue), a skip link like the app's, one `h1`, no skipped heading level (tested).
- **A bug the redesign introduced and the tests caught:** the closing button on the blue band was white text on a white button (an outline button inherits its section's text colour). The axe scan caught it in the dark theme only, so a test now compares the button's text colour with its own background.
- **Signed in?** The header and footer ask the same session the app already loads: "Your workspace" instead of "Sign in" and "Create an account". It renders as a visitor first, then switches, which costs a word changing on a signed-in visit.
- **Not done, on purpose, until there is a real address:** `metadataBase`, a social preview image (the `opengraph-image` file convention), `robots` and `sitemap`. Relative URLs in metadata are a build error without `metadataBase`, so these belong with deployment.
- **Tests:** 16 e2e (stays at `/`, the steps, every system from the registry with its links, the scoring claims, the links go where they say and every internal link answers, headings, the skip link, theme, a 360px phone with no sideways scroll, the signed-in header, the product frame, no defect named anywhere, the dark band, a readable closing button), accessibility scans in light and dark, the page in the console check, and the registry test above. Mutations checked: a broken link, a skipped heading, a wide element, the old redirect, a defect title on the page, the dark scope removed, the closing button's colour removed.

## 16c. Screenshots

The README's pictures are generated, not captured by hand, so they can be regenerated when the interface changes and cannot quietly go stale.

- **`npm run screenshots`** (`playwright.screenshots.config.ts`, `scripts/screenshots/screenshots.spec.ts`) builds the app into its own folder (`.next-shots`), starts it on port 3200 with an in-memory database, and writes the images to `docs/screenshots/`. It is not part of the test suite and is not run by CI. The browser is fixed (1440 by 900 at 1.5x, UTC, the `en-GB` locale, a clock fixed at 23 October 2026, animations and carets off), so the same code gives the same pictures.
- **One story, told through the real screens:** NovaBank tested for an afternoon: three of its hidden defects found and reported (one linked to a session), two triggered but not reported, an own test case, a plan from the template, an exploratory session, a Fundamentals challenge started, the requirements read, and one defect each found in Cobalt Goods and Lendwell. The state is put in with the same browser storage the app itself writes (the way the tests do), and the plan, the Fundamentals challenge and the requirements go through the screens.
- **The story is checked before any picture is taken:** the summary must show three defects found, two triggered and five not found; the shop and Lendwell one each; the path 15 of 17; the traceability matrix three of three bugs traced; the bug drawer must hold the bug it is meant to. A change to the app or to the scoring that breaks the story fails the script instead of producing a wrong image.
- **What looking at the first run caught:** the board's fourth column (the failures) was cut off at 1280 pixels, so the viewport is 1440; the score was below the fold of the summary, so there is a second shot scrolled to it; a tester who had found three defects had not read the requirements or tried a Fundamentals challenge, so the story now does; a bug's title opened selected in blue, which looks like a mistake, so it is unselected first. Looking at the landing page's picture also found a real defect in the page: the "Sample" label on its product frame sat at the right-hand end of a title bar that the bug panel is drawn over, so it was in the page and invisible. It moved next to the breadcrumb, and a test now checks where it is, not only that it exists.
- **Size:** eleven pictures of 100 to 320 KB, about 2.3 MB, kept as PNG (flat colour and text compress well).

## 17. Account page

Until now an account could be made and signed into, and nothing more: no way to change a password or leave. Both are expected, and deleting matters once real people's data is held.

- **`/account`** (`app/(shell)/account/page.tsx`, `components/account/*`, linked from the sidebar next to Sign out). The server checks the session and redirects a guest to `/sign-in?next=/account`, so there is no flash of the page; the rest is client-side. Three blocks: Profile (edit the name; the email and the sign-in methods are shown), Password, Delete account. Name and password rules live in `lib/account/schemas.ts` and sign-up uses them too, so the two cannot disagree.
- **Password.** Needs the current one; the new one is 8 to 128 characters and must differ. A checkbox, on by default, signs out the other devices (`revokeOtherSessions`); this device stays signed in either way. An account with no password (GitHub only) is told so instead of being shown the form. Which methods an account has comes from Better Auth's `list-accounts`.
- **Delete.** Turned on in `lib/auth.ts` (`user.deleteUser.enabled`; it is off by default). A confirmation dialog, with the password typed in when the account has one; a wrong password keeps the dialog open and deletes nothing. Every table that points at a user cascades, so the saved workspace, the sessions and the share links go with it, and a share link then answers 404. Afterwards this browser's copy is cleared too (`wipeLocalCopy`, shared with sign-out) and the person lands on the front page.
- **Two paths clear the browser's copy, on purpose.** The sync controller clears it when it sees a signed-in session end, and that would happen here too, after a second request. The delete flow also calls it directly, so deletion never depends on that request succeeding. A mutation check showed the test cannot tell the two apart (removing either alone still passes), so it was checked with both removed: it then fails on the case still reading "Passed". The test checks the outcome, not which path produced it. An earlier comment in the code claimed nothing else would clear it; that was true of a hard page load, and false once the flow used the router. It was corrected.
- **A stolen session cannot delete an account.** Better Auth lets a delete through with no password if the session is "fresh", and its default for fresh is a day. `session.freshAge` is five minutes, so a password is the only way in for anyone who did not just sign in. Someone with no password (GitHub only) has to have signed in within five minutes, and otherwise is asked to sign in with GitHub again.
- **What is not verified, and why.** The GitHub-only pages are tested against a mocked `list-accounts` and a mocked "session expired" answer, because the GitHub sign-in needs real credentials; the real flow is untested until they exist. The five-minute window is a setting, read in the library's code and not exercised, because a test would have to wait five minutes.
- **Look and feel.** Both forms use outline buttons, not solid blue: the colour rules allow one solid blue button per screen, and neither form is the main thing on a page of three. The delete opener is a red outline and the confirm button inside the dialog is solid red.
- **A trap in the tests:** Next.js keeps an empty, hidden `role="alert"` on every page to announce route changes, so a bare `getByRole("alert")` always finds one. The tests look for alerts that contain text.
- **Tests:** 13 e2e in `tests/e2e/account-settings.spec.ts` (the redirect and the return; what the page shows; renaming and reload; wrong, short and unchanged passwords, then the new one signing in and the old one not; other devices signed out or kept, both ways; a wrong password deletes nothing; deleting removes the login, the share link and the browser's copy; the two GitHub-only cases; accessibility in light and dark, with and without the dialog open; a 360 pixel phone) and 9 unit tests for the rules. Mutations checked: other devices never signed out, a wrong password closing the dialog, both clearing paths removed.
- **Not done:** changing the email address (the email service now exists; it needs confirming the new address first), setting a password on a GitHub-only account (a reset already does it: the library creates the password when there is none), a list of signed-in devices to end one by one, and downloading your data.

## 18. Password reset and email confirmation

A lost password could not be recovered, and an address was never checked. Both need email, so this adds a small mailer and builds both on it. Nothing here needs choosing a provider to be built or tested; choosing one is a configuration step.

- **The mailer** (`lib/email/`): a message is plain strings (`types.ts`), written by pure functions (`templates.ts`), and sent by one of three transports (`transports.ts`): Resend over HTTP (one `fetch`, no library), an in-memory outbox for the tests, and the terminal for development. `config.ts` picks one from the environment, as a pure function. `sendMail` never throws: a failed email is logged (subject and transport, never the address, the link or the key) and must not fail the sign-up or password change it belongs to.
- **Off is a state, and the launch default.** In production with nothing configured, email is off: the sign-in page has no "Forgot your password?" link, `/forgot-password` says it is not available yet, the server refuses a reset request too, and the account page says nothing about confirming. A second copy of the production build is started with no email settings to test that (`email-off` in `playwright.config.ts`, port 3102).
- **Half a configuration is an error, not a fallback.** A key with no sender, no site address, or an unknown `EMAIL_TRANSPORT` throws. `BETTER_AUTH_URL` is required for real sending because Better Auth otherwise builds the links from the request's Host header, which anyone can forge: a reset email could carry a link to someone else's site with the token in it. Found while testing: with no address set, the link came out relative.
- **The memory transport only runs at home.** It keeps messages where `/api/test/outbox` can show them to the browser tests, which would hand out reset links to anyone who asked. It is refused for any address that is not localhost and on Vercel, and the route answers 404 unless that transport is the one running (unit tests cover each case, and the email-off server checks the 404 for real).
- **Asking for a reset reveals nothing about who has an account.** The words are the same for every address. The time was not: Better Auth waits for the email to be sent, so an address with an account took longer. Sending now happens after the response (`after()` from Next, kept alive by the host; outside a request it simply runs), and a test with a provider that takes 600 ms checks that both answers come back in under 300. Not covered: the same address asking over and over to annoy its owner. Better Auth's built-in limit is three a minute per client address, not per target address.
- **The reset link** is single-use (the library claims it with one atomic delete, so it works on Neon over HTTP, which has no transactions), expires after an hour (the number the email states is the number configured), and on use ends every session, because someone resetting a password may no longer be the only one with the account. The owner is emailed a notice with no link in it. The reset page tells browsers not to send the address on as a Referer and not to index it. Confirm-password is asked because a typo there locks someone out.
- **Confirming an address** sends a link at sign-up and does not stop anyone using the app: this is a practice tool, and a mistyped address should not lock a learner out. The link proves the address, not who is holding it, so it signs nobody in; opened with nobody signed in it goes to sign-in and then to the account page. The account page shows "Confirmed" or "Not confirmed" with a button to send it again. `requireEmailVerification` is the switch if that ever needs to change.
- **What the mutation checks found.** An intended "custom rate limit" on the two routes that send email was a copy of the library's own default, and removing it changed nothing, so it was deleted and the tests now guard the limiter being on (they fail with it off). Breaking each of these made exactly the matching tests fail: sending in the background, ending sessions on reset, the one-hour expiry, the limiter, the sign-up landing page, the outbox guard, the referrer policy, the email-off sign-in page, the email-off reset page, and the badge shown with email off.
- **Tests:** 43 unit (`tests/email`: the choice of transport case by case, the templates and what a typed name cannot do to them, Resend's request and refusals, the outbox and its cap, `sendMail` failing quietly, the guarded route); 14 integration (`tests/auth/email-flows.test.ts`, the real configuration on an in-memory database: links that expire, work once and end sessions, the answer's timing, confirmation, the rate limits); 24 e2e (`password-reset.spec.ts`, `email-off.spec.ts`: the whole way round by reading the emails, identical answers for unknown addresses, links used twice or while open elsewhere, other devices signed out, accessibility in light and dark in every state, a phone).
- **Not verified:** a real visitor has never been emailed (and cannot be until a domain is verified: Resend's testing sender only reaches the account's own address). One real email did go out on 2026-11-07, through our own transport and the real reset template, from `onboarding@resend.dev` to the Resend account's own address; Resend's log shows it **Delivered**. How it looks in the inbox, and whether it lands in spam, were not checked. The request matches Resend's published "Send Email" page (read on 2026-11-07): `POST https://api.resend.com/emails`, `Authorization: Bearer <key>`, and the fields `from`, `to` (a string or an array), `subject`, `html`, `text`. That page does not state the shape of an error, what happens before a domain is verified, or a rate limit, so the code assumes none of them: on any non-success it logs the status and the first 200 characters of what Resend said. Whether a mailbox provider accepts the mail depends on the sending domain's DNS records (SPF, DKIM), which are set up in Resend, not here. A link's expiry is tested with a faked clock against the library, not by waiting an hour.
- **To switch it on:** create a Resend account, verify a domain, then set `RESEND_API_KEY`, `EMAIL_FROM` (an address on that domain) and `BETTER_AUTH_URL` where the site is hosted. Nothing else changes.

## 19. Hosting (Vercel and Neon, both free)

Live at **https://assertly.vercel.app**. Everything is on free plans by choice, and there is no domain of our own yet.

- **Vercel (Hobby)** builds every push to `main` and serves it. The project was imported from `Drimdave/assertly` with the Next.js preset and no code changes beyond `vercel.json`. Settings: `BETTER_AUTH_SECRET` (a random secret; pasted by the owner, never shown or stored anywhere else) and `BETTER_AUTH_URL` (`https://assertly.vercel.app`). Preview deployments reuse that address, so links and cookies on a preview point at production; previews are not used.
- **Neon (Free)** holds the accounts, saved work and share links: project `assertly`, region AWS US East 1 (N. Virginia), next to Vercel's default servers. It was linked with the Neon integration for an existing Neon account (access limited to this one Vercel project), which sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` for the project. Nobody copied a connection string.
- **The schema is applied by the build** (`vercel.json`): it runs `drizzle-kit migrate` against the direct (unpooled) address, and only then `next build`. A failing migration fails the build and nothing new goes live. With no `DATABASE_URL` it skips the migration. This replaces running `npm run db:migrate` by hand; the script is still there for local use.
- **Neon over HTTP has no transactions.** The app's own writes are single statements (a compare-and-swap on a revision number), and Better Auth is configured without transactions, so nothing depends on them. That is from reading the code and the library, and from the live site answering a sign-in correctly; it has since been run end to end against Neon with a real account: the first GitHub sign-in (section 21) created the user, the account and the session, and the first save of the workspace went through ("All changes saved").
- **Email is off on the live site, deliberately.** Resend will only deliver from its testing sender to the address on the Resend account, and will not verify a domain we do not own, such as `vercel.app` (Resend's own documentation). Offering "Forgot your password?" that silently reaches nobody would be worse than not offering it, so with no email variables set the site hides it (section 18). To switch it on later: own a domain, verify it in Resend, then set `RESEND_API_KEY`, `EMAIL_FROM` and keep `BETTER_AUTH_URL`.
- **Checked on the live site, with read-only requests** (no accounts created in production): the front page, sign-in and app load; `/account` sends a signed-out visitor to sign in; a sign-in for an unknown address answers 401 "Invalid email or password" (so the account tables exist; a missing table would be a 500); `/forgot-password` says it is unavailable and the sign-in page has no reset link; `/api/test/outbox` is a 404.
- **Not done yet:** a sign-up with an email and a password has not been tried on the live site (nobody may enter passwords on a production site, so it has been tested only on this machine); the delete flow has not been tried live.

## 20. Being found and shared: robots, sitemap, preview image, visit counter

The site now has a real address, which these all needed.

- **The address** (`lib/site.ts`): `siteUrl()` is `BETTER_AUTH_URL` if set, else the production address Vercel reports (`VERCEL_PROJECT_PRODUCTION_URL`), else `http://localhost:3000`. Never read from a request, whose Host header can say anything (the same reason the email links need `BETTER_AUTH_URL`). It sets `metadataBase`, and builds the sitemap's and robots.txt's addresses. A blank or unreadable value falls back instead of failing the build.
- **robots.txt** (`app/robots.ts`): crawlers may read `/` and `/learn`; kept out are the API, `/app` (a person's own workspace), `/sandbox` (the practice systems: for using, and they would only clutter results), `/account`, shared reports (`/s/`, which are also marked `noindex`), and the sign-in pages. The list is `PRIVATE_PATHS` in `lib/site.ts`, read by robots.txt and by the tests. robots.txt asks politely; it is not security.
- **sitemap.xml** (`app/sitemap.ts`): the front page, Fundamentals and its twelve challenges, read from the same list the site uses. No last-changed dates: nothing tracks them, and an invented one is worse than none. Tests check that every address in it loads and that none of them is one robots.txt keeps crawlers out of.
- **The preview picture** (`app/opengraph-image.tsx`): 1200 by 630, drawn at build time from the real brand mark and light-theme colours, with the front page's own headline and counts (read from the registry, so they stay true) and the workflow's steps. It names no hidden defect. The first drawing put the address text against the last step, and the real address is longer than the one used while checking, so the address moved to the top right; found by looking at the picture, not by a test. The renderer's built-in font is used, so there is no network call and no font file to keep. The tags (`og:*`, `twitter:*`) say a large-image card on every page; the front page and the defaults share one title (`SITE_TITLE`). The front page had said "summary" (the small card); the unit and browser tests now fail if it does.
- **The visit counter** is Vercel Web Analytics (`@vercel/analytics`, free on the Hobby plan: 50,000 events a month, 30 days of history, no custom events). It sets no cookies and stores nothing personal. It is only rendered when `VERCEL` is set, so local runs, the tests and CI make no request to a third party and see no failed script load; a browser test checks exactly that, and it fails if the condition is taken out. Turned on once in the Vercel dashboard (Analytics, Enable, the Hobby option, not the $20 Pro one). **Checked live in a real browser:** the script is added to the page, loads (200) and sends the page view (200). On Vercel the script's address is a random first-party path (`/<hash>/script.js`, events to `/<hash>/view`), not `/_vercel/insights`, so a check by that path alone would have reported "not there" while it was working; the script is recognised by the `data-sdkn` attribute the package puts on it.
- **Tests:** 11 unit (`tests/site/site.test.ts`: the address rules, robots, the sitemap, consistency between them) and 7 e2e (`tests/e2e/seo.spec.ts`: robots.txt, the sitemap and every page in it, the tags, the picture's size and PNG header, a Fundamentals page's title, the counter staying off). Mutations checked, each failing the tests aimed at it: a private page in the sitemap, the picture file missing, the small card back, the counter always on.
- **Not done:** the picture has not been looked at in a real link preview (a chat app, LinkedIn's inspector); only the file and its tags were checked. A search engine has not been told about the sitemap (Search Console needs a login and, for a `vercel.app` address, is optional). The front page's description is longer than some previews show.

## 21. GitHub sign-in

- **The OAuth app** is registered on the owner's GitHub account as "Assertly": homepage `https://assertly.vercel.app`, one allowed return address, `https://assertly.vercel.app/api/auth/callback/github`. Wildcard matching (which would let tokens go to other addresses) and device flow are off. It asks for the profile and email addresses (`read:user`, `user:email`) and nothing more, and never sees a password.
- **The settings** are on Vercel, for Production only: `GITHUB_CLIENT_ID` (readable, it is public) and `GITHUB_CLIENT_SECRET` (a true secret). The secret was generated on GitHub, copied to the clipboard without ever being displayed, pasted by the owner into Vercel, and the clipboard then cleared. Previews do not offer GitHub: their address is not the registered one. `lib/auth.ts` already turned GitHub on when both are present, and the sign-in page only shows the button then.
- **An email that already has an account is the dangerous case.** Sign-up here does not require confirming the email (and with email off nobody can). So a stranger could register someone else's address with a password of their own; if the owner then signed in with GitHub and the two were joined, the stranger would still hold the password. The library refuses to join a GitHub login to an existing account whose email was never confirmed, and refuses when GitHub itself has not confirmed the email. That is its default; it is now written out (`account.accountLinking`) and a test fails if it is turned off (checked: breaking it fails exactly that test). The cost: while email is off, someone with a password account cannot add GitHub for the same address, and is told to use the password. A GitHub-only account's email counts as confirmed because GitHub vouched for it.
- **What a person sees when it goes wrong.** Errors on the way back (cancelled, email already in use, a stale or doubled return, a forged one) go to our own sign-in page with `?error=...`, not the library's plain page (`onAPIError.errorURL` and the button's `errorCallbackURL`). `lib/auth-errors.ts` turns the code into one of our own sentences: the code and its description are never shown, because anyone can write them into a link. Found by its own test: looking the code up in a plain object found names every object inherits (`constructor`), which would have broken the page for such a link; it checks own properties only now.
- **Tests:** 10 integration (`tests/auth/github.test.ts`: the real configuration and an in-memory database with a pretend GitHub answering the three requests the login makes: a new person, a returning one, an email with an unconfirmed password account, with a confirmed one, GitHub's email unconfirmed, a different letter case, cancelled, forged and replayed returns); 6 unit (the messages); 15 browser (`github.spec.ts` and one in `email-off.spec.ts`: the button and the request behind it, where problems return to, every message, a crafted address, accessibility in both themes, a phone). The browser-test servers carry placeholder GitHub settings, and the no-email server none, to check the button is hidden when not set up. Breaking each of these failed the tests aimed at it: linking policy off, linking disabled, the error redirect removed, the message echoing the address, the button forgetting where problems go.
- **Verified live (2026-11-07), with the real GitHub:** on `assertly.vercel.app/sign-in` the button went to GitHub's own "Authorize Assertly" screen (the app's name, only email addresses and profile information, read-only, and "will redirect to https://assertly.vercel.app"); after the owner authorized, the browser landed on `/app` signed in. The account page showed the name from GitHub, the email marked Confirmed, "GitHub" as the sign-in method, no password form, and "All changes saved". Before that, with no click, the live server was asked to start a sign-in and built the right address: GitHub's authorize page, the client ID, the registered return address, the two scopes, a state value and no secret in the link.
- **Returning sign-in, verified live (2026-11-07):** signed out (the server then reported no session), then "Continue with GitHub" again: GitHub skipped the consent screen because the app was already authorized, and the browser landed on `/app` signed in as the same account (same internal ID, the email still confirmed, a single GitHub link and no duplicate account).
- **Not verified:** the delete flow for an account with no password (the five-minute rule), which is only tested against mocked answers; and the refusal for an email that already has an unconfirmed password account, which is tested only against the pretend GitHub (it needs a password account on the live site, and passwords may not be entered there).
- **Found by signing out and back in on the live site, and fixed (section 22):** the tour's "dismissed" flag and the pages-opened flags were browser-only and cleared at sign-out, so a returning person saw the tour again and lost three path ticks.
- **Vercel's "Needs Attention" badge** on the two database settings (set by the Neon integration) says they are stored as readable values and not as secrets. Only the owner can read them (a one-person account), so it is not urgent; rotate them and save as secrets if anyone else is ever given access. Left alone: rotating changes the database login.

## 22. The tour and "Your path" follow the account

Found by signing out and back in on the live site (section 21): the tour's "dismissed" flag and the pages-opened flags (requirements, traceability matrix, summary) lived in the browser only, and sign-out wipes the browser so the next person on a shared computer does not inherit them. So a returning person saw the welcome tour again and lost three path ticks, and so did anyone on a new device. They are saved in the account now.

- **Why they could not simply go in the workspace.** The workspace is saved as one document with a revision number (a compare-and-swap, so two devices cannot silently overwrite each other), and recording a page view in it would bump the revision on every visit and clobber Undo. These two things need none of that: the tour flag only ever turns on and the page list only ever grows, so they **cannot conflict**. They are stored apart (table `onboarding_state`, migration `0001`, additive only, deleted with the account) and merged, not replaced.
- **The merge** is a union: the tour is done if either side says so, a page is seen if either has seen it, nothing is ever taken away (`lib/onboarding/state.ts`). Because of that, order does not matter, doing it twice changes nothing, and a lost or repeated message does no harm: there is no revision number and no retry queue, only "send what this browser holds". The database does the same sum in one statement (`mergeOnboardingState`, an upsert with `OR` and a de-duplicated union of the two lists), so two devices saving at once keep each other's, and it works over Neon's HTTP driver, which has no transactions. The route (`/api/onboarding`) takes only the known pages and the tour flag, refuses anything else, and checks the origin like the workspace route.
- **In the browser** (`lib/onboarding/account-sync.ts`, started by the sync controller for a signed-in person): on the way in, the account's flags are added to this browser's, and if this browser knew something the account did not (a guest who has just signed up) the account is told; after that every change (a page opened, the tour closed) is sent. Sign-out still clears this browser and still sends nothing; the account keeps what it had.
- **The tour does not open until the account has answered.** The home page decides once, from what this browser holds, and a returning person on a new device would otherwise see the tour open and then close. The wait always ends (4 seconds, `GIVE_UP_MS`, then it goes ahead on what the browser knows), and applies to a page that has just loaded as well as to a sign-in.
- **Two layers, because one was not enough.** (1) The sign-in and sign-up forms say "waiting for the account" *before* they move to the home page: the app learns who signed in a moment after the page changes, and the tour's one decision falls in that gap. (2) If a tour opened by itself anyway and the account then says it was done, it closes; a tour opened from the "Take the tour" button is left alone.
- **What testing it found, in order.** The first browser tests failed: the headline case was not fixed, though the unit tests passed (they did not recreate the real timing). With the fixes, a breakage that removed layer 1 still passed every browser test; tracing showed the tour really did open for about a second and a half and was then closed by layer 2. The cause was the tests, not the code: `expect(...).toHaveCount(0)` retries for five seconds until it is true, so it cannot tell "never opened" from "opened and closed". The tests now record, from before each page loads, whether a dialog appeared at *any* instant (a `MutationObserver` set up with `addInitScript`), and removing layer 1 fails five of them, including the ordinary sign-in with no delay: the flash was real in the normal case.
- **Tests:** 14 unit for the merge rules (every one of the 16 possible states, every pair and every triple: commutative, associative, idempotent, nothing taken away), 10 against a real in-memory database (adding, never un-setting, many saves at once, one person's alone, gone with the account, stray data read as nothing), 26 for the browser logic against a pretend account and browser, and 14 in a real browser (signing out and in, again and again; a new device; a slow account; a slow lookup of who is signed in; the next person on the same browser; a guest who signs up; the account unreachable; the route's refusals). Breakages checked, each failing the tests aimed at it: the tour flag overwritten, the page list replaced, duplicates kept, the tour not waiting, the account's answer never applied, closing the tour not saved, a change made mid-save dropped, the sign-in form's signal removed, the auto-close removed, the whole sync switched off.
- **Not verified:** that it works on the live site with the owner's account (checked next, by signing out and in there); the "Needs Attention" badge and everything else in section 21 are unchanged.

