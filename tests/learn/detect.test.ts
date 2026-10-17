import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  submitAge,
  submitDatePicker,
  submitEmail,
  submitFileUpload,
  submitFirstName,
  submitLogicPuzzle,
  submitMapAnswer,
  submitPassword,
  submitTextArea,
} from "@/lib/actions"
import { detectScenarioIds, type SubmitResponse } from "@/lib/learn/detect"
import { SCENARIOS } from "@/lib/learn/scenarios"

/** Calls a real server action in a fresh rate-limit window, with the artificial delay skipped. */
async function call(fn: () => Promise<SubmitResponse>): Promise<SubmitResponse> {
  vi.setSystemTime(Date.now() + 11_000)
  const pending = fn()
  await vi.advanceTimersByTimeAsync(1_100)
  return pending
}

beforeAll(() => {
  vi.useFakeTimers()
})
afterAll(() => {
  vi.useRealTimers()
})

type Case = [label: string, input: string, expected: string[]]

/** Runs each input through the real action, then asserts the detector credits exactly the expected scenarios. */
function table(key: string, action: (input: string) => Promise<SubmitResponse>, cases: Case[]) {
  describe(key, () => {
    it.each(cases)("%s", async (_label, input, expected) => {
      const response = await call(() => action(input))
      const ids = detectScenarioIds(key, input, response)
      expect([...ids].sort()).toEqual([...expected].sort())
      for (const id of ids) expect(SCENARIOS[key].map((s) => s.id)).toContain(id)
    })
  })
}

describe("scenario detection matches the real validators", () => {
  table("first-name", submitFirstName, [
    ["empty", "", ["empty-field"]],
    ["too long", "a".repeat(31), ["max-length"]],
    ["digits", "Bob1", ["with-numbers"]],
    ["invalid symbol", "Bob!", ["special-chars"]],
    ["plain", "Anna", ["valid-name"]],
    ["hyphen", "Mary-Jane", ["valid-name", "valid-special"]],
    ["apostrophe", "O'Neil", ["valid-name", "valid-special"]],
  ])

  table("email", submitEmail, [
    ["empty", "", ["empty-field"]],
    ["no @", "userexample.com", ["missing-at"]],
    ["nothing after @", "user@", ["missing-domain"]],
    ["no TLD", "user@domain", ["missing-domain"]],
    ["short TLD", "user@domain.c", ["invalid-format"]],
    ["space inside", "a b@x.com", ["invalid-format"]],
    ["valid", "me@site.com", ["valid-email"]],
  ])

  table("password", submitPassword, [
    ["empty", "", ["empty-field"]],
    ["short", "Ab1!", ["too-short"]],
    ["no uppercase", "abcdefg1!", ["no-uppercase"]],
    ["no number", "Abcdefgh!", ["no-number"]],
    ["no special", "Abcdefg12", ["no-special"]],
    ["space", "Abc def1!", ["with-spaces"]],
    ["valid", "Abcdefg1!", ["valid-password"]],
  ])

  table("age", submitAge, [
    ["empty", "", ["empty-field"]],
    ["letters", "twenty", ["non-numeric"]],
    ["negative", "-5", ["negative-age"]],
    ["zero", "0", ["zero-age"]],
    ["decimal", "25.5", ["decimal-age"]],
    ["too young", "17", ["out-of-range"]],
    ["too old", "100", ["out-of-range"]],
    ["leading zeros", "007", ["leading-zeros"]],
    ["valid", "25", ["valid-age"]],
  ])

  table("text-area", submitTextArea, [
    ["empty is allowed", "", ["empty-field"]],
    ["only spaces", "   ", ["only-spaces"]],
    ["too long", "x".repeat(201), ["max-length"]],
    ["plain", "hello", ["valid-text"]],
    ["line break", "line1\nline2", ["valid-text", "line-breaks"]],
    ["symbols", "Hi!", ["valid-text", "special-chars"]],
  ])

  table("logic-puzzle", submitLogicPuzzle, [
    ["empty", "", ["empty-answer"]],
    ["wrong", "Wind", ["incorrect-answer"]],
    ["wrong case", "echo", ["incorrect-answer", "case-sensitive"]],
    ["correct", "Echo", ["correct-answer"]],
    ["padded", "  Echo  ", ["correct-answer", "whitespace-trimming"]],
  ])

  table("map-challenge", submitMapAnswer, [
    ["empty", "", ["empty-answer"]],
    ["wrong", "Rome", ["wrong-answer"]],
    ["lower case", "paris", ["correct-answer", "case-insensitive"]],
    ["padded", " Paris ", ["correct-answer", "whitespace-trimming"]],
    ["exact", "Paris", ["correct-answer"]],
  ])
})

describe("date picker", () => {
  const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
  it.each([
    ["no date", () => "", ["empty-date"]],
    ["today", () => daysFromNow(0), ["past-date"]],
    ["in 40 days", () => daysFromNow(40), ["far-future-date"]],
    ["in 5 days", () => daysFromNow(5), ["valid-date"]],
  ] as [string, () => string, string[]][])("%s", async (_label, make, expected) => {
    const input = make()
    const response = await call(() => submitDatePicker(input))
    expect(detectScenarioIds("date-picker", input, response)).toEqual(expected)
  })
})

describe("file upload", () => {
  const file = (type: string, size: number) => ({ name: "f", type, size })
  it.each([
    ["no file", null, "", ["no-file"]],
    ["wrong type", file("text/plain", 10), "text/plain|10", ["invalid-type"]],
    ["too big", file("image/png", 6 * 1024 * 1024), "image/png|6291456", ["large-file"]],
  ] as [string, ReturnType<typeof file> | null, string, string[]][])("%s", async (_label, details, input, expected) => {
    const response = await call(() => submitFileUpload(details))
    expect(detectScenarioIds("file-upload", input, response)).toEqual(expected)
  })
})

describe("rate limiting", () => {
  it("is credited only when the limit actually trips", async () => {
    vi.setSystemTime(Date.now() + 11_000)
    const responses: SubmitResponse[] = []
    for (let i = 0; i < 6; i++) {
      const pending = submitFirstName("Anna")
      await vi.advanceTimersByTimeAsync(600)
      responses.push(await pending)
    }
    expect(detectScenarioIds("first-name", "Anna", responses[0])).toEqual(["valid-name"])
    expect(responses[5].success).toBe(false)
    expect(detectScenarioIds("first-name", "Anna", responses[5])).toEqual(["rate-limit"])
  })
})

describe("scenario config", () => {
  it("has unique ids inside each challenge", () => {
    for (const [key, defs] of Object.entries(SCENARIOS)) {
      const ids = defs.map((d) => d.id)
      expect(new Set(ids).size, key).toBe(ids.length)
    }
  })
})
