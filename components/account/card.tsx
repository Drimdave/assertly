/** A titled block on the account page. The same look as the cards on a session page. */
export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-lg border">
      <header className="border-b px-4 py-3">
        <h2 className="text-heading-xs">{title}</h2>
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  )
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  )
}
