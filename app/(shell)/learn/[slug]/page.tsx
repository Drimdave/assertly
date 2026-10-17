import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight } from "lucide-react"

import { CHALLENGE_COMPONENTS } from "@/components/challenges/registry"
import { DIFFICULTY_TONE } from "@/components/learn/challenge-table"
import { Lozenge } from "@/components/ui/lozenge"
import { CHALLENGES, getChallenge, getNextChallenge } from "@/lib/learn/challenges"

type Params = { slug: string }

export function generateStaticParams(): Params[] {
  return CHALLENGES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  return { title: getChallenge(slug)?.title ?? "Challenge" }
}

export default async function ChallengePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const challenge = getChallenge(slug)
  const Challenge = CHALLENGE_COMPONENTS[slug]
  if (!challenge || !Challenge) notFound()
  const next = getNextChallenge(slug)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{challenge.code}</span>
          <Lozenge tone={DIFFICULTY_TONE[challenge.difficulty]}>{challenge.difficulty}</Lozenge>
          <span>{challenge.category}</span>
        </div>
        <h1 className="mt-1 text-heading-lg tracking-tight">{challenge.title}</h1>
        <p className="text-sm text-muted-foreground">{challenge.description}</p>
      </div>

      <div className="rounded-lg border p-5">
        <Challenge />
      </div>

      {next && (
        <Link
          href={`/learn/${next.slug}`}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent"
        >
          <span className="text-muted-foreground">Next challenge</span>
          <span className="font-medium">{next.title}</span>
          <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden />
        </Link>
      )}
    </div>
  )
}
