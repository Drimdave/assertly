"use client"

import { useEffect, useMemo } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { notifyUndo } from "@/components/workspace/notify"
import { CriteriaTable } from "@/components/workspace/plan-section"
import { RelativeTime } from "@/components/workspace/relative-time"
import { useProject } from "@/hooks/use-workspace"
import { cn } from "@/lib/utils"
import { evaluatePlan, planTemplate } from "@/lib/workspace/plan"
import { planFormSchema, toPlanFormValues, toPlanInput, type PlanFormValues } from "@/lib/workspace/plan-schema"
import { workspace } from "@/lib/workspace/store"
import { TEST_TYPES, TEST_TYPE_LABEL, type Project, type TestPlan } from "@/lib/workspace/types"

function Section({ title, why, children }: { title: string; why: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-lg border">
      <header className="border-b px-4 py-3">
        <h2 className="text-heading-xs">{title}</h2>
        <p className="text-sm text-muted-foreground">{why}</p>
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  )
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function PlanView({ projectSlug }: { projectSlug: string }) {
  const { ready, project, cases, state } = useProject(projectSlug)
  const plan = state.plans.find((p) => p.projectSlug === projectSlug)

  if (ready && !project) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-center sm:px-6">
        <h1 className="text-heading-lg">Project not found</h1>
        <Link href="/app" className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to your workspace
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-heading-lg tracking-tight">Test plan</h1>
        <p className="text-sm text-muted-foreground">
          Decide what you will test, how, and when you are done, before you start. The test summary then checks your results against it.
        </p>
      </div>

      {!ready || !project ? (
        <div className="h-64 animate-pulse rounded-lg bg-subtle" />
      ) : !plan ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">No test plan yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Start from a template for {project.name}: scope, approach, entry and exit criteria and risks are filled in, and you change what does not fit.
          </p>
          <Button className="mt-4" onClick={() => workspace.savePlan(project.slug, planTemplate(project))}>
            <Plus /> Create from template
          </Button>
        </div>
      ) : (
        <PlanForm key={`${plan.id}:${plan.updatedAt}`} project={project} plan={plan} caseCounts={Object.fromEntries(project.requirements.map((r) => [r.key, cases.filter((c) => c.requirementKey === r.key).length]))} bugs={state.bugs.filter((b) => b.projectSlug === projectSlug)} cases={cases} />
      )}
    </div>
  )
}

