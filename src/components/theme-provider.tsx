import { useCallback, useEffect, useMemo, useState } from "react"
import {
  applyResolvedTheme,
  prefersDark,
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme"
import { ThemeContext } from "@/lib/theme-context"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [systemDark, setSystemDark] = useState(prefersDark)

  // Only "system" cares about the OS preference, but the listener is cheap and
  // keeping it always-on avoids a stale value when switching back to "system".
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)")
    const onChange = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches)
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  const resolved = resolveTheme(theme, systemDark)

  useEffect(() => {
    applyResolvedTheme(resolved)
  }, [resolved])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Preference just won't survive a reload; not worth surfacing.
    }
  }, [])

  const value = useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
