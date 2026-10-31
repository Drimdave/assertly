import Link from "next/link"

import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { HeaderAccountLink } from "./account-links"

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#systems", label: "Practice systems" },
  { href: "#scoring", label: "Scoring" },
]

export function LandingHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Assertly home" className="rounded-sm">
          <Logo />
        </Link>
        <nav aria-label="On this page" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-sm px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <HeaderAccountLink />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
