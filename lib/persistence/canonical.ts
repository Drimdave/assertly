/**
 * JSON with object keys in sorted order. Postgres `jsonb` does not keep key order, so a document read back from the
 * database stringifies differently from the same document in the browser; comparing canonical forms avoids
 * treating "same data, different order" as a change.
 */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v,
  )
}
