const STEPS = [
  { title: "Read the requirements", text: "Every system comes with a written specification and acceptance criteria. You test against that, not against whatever the screen happens to do." },
  { title: "Plan the testing", text: "Set the scope, the approach and the exit criteria. The summary later checks your real results against them." },
  { title: "Write and run test cases", text: "Steps and expected results in a table you can drive from the keyboard, and a board to move cases from not run to passed or failed." },
  { title: "Explore", text: "Time-boxed sessions with a charter and timestamped notes, for what scripted cases miss." },
  { title: "Report what you find", text: "Title, severity, steps, expected and actual results. Report from a failed test case or a session and the bug is linked to it." },
  { title: "Read the results", text: "A verdict, coverage by requirement, and a traceability matrix that shows what nobody tested and which failures have no bug." },
]

export function Workflow() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-4 border-b bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <h2 id="how-title" className="text-display-sm">
            The whole job, start to finish
          </h2>
          <p className="mt-4 max-w-md text-body-lg text-muted-foreground">
            Not only a bug hunt. Each step has its own page, in the order the work happens, and the next one is always a click away.
          </p>
        </div>
        <ol className="divide-y border-y">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-5 py-5">
              <span className="w-6 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-heading-sm">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
