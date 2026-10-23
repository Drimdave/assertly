import { OrderView } from "@/components/sandbox/shop/order-views"

// Orders are created in the browser, so their ids are not known at build time: the page renders on request
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderView id={id} />
}
