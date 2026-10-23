/** Money is always whole cents; this is the only place it turns into text. */
export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}
