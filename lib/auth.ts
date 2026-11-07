import { headers } from "next/headers"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"

import { dbUnsafe, getDb, schema } from "@/lib/db"
import { emailEnabled, inBackground, sendMail } from "@/lib/email"
import { passwordChangedEmail, resetPasswordEmail, RESET_TTL_SECONDS, VERIFY_TTL_SECONDS, verifyEmailEmail } from "@/lib/email/templates"

/**
 * Accounts: email and password, plus GitHub when its credentials are configured.
 *
 * Password reset and email verification need email to go out (`lib/email`). When it is not set up, neither is turned
 * on and the pages do not offer them. Verification is sent at sign-up but does not block anyone: this is a practice
 * tool, and a typo in an address should not lock a learner out. Flip `requireEmailVerification` to change that.
 */
function build() {
  const github =
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET } }
      : undefined

  const mail = emailEnabled()

  return betterAuth({
    // Unset in development: the library then derives it from the request
    baseURL: process.env.BETTER_AUTH_URL || undefined,
    database: drizzleAdapter(dbUnsafe(), { provider: "pg", schema }),
    // Production must set BETTER_AUTH_SECRET (the library refuses to start without it); development gets a fixed
    // throwaway so `npm run dev` works with no setup
    secret: process.env.BETTER_AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "assertly-development-secret-do-not-use-in-production"),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      ...(mail && {
        resetPasswordTokenExpiresIn: RESET_TTL_SECONDS,
        // Someone resetting a password may be doing it because the account is no longer theirs alone: end every session
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ user, url }) => {
          await sendMail({ to: user.email, ...resetPasswordEmail({ name: user.name, url }) })
        },
        onPasswordReset: async ({ user }) => {
          await sendMail({ to: user.email, ...passwordChangedEmail({ name: user.name }) })
        },
      }),
    },
    ...(mail && {
      emailVerification: {
        sendOnSignUp: true,
        expiresIn: VERIFY_TTL_SECONDS,
        // The link proves the address, not who is holding it: it does not sign anyone in
        autoSignInAfterVerification: false,
        sendVerificationEmail: async ({ user, url }) => {
          await sendMail({ to: user.email, ...verifyEmailEmail({ name: user.name, url }) })
        },
      },
    }),
    advanced: { backgroundTasks: { handler: inBackground } },
    socialProviders: github,
    // Deleting an account asks for the password. Someone with no password (they signed in with GitHub) is let through
    // only on a session this new, so a stolen session cookie cannot delete an account an hour later. Better Auth's own
    // default for "new" is a whole day.
    user: { deleteUser: { enabled: true } },
    session: { freshAge: 60 * 5 },
    // The e2e suite signs up many accounts from one address in seconds
    // The library already limits the two routes that send email (a reset request, a confirmation email) to three a
    // minute per address, and sign-in, sign-up and password change to three every ten seconds. Left on, so that holds;
    // tests/auth/email-flows.test.ts fails if it stops. The e2e suite signs up many accounts from one address in seconds.
    rateLimit: { enabled: process.env.AUTH_RATE_LIMIT !== "off" },
    plugins: [nextCookies()],
  })
}

type Auth = ReturnType<typeof build>
const globalForAuth = globalThis as unknown as { __assertlyAuth?: Auth }

/** The auth instance, created on first use (after the database is ready), never at import time. */
export async function getAuth(): Promise<Auth> {
  await getDb()
  return (globalForAuth.__assertlyAuth ??= build())
}

/** True when GitHub sign-in is configured, so the UI only offers it when it will work. */
export const githubEnabled = () => !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)

/** The signed-in user for a server component, or null. */
export async function getSession() {
  const auth = await getAuth()
  return auth.api.getSession({ headers: await headers() })
}
