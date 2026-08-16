import { afterEach, describe, expect, it, vi } from "vitest"
import { requestPersistentStorage } from "@/lib/persistent-storage"

function stubNavigatorStorage(storage?: { persist: () => Promise<boolean> }) {
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
