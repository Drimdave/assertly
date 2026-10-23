"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { getSystem } from "@/lib/systems/registry"
import { CHARTER_PLACEHOLDER } from "@/lib/workspace/sessions"
import { EMPTY_SESSION_FORM, sessionFormSchema, toSessionInput, type SessionFormValues } from "@/lib/workspace/session-schema"
import { workspace } from "@/lib/workspace/store"
import { TIMEBOXES, type Project } from "@/lib/workspace/types"

export function NewSessionDrawer({ open, project, onClose }: { open: boolean; project: Project; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {open && <NewSessionForm project={project} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function NewSessionForm({ project, onClose }: { project: Project; onClose: () => void }) {
  const router = useRouter()
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SessionFormValues>({ resolver: zodResolver(sessionFormSchema), defaultValues: EMPTY_SESSION_FORM, mode: "onSubmit", reValidateMode: "onChange" })

  const onSubmit = handleSubmit((values) => {
    const created = workspace.createSession(project.slug, toSessionInput(values))
    onClose()
    router.push(`/app/${project.slug}/sessions/${created.id}`)
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-full flex-col">
      <div className="border-b px-6 py-3 pr-12">
        <SheetTitle className="text-sm font-medium">New exploratory session</SheetTitle>
        <SheetDescription className="text-xs">In {project.name}. You start the clock when you are ready.</SheetDescription>
      </div>

      <div className="flex-1 space-y-5 px-6 py-5">
        <div className="space-y-1.5">
          <Label htmlFor="charter">Charter</Label>
          <Textarea id="charter" rows={3} autoFocus placeholder={CHARTER_PLACEHOLDER} aria-invalid={!!errors.charter} {...register("charter")} />
          {errors.charter ? (
            <p role="alert" className="text-xs text-destructive">
              {errors.charter.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">A mission, not a script: where to look, how, and what you hope to learn.</p>
          )}
          <div className="space-y-1 pt-1">
            <p className="text-xs font-medium text-muted-foreground">Or start from an example</p>
            <ul className="space-y-1">
              {(getSystem(project.slug)?.charterExamples ?? []).map((example) => (
                <li key={example}>
                  <button type="button" className="text-left text-sm text-primary underline underline-offset-2" onClick={() => setValue("charter", example, { shouldValidate: true })}>
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="area">Area (optional)</Label>
          <Controller
            control={control}
            name="requirementKey"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                <SelectTrigger id="area" aria-label="Area" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Anywhere</SelectItem>
                  {project.requirements.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.key} · {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <Controller
          control={control}
          name="timeboxMinutes"
          render={({ field }) => (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Time-box</legend>
              <div role="radiogroup" aria-label="Time-box" className="inline-flex overflow-hidden rounded-sm border">
                {TIMEBOXES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={field.value === m}
                    onClick={() => field.onChange(m)}
                    className={cn("h-8 border-r px-3 text-sm last:border-r-0", field.value === m ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">A fixed box keeps you focused. 30 to 60 minutes is typical.</p>
            </fieldset>
          )}
        />
      </div>

      <div className="sticky bottom-0 flex items-center gap-2 border-t bg-popover px-6 py-3">
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create session</Button>
        </div>
      </div>
    </form>
  )
}
