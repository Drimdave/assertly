import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

import { FooterAccountLinks } from "./account-links"

export function Closing() {
  return (
    <section aria-labelledby="closing-title" className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-4 py-14 sm:px-6 md:py-20">
        <div className="min-w-0 flex-1">
          <h2 id="closing-title" className="text-display-sm">
            Pick a system and start
          </h2>
          <p className="mt-2 text-body-lg text-primary-foreground/85">NovaBank is the gentlest: a bank with a login, accounts and transfers.</p>
        </div>
        <Button asChild size="lg" variant="outline" className="border-transparent text-foreground">
          <Link href="/app">
            Start testing <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  )
}

export function LandingFooter() {
  return (
    <footer className="bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-6 sm:px-6">
        <Logo className="text-sm" />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <Link href="/app" className="hover:text-foreground hover:underline">
            Your workspace
          </Link>
          <Link href="/learn" className="hover:text-foreground hover:underline">
            Fundamentals
          </Link>
          <FooterAccountLinks />
        </nav>
        <p className="ml-auto text-xs text-muted-foreground">A practice platform. Every system is fictional and uses fake data.</p>
      </div>
    </footer>
  )
}
