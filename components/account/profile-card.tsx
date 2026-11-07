"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Card, FormError } from "@/components/account/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lozenge } from "@/components/ui/lozenge"
import { nameFormSchema, providerLabel, type NameFormValues } from "@/lib/account/schemas"
import { authClient } from "@/lib/auth-client"

export function ProfileCard({
  name,
  email,
  emailConfirmed,
  canConfirm,
  confirmLinkFailed,
  providers,
}: {
  name: string
  email: string
  emailConfirmed: boolean
  /** Whether this site can send email at all. */
  canConfirm: boolean
  /** The person arrived from a confirmation link that did not work. */
  confirmLinkFailed: boolean
  providers: string[]
}) {
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<NameFormValues>({ resolver: zodResolver(nameFormSchema), defaultValues: { name }, mode: "onSubmit", reValidateMode: "onChange" })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    const res = await authClient.updateUser({ name: values.name })
    if (res.error) {
      setError(res.error.message ?? "Could not save your name.")
      return
    }
    reset({ name: values.name })
    toast("Name saved")
  })

  async function sendConfirmation() {
    setSending(true)
    const res = await authClient.sendVerificationEmail({ email, callbackURL: "/account" })
    setSending(false)
    toast(res.error ? (res.error.status === 429 ? "Wait a minute before asking again." : "Could not send the email. Try again in a minute.") : "Confirmation email sent. It expires in 1 hour.")
  }

  return (
    <Card title="Profile">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && <FormError>{error}</FormError>}
        <div className="space-y-1.5">
          <Label htmlFor="account-name">Name</Label>
          <Input id="account-name" autoComplete="name" aria-invalid={!!errors.name} className="max-w-sm" {...register("name")} />
          {errors.name && <p role="alert" className="text-xs text-danger">{errors.name.message}</p>}
        </div>
        <Button type="submit" variant="outline" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? "Saving…" : "Save name"}
        </Button>
      </form>
      <dl className="grid gap-x-6 gap-y-2 border-t pt-4 text-sm sm:grid-cols-[7rem_1fr]">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="space-y-2">
          <span className="break-all">{email}</span>{" "}
          {/* "Not confirmed" is only worth saying when something can be done about it */}
          {(emailConfirmed || canConfirm) && <Lozenge tone={emailConfirmed ? "success" : "warning"}>{emailConfirmed ? "Confirmed" : "Not confirmed"}</Lozenge>}
          {!emailConfirmed && canConfirm && (
            <div className="space-y-2">
              {confirmLinkFailed && <FormError>That confirmation link has expired or was already used. Send a new one.</FormError>}
              <p className="text-xs text-muted-foreground">Confirm it so you can get back in if you forget your password.</p>
              <Button type="button" variant="outline" size="sm" onClick={sendConfirmation} disabled={sending}>
                {sending ? "Sending…" : "Send confirmation email"}
              </Button>
            </div>
          )}
        </dd>
        <dt className="text-muted-foreground">Sign-in</dt>
        <dd>{providers.map(providerLabel).join(", ") || "None"}</dd>
      </dl>
    </Card>
  )
}
