import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BugsView } from "@/components/workspace/bugs-view"
import { KNOWN_PROJECT_SLUGS } from "@/lib/workspace/seed"

type Params = { project: string }

export const metadata: Metadata = { title: "Bugs" }

export function generateStaticParams(): Params[] {
  return KNOWN_PROJECT_SLUGS.map((project) => ({ project }))
}

export default async function BugsPage({ params }: { params: Promise<Params> }) {
  const { project } = await params
  if (!KNOWN_PROJECT_SLUGS.includes(project)) notFound()
  return (
    <Suspense>
      <BugsView projectSlug={project} />
    </Suspense>
  )
}
