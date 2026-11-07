"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Card, FormError } from "@/components/account/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { nameFormSchema, providerLabel, type NameFormValues } from "@/lib/account/schemas"
import { authClient } from "@/lib/auth-client"

export function ProfileCard({ name, email, providers }: { name: string; email: string; providers: string[] }) {
  const [error, setError] = useState<string | null>(null)
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
        <dd className="break-all">{email}</dd>
        <dt className="text-muted-foreground">Sign-in</dt>
        <dd>{providers.map(providerLabel).join(", ") || "None"}</dd>
      </dl>
    </Card>
  )
}
