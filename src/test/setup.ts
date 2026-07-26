// Dexie talks to a real IndexedDB implementation, so tests get an in-memory one
// installed on globalThis. Harmless for tests that never touch the database.
import "fake-indexeddb/auto"
