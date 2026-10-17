/**
 * Light / dark theme without a provider component. The only moving parts are:
 *  - themeInitScript, an inline script in the server-rendered <head> that sets the class before first paint
 *    (so there is no flash of the wrong theme), and
 *  - the helpers below, used by client components.
 * No <script> is ever rendered from a client component, which React 19 warns about.
 */
export type ThemePreference = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export const THEME_KEY = "assertly-theme"

/** Runs in <head>. Keep the logic in sync with applyTheme / readPreference below. Also reads the old "theme" key. */
export const themeInitScript = `(function(){try{var s=localStorage.getItem("${THEME_KEY}")||localStorage.getItem("theme")||"system";var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`

export function parsePreference(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system"
}

export function readPreference(): ThemePreference {
  try {
    return parsePreference(window.localStorage.getItem(THEME_KEY) ?? window.localStorage.getItem("theme"))
  } catch {
    return "system"
  }
}

const systemPrefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
}

/** What is actually showing right now. The class on <html> is the single source of truth. */
export function getResolvedTheme(): ResolvedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

export function setThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_KEY, preference)
  } catch {
    // storage blocked: the choice still applies for this page view
  }
  applyTheme(resolveTheme(preference))
}

export function toggleTheme() {
  setThemePreference(getResolvedTheme() === "dark" ? "light" : "dark")
}

/** For useSyncExternalStore: tells React when the theme changes, whoever changed it. */
export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

  const media = window.matchMedia("(prefers-color-scheme: dark)")
  const onSystemChange = () => {
    if (readPreference() === "system") applyTheme(resolveTheme("system"))
  }
  media.addEventListener("change", onSystemChange)

  // another tab changed the preference
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY || e.key === null) applyTheme(resolveTheme(readPreference()))
  }
  window.addEventListener("storage", onStorage)

  return () => {
    observer.disconnect()
    media.removeEventListener("change", onSystemChange)
    window.removeEventListener("storage", onStorage)
  }
}
