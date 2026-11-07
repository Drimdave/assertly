import { applyOnboarding, GIVE_UP_MS, onLocalOnboardingChange, readLocalOnboarding, setAccountPending } from "@/lib/onboarding/flags"
import { cleanOnboarding, mergeOnboarding, sameOnboarding, type OnboardingState } from "@/lib/onboarding/state"

export { GIVE_UP_MS }

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

async function call(fetchImpl: Fetch, method: "GET" | "PUT", body?: OnboardingState): Promise<OnboardingState> {
  const res = await fetchImpl("/api/onboarding", {
    method,
    credentials: "same-origin",
    ...(body && { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  })
  if (!res.ok) throw new Error(`onboarding ${method} ${res.status}`)
  return cleanOnboarding(await res.json())
}

/**
 * Keeps the tour flag and the pages-opened list in step with the signed-in person's account, in both directions, and
 * returns a function that stops it. On the way in it adds what the account holds to this browser and, if this browser knew
 * something the account did not (a guest who then signed up), tells the account. After that every change here is sent.
 *
 * Both ways are additions only, so nothing here can take anything away or overwrite another device, and a message that is
 * lost or sent twice does no harm: the next one carries everything. That is why there is no revision number and no retry
 * queue, just "send what this browser holds".
 */
export function startOnboardingSync(fetchImpl: Fetch = (url, init) => fetch(url, init)): () => void {
  let stopped = false
  let sending = false
  let sendAgain = false
  let failed = false

  setAccountPending(true) // it clears itself after GIVE_UP_MS if nothing here does

  async function send() {
    if (stopped) return
    if (sending) {
      sendAgain = true // a change came in while one was going out: send once more afterwards, with all of it
      return
    }
    sending = true
    try {
      const sum = await call(fetchImpl, "PUT", readLocalOnboarding())
      failed = false
      if (!stopped) applyOnboarding(sum) // it may hold more than was sent: another device's
    } catch {
      failed = true // offline, or signed out meanwhile: tried again at the next change, or when back online
    } finally {
      sending = false
    }
    if (sendAgain && !stopped) {
      sendAgain = false
      void send()
    }
  }

  async function load() {
    try {
      const account = await call(fetchImpl, "GET")
      if (stopped) return
      const here = readLocalOnboarding()
      applyOnboarding(account)
      setAccountPending(false)
      // This browser knew something the account did not: tell it
      if (!sameOnboarding(mergeOnboarding(here, account), account)) void send()
    } catch {
      if (stopped) return
      failed = true // go ahead on what this browser holds; its changes will still try to save
      setAccountPending(false)
    }
  }

  const stopListening = onLocalOnboardingChange(() => void send())
  const backOnline = () => {
    if (failed) void send()
  }
  if (typeof window !== "undefined") window.addEventListener("online", backOnline)
  void load()

  return () => {
    stopped = true
    stopListening()
    if (typeof window !== "undefined") window.removeEventListener("online", backOnline)
  }
}