function PlanForm({
  project,
  plan,
  caseCounts,
  bugs,
  cases,
}: {
  project: Project
  plan: TestPlan
  caseCounts: Record<string, number>
  bugs: Parameters<typeof evaluatePlan>[3]
  cases: Parameters<typeof evaluatePlan>[2]
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<PlanFormValues>({ resolver: zodResolver(planFormSchema), defaultValues: toPlanFormValues(plan),
    // Errors appear on Save, then update as you fix them. Validating on blur inserted a message above the control
    // you were about to click, shifting the page between mouse-down and mouse-up so the click missed.
    mode: "onSubmit",
    reValidateMode: "onChange",
  })
  const entry = useFieldArray({ control, name: "entryCriteria" })
  const risks = useFieldArray({ control, name: "risks" })

  // Leaving with unsaved edits is the one way to lose work here, so ask the browser to warn
  useEffect(() => {
    if (!isDirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [isDirty])

  const evaluation = useMemo(() => evaluatePlan(plan, project, cases, bugs), [plan, project, cases, bugs])

  const onSubmit = handleSubmit((values) => {
    workspace.savePlan(project.slug, toPlanInput(values))
    reset(values)
    notifyUndo("Test plan saved")
  })

  const exitField = (name: "executedPercent" | "passRate" | "maxCritical" | "maxHigh", label: string, suffix: string) => (
    <Field label={label} htmlFor={`exit-${name}`} error={errors.exit?.[name]?.message}>
      <div className="flex items-center gap-2">
        <Input id={`exit-${name}`} type="number" inputMode="numeric" min={0} className="w-24" aria-invalid={!!errors.exit?.[name]} {...register(`exit.${name}`, { valueAsNumber: true })} />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
    </Field>
  )

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Section title="Overview" why="A plan others can read in a minute: its name and the point of the testing.">
        <Field label="Title" htmlFor="plan-title" error={errors.title?.message}>
          <Input id="plan-title" aria-invalid={!!errors.title} {...register("title")} />
        </Field>
        <Field label="Objective" htmlFor="plan-objective" error={errors.objective?.message}>
          <Textarea id="plan-objective" rows={3} aria-invalid={!!errors.objective} {...register("objective")} />
        </Field>
      </Section>

      <Section title="Scope" why="What is being tested and what is deliberately not. Untested areas should be a decision, not an accident.">
        <Controller
          control={control}
          name="inScope"
          render={({ field }) => (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Requirements in scope</legend>
              {project.requirements.map((r) => {
                const checked = field.value.includes(r.key)
                return (
                  <div key={r.key} className="flex items-center gap-2.5 text-sm">
                    <Checkbox
                      id={`scope-${r.key}`}
                      checked={checked}
                      onCheckedChange={(v) => field.onChange(v === true ? [...field.value, r.key] : field.value.filter((k) => k !== r.key))}
                    />
                    <Label htmlFor={`scope-${r.key}`} className="flex flex-1 items-center gap-2 font-normal">
                      <span className="rounded-[3px] bg-neutral-soft px-1.5 font-mono text-xs text-muted-foreground">{r.key}</span>
                      {r.title}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {caseCounts[r.key] ?? 0} test {(caseCounts[r.key] ?? 0) === 1 ? "case" : "cases"}
                      </span>
                    </Label>
                  </div>
                )
              })}
              {errors.inScope && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.inScope.message}
                </p>
              )}
            </fieldset>
          )}
        />
        <Field label="Out of scope" htmlFor="plan-out" error={errors.outOfScope?.message}>
          <Textarea id="plan-out" rows={2} {...register("outOfScope")} />
        </Field>
      </Section>

      <Section title="Approach" why="How you will find problems: the kinds of testing and the order you will work in.">
        <Field label="Approach" htmlFor="plan-approach" error={errors.approach?.message}>
          <Textarea id="plan-approach" rows={3} aria-invalid={!!errors.approach} {...register("approach")} />
        </Field>
        <Controller
          control={control}
          name="testTypes"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Types of testing</legend>
              <div className="flex flex-wrap gap-1.5">
                {TEST_TYPES.map((t) => {
                  const on = field.value.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => field.onChange(on ? field.value.filter((x) => x !== t) : [...field.value, t])}
                      className={cn(
                        "h-8 rounded-md border px-3 text-sm transition-colors",
                        on ? "border-primary/40 bg-primary-soft font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {TEST_TYPE_LABEL[t]}
                    </button>
                  )
                })}
              </div>
              {errors.testTypes && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {errors.testTypes.message}
                </p>
              )}
            </fieldset>
          )}
        />
        <Field label="Test environment" htmlFor="plan-env" error={errors.environment?.message}>
          <Input id="plan-env" placeholder="Build, browser, data" {...register("environment")} />
        </Field>
      </Section>

      <Section title="Entry criteria" why="What must be true before testing starts. If it is not, you are testing on sand.">
        <ul className="space-y-2" aria-label="Entry criteria">
          {entry.fields.map((f, i) => (
            <li key={f.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Input aria-label={`Entry criterion ${i + 1}`} aria-invalid={!!errors.entryCriteria?.[i]?.text} {...register(`entryCriteria.${i}.text`)} />
                {errors.entryCriteria?.[i]?.text && (
                  <p role="alert" className="pt-0.5 text-xs text-destructive">
                    {errors.entryCriteria[i]?.text?.message}
                  </p>
                )}
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" aria-label={`Remove entry criterion ${i + 1}`} onClick={() => entry.remove(i)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={() => entry.append({ text: "" })}>
          <Plus /> Add entry criterion
        </Button>
      </Section>

      <Section title="Exit criteria" why="When you may stop. Numbers, not feelings: the test summary checks every one against your real results.">
        <div className="grid gap-4 sm:grid-cols-2">
          {exitField("executedPercent", "Test cases executed, at least", "%")}
          {exitField("passRate", "Pass rate of executed cases, at least", "%")}
          {exitField("maxCritical", "Critical bugs, at most", "bugs")}
          {exitField("maxHigh", "High severity bugs, at most", "bugs")}
        </div>
        <Controller
          control={control}
          name="exit.coverRequirements"
          render={({ field }) => (
            <div className="flex items-center gap-2.5 text-sm">
              <Checkbox id="exit-cover" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              <Label htmlFor="exit-cover" className="font-normal">
                Every requirement in scope has at least one test case
              </Label>
            </div>
          )}
        />
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-heading-xxs text-muted-foreground">Where you are now (saved plan)</h3>
          <p className="text-sm">
            {evaluation.allMet ? "All exit criteria are met." : `${evaluation.met} of ${evaluation.criteria.length} exit criteria met.`}
          </p>
          <CriteriaTable criteria={evaluation.criteria} />
        </div>
      </Section>

      <Section title="Risks" why="What could stop you doing a good job, and what you will do about it.">
        <ul className="space-y-3" aria-label="Risks">
          {risks.fields.map((f, i) => (
            <li key={f.id} className="grid items-start gap-2 sm:grid-cols-[1fr_1fr_2rem]">
              <div>
                <Input aria-label={`Risk ${i + 1}`} placeholder="Risk" aria-invalid={!!errors.risks?.[i]?.risk} {...register(`risks.${i}.risk`)} />
                {errors.risks?.[i]?.risk && (
                  <p role="alert" className="pt-0.5 text-xs text-destructive">
                    {errors.risks[i]?.risk?.message}
                  </p>
                )}
              </div>
              <Input aria-label={`Mitigation ${i + 1}`} placeholder="What you will do about it" {...register(`risks.${i}.mitigation`)} />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" aria-label={`Remove risk ${i + 1}`} onClick={() => risks.remove(i)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={() => risks.append({ risk: "", mitigation: "" })}>
          <Plus /> Add risk
        </Button>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <span className="text-sm text-muted-foreground">
          {isDirty ? "Unsaved changes" : <>Saved <RelativeTime iso={plan.updatedAt} /></>}
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset(toPlanFormValues(planTemplate(project)), { keepDefaultValues: true })
              toast("Template restored. Save to keep it.")
            }}
          >
            Reset to template
          </Button>
          <Button type="button" variant="outline" disabled={!isDirty} onClick={() => reset()}>
            Revert
          </Button>
          <Button type="submit" disabled={!isDirty}>
            Save plan
          </Button>
        </div>
      </div>
    </form>
  )
}
