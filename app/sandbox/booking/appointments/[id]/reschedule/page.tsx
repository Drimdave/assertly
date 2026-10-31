import { RescheduleView } from "@/components/sandbox/booking/appointment-views"

export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RescheduleView id={id} />
}
