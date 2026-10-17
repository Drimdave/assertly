import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { RequirementsView } from "@/components/workspace/requirements-view"
import { KNOWN_PROJECT_SLUGS } from "@/lib/workspace/seed"

type Params = { project: string }

export const metadata: Metadata = { title: "Requirements" }

export function generateStaticParams(): Params[] {
  return KNOWN_PROJECT_SLUGS.map((project) => ({ project }))
}

export default async function RequirementsPage({ params }: { params: Promise<Params> }) {
  const { project } = await params
  if (!KNOWN_PROJECT_SLUGS.includes(project)) notFound()
  return <RequirementsView projectSlug={project} />
}
