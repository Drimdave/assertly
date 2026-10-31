import { ApplicationView } from "@/components/sandbox/loans/application-views"

// Applications are created in the browser, so their ids are not known at build time: the page renders on request
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ApplicationView id={id} />
}
