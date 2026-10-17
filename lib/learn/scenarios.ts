export type ScenarioKind = "positive" | "negative"

export interface ScenarioDef {
  id: string
  description: string
  kind: ScenarioKind
}

const pos = (id: string, description: string): ScenarioDef => ({ id, description, kind: "positive" })
const neg = (id: string, description: string): ScenarioDef => ({ id, description, kind: "negative" })
const rateLimit = neg("rate-limit", "Rate limiting behavior")

/** Every behavior a tester can discover in each Fundamentals challenge, keyed by challenge key. */
export const SCENARIOS: Record<string, ScenarioDef[]> = {
  "first-name": [
    pos("valid-name", "Valid first name"),
    pos("valid-special", "Valid special characters (hyphen/apostrophe)"),
    neg("empty-field", "Empty field submission"),
    neg("max-length", "Maximum length validation"),
    neg("with-numbers", "Name with numbers"),
    neg("special-chars", "Invalid special characters"),
    rateLimit,
  ],
  email: [
    pos("valid-email", "Valid email format"),
    neg("empty-field", "Empty field submission"),
    neg("missing-at", "Missing @ symbol"),
    neg("missing-domain", "Missing domain"),
    neg("invalid-format", "Invalid email format"),
    rateLimit,
  ],
  password: [
    pos("valid-password", "Valid complex password"),
    neg("empty-field", "Empty field submission"),
    neg("too-short", "Password too short"),
    neg("no-uppercase", "Missing uppercase letter"),
    neg("no-number", "Missing number"),
    neg("no-special", "Missing special character"),
    neg("with-spaces", "Password with spaces"),
    rateLimit,
  ],
  age: [
    pos("valid-age", "Valid age number"),
    neg("empty-field", "Empty field submission"),
    neg("non-numeric", "Non-numeric input"),
    neg("negative-age", "Negative age"),
    neg("zero-age", "Zero age"),
    neg("decimal-age", "Decimal age"),
    neg("out-of-range", "Number outside the allowed range"),
    neg("leading-zeros", "Number with leading zeros"),
    rateLimit,
  ],
  checkbox: [
    pos("checked-submit", "Submit with checkbox checked"),
    neg("unchecked-submit", "Submit without checking"),
    pos("toggle-behavior", "Toggle checkbox on and off"),
    pos("label-click", "Click the label instead of the box"),
    rateLimit,
  ],
  "text-area": [
    pos("valid-text", "Valid text submission"),
    pos("empty-field", "Empty submission (allowed)"),
    neg("max-length", "Maximum length validation"),
    pos("special-chars", "Special characters handling"),
    neg("only-spaces", "Only spaces input"),
    pos("line-breaks", "Text with line breaks"),
    rateLimit,
  ],
  select: [
    pos("valid-selection", "Valid option selection"),
    neg("no-selection", "No option selected"),
    pos("multiple-selections", "Try several different options"),
    pos("same-selection", "Submit the same option repeatedly"),
    pos("selection-persistence", "Change your mind and return to an earlier option"),
    rateLimit,
  ],
  "date-picker": [
    pos("valid-date", "Valid date selection"),
    neg("empty-date", "No date selected"),
    neg("past-date", "Date today or earlier"),
    neg("far-future-date", "Date more than 30 days ahead"),
    rateLimit,
  ],
  "file-upload": [
    pos("valid-file", "Valid file upload"),
    pos("jpeg-file", "JPEG upload"),
    pos("png-file", "PNG upload"),
    pos("gif-file", "GIF upload"),
    pos("large-file-accepted", "Large file just under the limit"),
    neg("no-file", "No file selected"),
    neg("invalid-type", "Invalid file type"),
    neg("large-file", "File size limit exceeded"),
    rateLimit,
  ],
  "logic-puzzle": [
    pos("correct-answer", "Correct answer"),
    pos("whitespace-trimming", "Whitespace around the answer"),
    neg("empty-answer", "Empty answer"),
    neg("incorrect-answer", "Incorrect answer"),
    neg("case-sensitive", "Right answer, wrong case"),
    rateLimit,
  ],
  "map-challenge": [
    pos("correct-answer", "Correct location"),
    pos("case-insensitive", "Right answer in a different case"),
    pos("whitespace-trimming", "Whitespace around the answer"),
    neg("empty-answer", "Empty answer"),
    neg("wrong-answer", "Incorrect location"),
    rateLimit,
  ],
  "multi-step": [
    pos("complete-flow", "Complete the whole flow"),
    pos("navigation", "Move between steps"),
    pos("data-persistence", "Data kept between steps"),
    pos("form-modification", "Go back and change data after review"),
    neg("step-validation", "Step validation errors"),
    rateLimit,
  ],
}
