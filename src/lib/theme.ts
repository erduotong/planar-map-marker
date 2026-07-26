export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "map-pointer:theme"

const THEMES: readonly Theme[] = ["light", "dark", "system"]

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.includes(value as Theme)
}

/** Reads the persisted preference, falling back to "system". */
export function readStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(raw) ? raw : "system"
  } catch {
    // Private mode / storage disabled — the default is good enough.
    return "system"
  }
}

export function prefersDark(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: dark)").matches
  )
}

export function resolveTheme(theme: Theme, systemPrefersDark: boolean) {
  if (theme === "system") return systemPrefersDark ? "dark" : "light"
  return theme
}

/**
 * The shadcn preset defines dark mode as `&:is(.dark *)`, so the resolved theme
 * lives as a class on <html>. `color-scheme` keeps native widgets in step.
 */
export function applyResolvedTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle("dark", resolved === "dark")
  root.style.colorScheme = resolved
}
