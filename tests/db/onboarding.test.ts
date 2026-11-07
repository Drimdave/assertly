// @vitest-environment node
import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it } from "vitest"

process.env.PGLITE_DIR = "memory://"

const { getDb, schema } = await import("@/lib/db")
const repo = await import("@/lib/db/repo")

async function addUser(id: string) {
  const db = await getDb()
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com` })
}

describe("what a person has done outside their work, saved in their account", () => {
  beforeAll(async () => {
    await getDb() // runs the migrations, including the one that makes the table
  })

  it("is nothing at all until something is saved", async () => {
    await addUser("o1")
    expect(await repo.loadOnboarding(await getDb(), "o1")).toEqual({ tourDone: false, seen: [] })
  })

  it("is made by the first save, and read back", async () => {
    await addUser("o2")
    const db = await getDb()
    expect(await repo.mergeOnboardingState(db, "o2", { seen: ["requirements"] })).toEqual({ tourDone: false, seen: ["requirements"] })
    expect(await repo.loadOnboarding(db, "o2")).toEqual({ tourDone: false, seen: ["requirements"] })
  })

  it("adds to what is there, never replaces it", async () => {
    await addUser("o3")
    const db = await getDb()
    await repo.mergeOnboardingState(db, "o3", { seen: ["requirements"] })
    await repo.mergeOnboardingState(db, "o3", { seen: ["report"], tourDone: true })
    expect(await repo.mergeOnboardingState(db, "o3", { seen: ["traceability"] })).toEqual({ tourDone: true, seen: ["requirements", "report", "traceability"] })
  })

  it("never turns the tour back on its head: once done it stays done, whatever a device says", async () => {
    await addUser("o4")
    const db = await getDb()
    await repo.mergeOnboardingState(db, "o4", { tourDone: true })
    expect((await repo.mergeOnboardingState(db, "o4", { tourDone: false })).tourDone).toBe(true)
    expect((await repo.mergeOnboardingState(db, "o4", {})).tourDone).toBe(true)
    expect((await repo.mergeOnboardingState(db, "o4", { seen: [] })).tourDone).toBe(true)
  })

  it("never forgets a page: sending fewer, or none, takes nothing away", async () => {
    await addUser("o5")
    const db = await getDb()
    await repo.mergeOnboardingState(db, "o5", { seen: ["requirements", "report", "traceability"] })
    expect((await repo.mergeOnboardingState(db, "o5", { seen: [] })).seen).toEqual(["requirements", "report", "traceability"])
    expect((await repo.mergeOnboardingState(db, "o5", { seen: ["report"] })).seen).toEqual(["requirements", "report", "traceability"])
  })

  it("is the same after saving the same thing again, with no page listed twice", async () => {
    await addUser("o6")
    const db = await getDb()
    const first = await repo.mergeOnboardingState(db, "o6", { tourDone: true, seen: ["report"] })
    const again = await repo.mergeOnboardingState(db, "o6", { tourDone: true, seen: ["report"] })
    expect(again).toEqual(first)
    const [row] = await db.select().from(schema.onboardingState).where(eq(schema.onboardingState.userId, "o6"))
    expect(row.seen).toEqual(["report"])
  })

  it("keeps everything when several devices save at once, even for a person with nothing saved yet", async () => {
    await addUser("o7")
    const db = await getDb()
    await Promise.all([
      repo.mergeOnboardingState(db, "o7", { seen: ["requirements"] }),
      repo.mergeOnboardingState(db, "o7", { seen: ["report"], tourDone: true }),
      repo.mergeOnboardingState(db, "o7", { seen: ["traceability"] }),
      repo.mergeOnboardingState(db, "o7", { seen: ["report"] }),
    ])
    expect(await repo.loadOnboarding(db, "o7")).toEqual({ tourDone: true, seen: ["requirements", "report", "traceability"] })
  })

  it("is one person's alone", async () => {
    await addUser("o8a")
    await addUser("o8b")
    const db = await getDb()
    await repo.mergeOnboardingState(db, "o8a", { tourDone: true, seen: ["report"] })
    expect(await repo.loadOnboarding(db, "o8b")).toEqual({ tourDone: false, seen: [] })
  })

  it("goes when the account goes", async () => {
    await addUser("o9")
    const db = await getDb()
    await repo.mergeOnboardingState(db, "o9", { tourDone: true, seen: ["report"] })
    await db.delete(schema.user).where(eq(schema.user.id, "o9"))
    expect(await db.select().from(schema.onboardingState).where(eq(schema.onboardingState.userId, "o9"))).toEqual([])
  })

  it("reads stray data as nothing rather than failing: a page we no longer know is dropped", async () => {
    await addUser("o10")
    const db = await getDb()
    await db.insert(schema.onboardingState).values({ userId: "o10", tourDone: false, seen: ["report", "a-page-from-the-future"] })
    expect(await repo.loadOnboarding(db, "o10")).toEqual({ tourDone: false, seen: ["report"] })
    // and folding more in keeps what is stored and adds what is sent, without choking on the stray one
    expect((await repo.mergeOnboardingState(db, "o10", { seen: ["requirements"] })).seen).toEqual(["requirements", "report"])
  })
})
