import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ReportView } from "@/components/workspace/report-view"
import { KNOWN_PROJECT_SLUGS } from "@/lib/workspace/seed"

type Params = { project: string }

export const metadata: Metadata = { title: "Test summary" }

export function generateStaticParams(): Params[] {
  return KNOWN_PROJECT_SLUGS.map((project) => ({ project }))
}

export default async function ReportPage({ params }: { params: Promise<Params> }) {
  const { project } = await params
  if (!KNOWN_PROJECT_SLUGS.includes(project)) notFound()
  return <ReportView projectSlug={project} />
}
