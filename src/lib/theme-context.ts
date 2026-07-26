import { createContext } from "react"
import type { ResolvedTheme, Theme } from "@/lib/theme"

export interface ThemeContextValue {
  theme: Theme
  resolved: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
