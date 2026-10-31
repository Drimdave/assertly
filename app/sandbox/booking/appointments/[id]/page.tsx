import { AppointmentView } from "@/components/sandbox/booking/appointment-views"

// Appointments are created in the browser, so their ids are not known at build time: the page renders on request
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AppointmentView id={id} />
}
