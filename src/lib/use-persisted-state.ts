import { useEffect, useState } from "react"

/** useState that mirrors its value into localStorage so user-tuned layouts survive reloads. */
export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, (value: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage full / unavailable — the layout just won't persist.
    }
  }, [key, value])

  return [value, setValue]
}
