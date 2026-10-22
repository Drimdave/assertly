import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SessionView } from "@/components/workspace/session-view"
import { KNOWN_PROJECT_SLUGS } from "@/lib/workspace/seed"

type Params = { project: string; id: string }

export const metadata: Metadata = { title: "Exploratory session" }

// Sessions are created in the browser, so ids are not known at build time; the page renders on request
export const dynamicParams = true
export function generateStaticParams(): Params[] {
  return []
}

export default async function SessionPage({ params }: { params: Promise<Params> }) {
  const { project, id } = await params
  if (!KNOWN_PROJECT_SLUGS.includes(project)) notFound()
  return <SessionView projectSlug={project} sessionId={id} />
}
