import { expect, test, type Locator, type Page } from "@playwright/test"

const open = async (page: Page) => {
  await page.goto("/app/novabank/board")
  await expect(page.getByRole("region", { name: "Not run" })).toBeVisible()
  await expect(page.getByRole("button", { name: /^TC-010:/ })).toBeVisible()
}

const lane = (page: Page, name: string) => page.getByRole("region", { name })
const card = (scope: Page | Locator, key: string) => scope.getByRole("button", { name: new RegExp(`^${key}:`) })

/**
 * Picks a card up with the keyboard and moves it right until it is over `endLane`. dnd-kit starts listening for
 * arrow keys a tick after pick-up, and its screen-reader live region only keeps the latest message, so wait for the
 * first stable one ("over <start lane>") before pressing arrows.
 */
async function pickUpAndMoveRight(page: Page, key: string, startLane: string, endLane: string) {
  await card(page, key).focus()
  await page.keyboard.press("Space")
  await expect(page.getByText(`${key} is over ${startLane}.`)).toBeAttached()

  // Press, then let the drag settle, until the target lane is announced (a person pauses between keys too)
  const arrived = page.getByText(`${key} is over ${endLane}.`)
  for (let i = 0; i < 6 && (await arrived.count()) === 0; i++) {
    await page.keyboard.press("ArrowRight")
    await page.waitForTimeout(200)
  }
  await expect(arrived).toBeAttached()
}

test.describe("board", () => {
  test("shows every test case in the right column", async ({ page }) => {
    await open(page)
    await expect(lane(page, "Not run").getByRole("button", { name: /^TC-/ })).toHaveCount(3)
    await expect(lane(page, "In progress").getByRole("button", { name: /^TC-/ })).toHaveCount(2)
    await expect(lane(page, "Passed").getByRole("button", { name: /^TC-/ })).toHaveCount(4)
    await expect(lane(page, "Failed").getByRole("button", { name: /^TC-/ })).toHaveCount(2)
    await expect(lane(page, "Blocked").getByRole("button", { name: /^TC-/ })).toHaveCount(1)
  })

  test("drag with the mouse changes status, and the table agrees", async ({ page }) => {
    await open(page)
    const from = (await card(page, "TC-010").boundingBox())!
    const to = (await lane(page, "In progress").boundingBox())!

    await page.mouse.move(from.x + 40, from.y + 20)
    await page.mouse.down()
    await page.mouse.move(to.x + 80, to.y + 120, { steps: 20 })
    await page.mouse.up()

    await expect(card(lane(page, "In progress"), "TC-010")).toBeVisible()
    await expect(page.getByText("TC-010 moved to In progress")).toBeVisible()

    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row", { name: /TC-010/ })).toContainText("In progress")
  })

  test("a short click opens the case instead of dragging", async ({ page }) => {
    await open(page)
    await card(page, "TC-011").click()
    await expect(page.getByRole("dialog")).toContainText("TC-011")
  })

  test("keyboard: Space picks up, arrows move, Space drops", async ({ page }) => {
    await open(page)
    await pickUpAndMoveRight(page, "TC-011", "Not run", "In progress")
    await page.keyboard.press("Space")

    await expect(card(lane(page, "In progress"), "TC-011")).toBeVisible()
    await expect(card(lane(page, "Not run"), "TC-011")).toHaveCount(0)
  })

  test("keyboard: Escape cancels and nothing changes", async ({ page }) => {
    await open(page)
    await pickUpAndMoveRight(page, "TC-011", "Not run", "In progress")
    await page.keyboard.press("Escape")

    await expect(card(lane(page, "Not run"), "TC-011")).toBeVisible()
    await expect(page.getByText(/moved to/)).toHaveCount(0)
  })

  test("keyboard: Enter opens the case", async ({ page }) => {
    await open(page)
    await card(page, "TC-012").focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("dialog")).toContainText("TC-012")
  })

  test("a move can be undone", async ({ page }) => {
    await open(page)
    await pickUpAndMoveRight(page, "TC-012", "Not run", "In progress")
    await page.keyboard.press("Space")
    await expect(card(lane(page, "In progress"), "TC-012")).toBeVisible()

    await page.getByRole("button", { name: "Undo" }).click()
    await expect(card(lane(page, "Not run"), "TC-012")).toBeVisible()
  })
})
