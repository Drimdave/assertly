# Assertly

A hands-on QA practice platform. Testers work the whole job (requirement, test plan, test cases, execution, bug reports, test summary) against realistic systems that contain hidden, seeded bugs, and get scored on what they find.

> **Status: Phase 4 in progress.** The workspace, the NovaBank sandbox with scored hidden defects, accounts, saving and share links work today. The test plan editor and exploratory sessions work; a third practice system is planned (appointment booking), see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What works today

- **App shell:** sidebar, top bar, light and dark themes, responsive down to phone width.
- **Fundamentals track** (`/learn`): 12 challenges where you discover every validation behavior. Progress is saved in your browser, no sign-up.
- **Test plan** (`/app/novabank/plan`): scope, approach, types of testing, entry criteria, risks and measurable exit criteria (execution percentage, pass rate, limits on critical and high bugs, requirement coverage). Start from a template. The test summary then checks your real results against the plan's exit criteria.
- **Exploratory sessions** (`/app/novabank/sessions`): time-boxed, charter-led testing. Plan a session (charter, area, 15 to 90 minute time-box), start the clock, take timestamped notes (observation, question, risk, test idea) with the keyboard, report bugs from it, and write a debrief. The timer warns when time is nearly up and when the time-box is reached. Sessions appear in the test summary.
- **Test cases** (`/app/novabank/cases`): a sample banking project you can edit. Search, filter, sort, bulk actions, and a drawer to write test cases with steps and expected results. Keyboard friendly: `J`/`K` move, `Enter` open, `P`/`F`/`B` pass, fail or block, `X` select, `C` new, `/` search. Every change has an Undo.
- **Board** (`/app/novabank/board`): the same test cases as columns by status. Drag a card to change its status or reorder it, with the mouse, touch or keyboard (`Space` to pick up, arrows to move, `Space` to drop, `Esc` to cancel). Every move has an Undo.
- **Test summary** (`/app/novabank/report`): a live report built from your results: a verdict (ready, incomplete, not ready), execution results, a requirement coverage matrix, failed test cases, risks and recommended next steps. Print it or save it as a PDF (always light, with the app chrome hidden).
- **Requirements** (`/app/novabank/requirements`): the written specification with acceptance criteria and the test cases linked to each requirement. Test against this, not against what you see on screen.
- **Practice systems:** pick which system you are testing from the sidebar. **NovaBank** (starter) is a bank with ten hidden defects. **Cobalt Goods** (intermediate) is an online shop with ten of its own: a cart, coupons, shipping, tax, card payments and orders (`/sandbox/shop`, test cards are shown on the checkout page; no real payment is ever taken). **Lendwell** (advanced) is a loan application: a four-step form, a live quote, an approve / refer / decline decision, and a list of applications (`/sandbox/loans`), where the defects hide in boundaries, calculations and going back and forward. Each system has its own requirements, starter test cases, plan template, session charters and answer key, and your score for one never counts for the other. The home page shows your progress in each.
- **NovaBank sandbox** (`/sandbox/novabank`): a practice banking app (sign in, accounts, transfers, activity) with ten defects hidden in it. Test credentials are shown on the sign-in page. "Reset sandbox" restores the accounts but keeps the log of defects you have triggered.
- **Bugs** (`/app/novabank/bugs`): report what you find with a title, severity, reproduction steps and expected and actual results. From a failed test case, "Report a bug" opens the form prefilled.
- **Scoring** (in the test summary): each report is matched to a hidden defect by its wording, and only counts if the sandbox saw you trigger that defect. Points depend on severity and on how well the report is written. Duplicates earn nothing. Hints are available for defects you have not found and cost 5 points each.
- **Tour and Your path** (`/app`): an eight-step, skippable walkthrough opens the first time you reach the home page ("Step 3 of 8", Back, Next, Skip, arrow keys work) and can be reopened from the sidebar. Each step dims the page and highlights the real sidebar item it is about, and the highlight glides from one item to the next. Under it, **Your path** lists what to do from simple to advanced in three levels, and ticks each step off by what you actually did: nothing is locked, it just shows where to go next. The sidebar follows the same order: Plan, Test, Report, with the practice app one click away.
- **For you** (`/app`): your test run status, Fundamentals progress and what to do next.

