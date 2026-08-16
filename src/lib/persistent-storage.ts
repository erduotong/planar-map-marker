/** Promise of the startup persist() request, so risk queries can await it. */
let persistRequest: Promise<boolean> | undefined

/**
 * Requests persistent storage so the browser won't evict IndexedDB data
 * (projects, floors, features) under disk pressure.
 * Best-effort: unsupported or denied requests degrade to non-persistent
 * storage, logged for debugging.
 */
export function requestPersistentStorage(): void {
  try {
    if (!navigator.storage?.persist) return
    persistRequest = navigator.storage.persist()
    persistRequest
      .then((granted) => {
        console.log(`[persistent-storage] persist() granted: ${granted}`)
      })
      .catch((error) => {
        console.log("[persistent-storage] persist() failed:", error)
      })
  } catch {
    // Storage manager unavailable (e.g. private mode) — ignore.
  }
}

/** True when the browser may evict this origin's data (not persisted). */
export async function hasEvictionRisk(): Promise<boolean> {
  try {
    if (!navigator.storage?.persisted) return false
    await persistRequest?.catch(() => {})
    return !(await navigator.storage.persisted())
  } catch {
    // Unable to query — don't nag the user about an unknown state.
    return false
  }
}
