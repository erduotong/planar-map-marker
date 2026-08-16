import { afterEach, describe, expect, it, vi } from "vitest"
import {
  hasEvictionRisk,
  requestPersistentStorage,
} from "@/lib/persistent-storage"

function stubNavigatorStorage(storage?: {
  persist?: () => Promise<boolean>
  persisted?: () => Promise<boolean>
}) {
  vi.stubGlobal("navigator", { storage })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("requestPersistentStorage", () => {
  it("requests persistence once when the storage manager is available", () => {
    const persist = vi.fn().mockResolvedValue(true)
    stubNavigatorStorage({ persist })

    requestPersistentStorage()

    expect(persist).toHaveBeenCalledOnce()
  })

  it("does nothing when navigator.storage is unavailable", () => {
    stubNavigatorStorage(undefined)

    expect(() => requestPersistentStorage()).not.toThrow()
  })

  it("swallows a rejected persist() request", async () => {
    stubNavigatorStorage({ persist: () => Promise.reject(new Error("denied")) })

    expect(() => requestPersistentStorage()).not.toThrow()
    // Give the rejected promise a tick to surface as unhandled.
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})

describe("hasEvictionRisk", () => {
  it("returns true when storage is not persisted", async () => {
    stubNavigatorStorage({
      persisted: vi.fn().mockResolvedValue(false),
    })

    await expect(hasEvictionRisk()).resolves.toBe(true)
  })

  it("returns false when storage is persisted", async () => {
    stubNavigatorStorage({
      persisted: vi.fn().mockResolvedValue(true),
    })

    await expect(hasEvictionRisk()).resolves.toBe(false)
  })

  it("returns false when navigator.storage is unavailable", async () => {
    stubNavigatorStorage(undefined)

    await expect(hasEvictionRisk()).resolves.toBe(false)
  })

  it("waits for the startup persist() request before querying", async () => {
    let resolvePersist!: (granted: boolean) => void
    const persistDeferred = new Promise<boolean>(
      (resolve) => (resolvePersist = resolve),
    )
    const persisted = vi.fn().mockResolvedValue(false)
    stubNavigatorStorage({ persist: () => persistDeferred, persisted })

    requestPersistentStorage()
    const risk = hasEvictionRisk()
    resolvePersist(false)

    await expect(risk).resolves.toBe(true)
    expect(persisted).toHaveBeenCalled()
  })
})
