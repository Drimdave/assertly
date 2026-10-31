import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CATEGORIES, CHALLENGES } from "@/lib/learn/challenges"

export function Extras() {
  return (
    <section aria-labelledby="extras-title" className="border-b bg-background">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
        <h2 id="extras-title" className="sr-only">
          Learn the basics, and keep your work
        </h2>
        <article className="flex flex-col gap-3 rounded-lg border bg-subtle p-5">
          <h3 className="text-heading-sm">New to testing? Start with the basics</h3>
          <p className="text-sm text-muted-foreground">
            {CHALLENGES.length} short challenges in {CATEGORIES.length} groups ({CATEGORIES.join(", ").toLowerCase()}). Each one is a single form with rules you discover by trying
            things, which is what the larger systems ask of you, in miniature.
          </p>
          <div className="mt-auto">
            <Button asChild variant="outline">
              <Link href="/learn">
                Try Fundamentals <ArrowRight />
              </Link>
            </Button>
          </div>
        </article>
        <article className="flex flex-col gap-3 rounded-lg border bg-subtle p-5">
          <h3 className="text-heading-sm">Free, and your work is yours</h3>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-muted-foreground">
            <li>No account needed. Everything is saved in this browser as you go.</li>
            <li>Sign up with an email address to keep your work and carry it to another device.</li>
            <li>Share a read-only copy of your test summary with a link, and revoke it whenever you like. Defects you have not found stay hidden in it.</li>
            <li>Every system is fictional and every payment, email and loan is fake.</li>
          </ul>
        </article>
      </div>
    </section>
  )
}
