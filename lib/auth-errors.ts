/**
 * What the sign-in pages say when someone comes back from GitHub with a problem. Better Auth sends them to
 * `?error=<code>`; only our own words are ever shown (never the code or its description from the address, which anyone can
 * write), so a crafted link cannot put text of its choosing on our page.
 */
const MESSAGES: Record<string, string> = {
  // The email already belongs to an account made with a password and not yet confirmed (or GitHub's own email is not
  // confirmed): attaching GitHub to it could hand it to whoever chose that password, so it is refused on purpose
  account_not_linked: "This email already has an account that was made with a password, so GitHub cannot be used to sign in to it. Sign in with your password.",
  access_denied: "GitHub sign-in was cancelled.",
}

const GENERIC = "GitHub sign-in did not work. Try again, or use your email and password."

export function oauthErrorMessage(code: string | undefined): string | undefined {
  if (!code) return undefined
  // Own properties only: "constructor" or "__proto__" in the address must not find something the object inherits
  return Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : GENERIC
}