- **Accounts and saving** (`/sign-in`, `/sign-up`): optional. As a guest your work stays in this browser. Sign up and it is saved to your account and follows you to any device; whatever you did as a guest becomes your workspace. Sign out and this browser is cleared. Email and password work out of the box; GitHub sign-in turns on when you configure it.
- **Share links** (on the test summary): a public, read-only copy of your report that anyone can open without an account. Defects you have not found stay hidden in it. You can revoke a link at any time.

"Reset sample data" restores the starter project.

## Getting started

Requires Node 20.9 or newer.

```bash
npm install
npm run dev
```

Open the address that `next dev` prints (http://localhost:3000 by default). Accounts work locally with no setup: without a `DATABASE_URL`, Assertly runs its own embedded Postgres (PGlite) in `.data/`. See [.env.example](.env.example) for production settings.

| Script | What it does |
|---|---|
| `npm run db:generate` | Creates a migration after you change `lib/db/schema.ts` |
| `npm run db:migrate` | Applies migrations to the database in `DATABASE_URL` (production) |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (strict) |
| `npm test` | Unit tests (Vitest) |
| `npm run check` | Lint, typecheck and unit tests together |
| `npm run e2e` | End-to-end and accessibility tests (Playwright; builds and serves the app on port 3100) |
| `npm run e2e:ui` | The same, in Playwright's interactive UI |

The e2e suite starts its own servers in their own folders (`.next-e2e-prod` on port 3100 and a dev server in `.next-e2e` on 3101), so it never disturbs a dev server you have running. It includes a dev-mode console check, because React only reports hydration mismatches and misuse there.

CI runs lint, typecheck, unit tests, a production build and the end-to-end suite on every push. First time running e2e locally: `npx playwright install chromium`.

## Stack

Next.js (App Router), React, TypeScript (strict), Tailwind CSS, Radix primitives, react-hook-form + zod, sonner, IBM Plex Sans and JetBrains Mono via `next/font`, Vitest. Planned: Postgres on Neon with Drizzle, Better Auth, `@dnd-kit` for the board, Playwright. Everything is free to run.

## Project layout

```
app/               routes (thin)
  (shell)/         pages that share the app shell: /app, /learn, /learn/[slug]
components/
  shell/           sidebar, top bar, theme toggle
  learn/           Fundamentals UI (table, progress panels)
  workspace/       test cases table, board and case drawer
  challenges/      the 12 challenge components
  ui/              design-system primitives
hooks/             client hooks
lib/
  learn/           challenge catalog, scenarios, detection, progress, local store
  workspace/       test case and bug models, reducer, selectors, form schemas, scoring, requirements, seed data, local store
  sandbox/novabank/  the seeded-defect registry (answer key), the app engine and its browser store
  actions.ts       server actions that validate each challenge
docs/              ARCHITECTURE.md, design/mockup-v4.html
tests/             unit tests (Vitest) and e2e/ (Playwright, including automated accessibility scans)
```

## Design

Tokens, density and component rules come from [docs/design/mockup-v4.html](docs/design/mockup-v4.html): neutral surfaces, blue only for primary actions and selection, status colors only for meaning, hairline borders, small radius.

## Known limits

- The rate limit on challenge submissions is shared by every visitor (one in-memory counter). It becomes per-session in Phase 3, with accounts.
- Build-time dev dependencies (the Tailwind 3 and ESLint chains) carry advisories with no non-breaking fix. They do not ship to users. Moving to Tailwind 4 is planned.
- The hidden-defect answer key ships with the app (and the repository is public), so a determined user can read it. That is fine for a practice tool. A share link never contains it, but scores are computed from data the browser sends, so a shared score is not tamper-proof.
- No email verification or password reset yet: both need an email service, which is not set up. Until then, a forgotten password cannot be recovered.
- GitHub sign-in is wired but untested without real OAuth credentials.
- Conflicts between two devices editing at once are resolved by taking the newer saved copy; the other device is told it was updated.
