import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CasesView } from "@/components/workspace/cases-view"
import { KNOWN_PROJECT_SLUGS } from "@/lib/workspace/seed"

type Params = { project: string }

export const metadata: Metadata = { title: "Test cases" }

export function generateStaticParams(): Params[] {
  return KNOWN_PROJECT_SLUGS.map((project) => ({ project }))
}

export default async function CasesPage({ params }: { params: Promise<Params> }) {
  const { project } = await params
  if (!KNOWN_PROJECT_SLUGS.includes(project)) notFound()
  return (
    <Suspense>
      <CasesView projectSlug={project} />
    </Suspense>
  )
}
