import { numberWord } from "@/lib/number-words"
import { SYSTEMS } from "@/lib/systems/registry"
import type { SystemDef } from "@/lib/systems/types"

export interface TourStep {
  id: string
  title: string
  body: string
  /** Where "Take me there" goes. */
  href?: string
  hrefLabel?: string
  /** A different app: opens in a new tab. */
  external?: boolean
  /**
   * Sidebar items to point at (their `data-tour` ids). Several are highlighted as one block. On a screen with no
   * sidebar (a phone) nothing is highlighted and the step reads the same.
   */
  targets?: string[]
}

/** "A loan application: ..." read after "Lendwell is": "a loan application: ...". */
export const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

/**
 * The tour follows the order the work happens in, in plain words, with no jargon left unexplained. Each step names the
 * one thing to do next and, on a screen wide enough to show the sidebar, points at it. It is about the system the
 * tester is on: its name, its app and its pages, so reopening it from another system's page talks about that one.
 */
export function buildTour(system: SystemDef): TourStep[] {
  const P = `/app/${system.slug}`
  return [
    {
      id: "welcome",
      title: "Welcome to Assertly",
      body: "Assertly is a practice ground for software testers. You will test pretend systems, each with bugs hidden in it, and do the job the way a real tester does: plan, test, find problems and report them. This tour takes a couple of minutes. Skip it whenever you like, and open it again from the sidebar.",
    },
    {
      id: "systems",
      title: "Pick a system to test",
      body: `There are ${numberWord(SYSTEMS.length)}, easiest first: ${SYSTEMS.map((s) => s.name).join(", ")}. Each has its own requirements, test cases, plan and score, and the bugs are different in every one. Switch here, and every page below belongs to the system you picked.`,
      targets: ["switcher"],
    },
    {
      id: "system",
      title: "The system you are testing",
      body: `${system.name} is ${lowerFirst(system.tagline)} It opens in a new tab, so you can keep your notes beside it. Nothing in it is real, so try to break it.`,
      href: system.sandboxPath,
      hrefLabel: `Open ${system.name} in a new tab`,
      external: true,
      targets: ["system"],
    },
    {
      id: "requirements",
      title: "Start with the requirements",
      body: "A requirement says what the system should do. Testing is checking that it really does. Read these first: every test you write should trace back to one of them.",
      href: `${P}/requirements`,
      hrefLabel: "Read the requirements",
      targets: ["requirements"],
    },
    {
      id: "plan",
      title: "Plan what to test",
      body: "The test plan says what you will test, how, and when you are done. Writing it first keeps you from testing at random, and it gives your test summary something to be measured against.",
      href: `${P}/plan`,
      hrefLabel: "Open the test plan",
      targets: ["plan"],
    },
    {
      id: "cases",
      title: "Write test cases",
      body: "A test case is one check: what to do and what you expect to happen. Run them and mark each passed or failed. The Board shows the same test cases as columns you can drag as you work through them.",
      href: `${P}/cases`,
      hrefLabel: "Open the test cases",
      targets: ["cases", "board"],
    },
    {
      id: "explore",
      title: "Explore without a script",
      body: "A script only finds what you thought of in advance. In an exploratory session you set a time limit, poke at the app freely, and write notes as you go. Many real bugs are found this way.",
      href: `${P}/sessions`,
      hrefLabel: "See exploratory sessions",
      targets: ["sessions"],
    },
    {
      id: "report",
      title: "Report what you find",
      body: "When the app does something different from its requirement, report a bug: a clear title, the steps to reproduce it, what you expected, and what happened. Some bugs are hidden on purpose. Your reports are matched against them, and hints cost points.",
      href: `${P}/bugs`,
      hrefLabel: "Open the bug list",
      targets: ["bugs"],
    },
    {
      id: "traceability",
      title: "See what is covered",
      body: "The traceability matrix lists every requirement with the test cases, sessions and bugs that trace back to it, and names the gaps: a requirement nobody has tested, a failure with no bug reported.",
      href: `${P}/traceability`,
      hrefLabel: "Open the traceability matrix",
      targets: ["traceability"],
    },
    {
      id: "summary",
      title: "See how you did",
      body: "The test summary pulls it all together: results, coverage, bugs, your plan's exit criteria and your score. You can share it as a read-only link. Your work is saved in this browser; create an account to keep it on every device. The steps on your home page, under Your path, take you from simple to advanced.",
      href: `${P}/report`,
      hrefLabel: "Open the test summary",
      targets: ["summary"],
    },
  ]
}
