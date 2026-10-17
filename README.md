# Assertly

A hands-on QA practice platform. Testers work the whole job (requirement, test plan, test cases, execution, bug reports, test summary) against realistic systems that contain hidden, seeded bugs, and get scored on what they find.

> **Status: Phase 1 in progress.** The app shell, the Fundamentals track, the test cases table, the board and the test summary report work today. The bug sandbox is next, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What works today

- **App shell:** sidebar, top bar, light and dark themes, responsive down to phone width.
- **Fundamentals track** (`/learn`): 12 challenges where you discover every validation behavior. Progress is saved in your browser, no sign-up.
- **Test cases** (`/app/novabank/cases`): a sample banking project you can edit. Search, filter, sort, bulk actions, and a drawer to write test cases with steps and expected results. Keyboard friendly: `J`/`K` move, `Enter` open, `P`/`F`/`B` pass, fail or block, `X` select, `C` new, `/` search. Every change has an Undo.
- **Board** (`/app/novabank/board`): the same test cases as columns by status. Drag a card to change its status or reorder it, with the mouse, touch or keyboard (`Space` to pick up, arrows to move, `Space` to drop, `Esc` to cancel). Every move has an Undo.
- **Test summary** (`/app/novabank/report`): a live report built from your results: a verdict (ready, incomplete, not ready), execution results, a requirement coverage matrix, failed test cases, risks and recommended next steps. Print it or save it as a PDF (always light, with the app chrome hidden).
- **For you** (`/app`): your test run status, Fundamentals progress and what to do next.

Your data is stored in your browser (no account). "Reset sample data" restores the starter project.

## Getting started

Requires Node 20.9 or newer.

```bash
npm install
npm run dev
```

Open the address that `next dev` prints (http://localhost:3000 by default).

| Script | What it does |
|---|---|
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
  workspace/       test case model, reducer, selectors, form schema, seed data, local store
  actions.ts       server actions that validate each challenge
docs/              ARCHITECTURE.md, design/mockup-v4.html
tests/             unit tests (Vitest) and e2e/ (Playwright, including automated accessibility scans)
```

## Design

Tokens, density and component rules come from [docs/design/mockup-v4.html](docs/design/mockup-v4.html): neutral surfaces, blue only for primary actions and selection, status colors only for meaning, hairline borders, small radius.

## Known limits

- The rate limit on challenge submissions is shared by every visitor (one in-memory counter). It becomes per-session in Phase 2.
- Build-time dev dependencies (the Tailwind 3 and ESLint chains) carry advisories with no non-breaking fix. They do not ship to users. Moving to Tailwind 4 is planned.
