// Dexie talks to a real IndexedDB implementation, so tests get an in-memory one
// installed on globalThis. Harmless for tests that never touch the database.
import "fake-indexeddb/auto"

// Pin the UI language to Chinese so domain-layer tests that assert localized
// error messages stay stable. Runs before any module imports @/i18n.
;(globalThis as unknown as { __TEST_LANGUAGE__?: string }).__TEST_LANGUAGE__ =
  "zh-CN"
