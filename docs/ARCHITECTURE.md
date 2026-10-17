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
