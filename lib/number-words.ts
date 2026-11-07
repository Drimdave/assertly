const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"]

/** A small count as a word, for copy: "four", not "4". Larger numbers stay as digits. */
export const numberWord = (n: number) => WORDS[n] ?? String(n)
