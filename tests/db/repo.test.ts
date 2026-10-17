// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest"

import { createSeedState } from "@/lib/workspace/seed"
import { initialState } from "@/lib/sandbox/novabank/engine"

process.env.PGLITE_DIR = "memory://"

const { getDb, schema } = await import("@/lib/db")
const repo = await import("@/lib/db/repo")

const doc = () => ({ workspace: createSeedState(new Date("2026-01-01T00:00:00Z")), sandbox: initialState() })

async function addUser(id: string) {
  const db = await getDb()
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com` })
}

describe("workspace documents", () => {
  beforeAll(async () => {
    await getDb() // runs the migrations
  })

  it("creates a document at revision 1 and reads it back", async () => {
    await addUser("u1")
    const db = await getDb()
    expect(await repo.loadDoc(db, "u1")).toBeNull()
    expect(await repo.saveDoc(db, "u1", doc(), 0)).toEqual({ ok: true, rev: 1 })
    const loaded = await repo.loadDoc(db, "u1")
    expect(loaded?.rev).toBe(1)
    expect((loaded?.workspace as { cases: unknown[] }).cases).toHaveLength(12)
  })

  it("accepts a write based on the latest revision and bumps it", async () => {
    await addUser("u2")
    const db = await getDb()
    await repo.saveDoc(db, "u2", doc(), 0)
    expect(await repo.saveDoc(db, "u2", doc(), 1)).toEqual({ ok: true, rev: 2 })
    expect(await repo.saveDoc(db, "u2", doc(), 2)).toEqual({ ok: true, rev: 3 })
  })

  it("rejects a stale write and returns the current document", async () => {
    await addUser("u3")
    const db = await getDb()
    await repo.saveDoc(db, "u3", doc(), 0)
    await repo.saveDoc(db, "u3", doc(), 1) // another device moved on to revision 2
    const stale = await repo.saveDoc(db, "u3", doc(), 1)
    expect(stale.ok).toBe(false)
    expect(!stale.ok && stale.current?.rev).toBe(2)
  })

  it("rejects creating a document that already exists", async () => {
    await addUser("u4")
    const db = await getDb()
    await repo.saveDoc(db, "u4", doc(), 0)
    const again = await repo.saveDoc(db, "u4", doc(), 0)
    expect(again.ok).toBe(false)
  })

  it("keeps each user's document separate", async () => {
    await addUser("u5")
    await addUser("u6")
    const db = await getDb()
    await repo.saveDoc(db, "u5", doc(), 0)
    expect(await repo.loadDoc(db, "u6")).toBeNull()
  })
})

describe("shares", () => {
  it("serves a share publicly until the owner revokes it", async () => {
    await addUser("s1")
    await addUser("s2")
    const db = await getDb()
    await repo.createShare(db, "s1", "abc123", "NovaBank summary", { hello: "world" })
    expect((await repo.getShare(db, "abc123"))?.snapshot).toEqual({ hello: "world" })
    expect((await repo.listShares(db, "s1")).map((s) => s.id)).toEqual(["abc123"])

    expect(await repo.revokeShare(db, "s2", "abc123")).toBe(false) // not the owner
    expect(await repo.getShare(db, "abc123")).not.toBeNull()

    expect(await repo.revokeShare(db, "s1", "abc123")).toBe(true)
    expect(await repo.getShare(db, "abc123")).toBeNull()
    expect(await repo.listShares(db, "s1")).toEqual([])
    expect(await repo.revokeShare(db, "s1", "abc123")).toBe(false) // already revoked
  })
})

describe("on-disk database", () => {
  it("creates its folder, and what is saved survives reopening it", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const nodePath = await import("node:path")
    const root = mkdtempSync(nodePath.join(tmpdir(), "assertly-pglite-"))
    const dir = nodePath.join(root, "does", "not", "exist", "yet") // the case that broke a fresh clone
    try {
      const { openPglite } = await import("@/lib/db")
      const first = openPglite(dir)
      await first.exec("CREATE TABLE t (n int); INSERT INTO t VALUES (42);")
      await first.close()
      const second = openPglite(dir)
      expect((await second.query<{ n: number }>("SELECT n FROM t")).rows).toEqual([{ n: 42 }])
      await second.close()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
