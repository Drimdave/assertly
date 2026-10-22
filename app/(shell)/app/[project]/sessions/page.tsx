import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SessionsView } from "@/components/workspace/sessions-view"
import { KNOWN_PROJECT_SLUGS } from "@/lib/workspace/seed"

type Params = { project: string }

export const metadata: Metadata = { title: "Exploratory sessions" }

export function generateStaticParams(): Params[] {
  return KNOWN_PROJECT_SLUGS.map((project) => ({ project }))
}

export default async function SessionsPage({ params }: { params: Promise<Params> }) {
  const { project } = await params
  if (!KNOWN_PROJECT_SLUGS.includes(project)) notFound()
  return <SessionsView projectSlug={project} />
}
