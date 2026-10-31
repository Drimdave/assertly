import { SYSTEMS } from "@/lib/systems/registry"

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"]
const word = (n: number) => WORDS[n] ?? String(n)

/** Numbers the page quotes, read from the registry so they stay true when a system is added. */
export const SYSTEM_COUNT = SYSTEMS.length
export const SYSTEM_COUNT_WORD = word(SYSTEMS.length)
/** Every system hides the same number of defects (a registry test checks that), so one number serves them all. */
export const DEFECT_COUNT = SYSTEMS[0].bugs.length
export const DEFECT_COUNT_WORD = word(DEFECT_COUNT)
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const SYSTEM_COUNT_TITLE = capital(SYSTEM_COUNT_WORD)
