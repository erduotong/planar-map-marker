import { describe, expect, it } from "vitest"
import { makeSnapshot } from "@/domain/export/fixtures"
import {
  assetDataPath,
  rebuildSnapshot,
  serializeSnapshot,
  validateArchiveData,
} from "@/domain/export/snapshot-io"

describe("serializeSnapshot", () => {
  it("maps assets to data paths and keeps entity ids", () => {
    const data = serializeSnapshot(makeSnapshot())
    expect(data.project.id).toBe("project-1")
    expect(data.assets.map((asset) => asset.dataPath)).toEqual([
      "assets/asset-1.png",
      "assets/asset-2.png",
    ])
    expect(data.assets[0]).toMatchObject({ id: "asset-1", mime: "image/png" })
  })
})

describe("rebuildSnapshot", () => {
  it("assigns a fresh project id and rehydrates asset blobs", () => {
    const data = serializeSnapshot(makeSnapshot())
    const blobs = new Map<string, Blob>()
    for (const asset of data.assets) {
      blobs.set(
        asset.dataPath,
        new Blob([new Uint8Array([1, 2, 3])], { type: asset.mime }),
      )
    }
    const firstBlob = blobs.get("assets/asset-1.png")
    if (!firstBlob) throw new Error("fixture missing")
    const snapshot = rebuildSnapshot(data, blobs)
    expect(snapshot.project.id).not.toBe("project-1")
    expect(snapshot.project.lastExportedAt).toBeNull()
    expect(snapshot.project.createdAt).toBeGreaterThan(0)
    expect(snapshot.floors[0]?.projectId).toBe(snapshot.project.id)
    expect(snapshot.assets[0]?.blob).toBe(firstBlob)
    expect(snapshot.assets[0]?.projectId).toBe(snapshot.project.id)
    expect(snapshot.layers[0]?.id).toBe("layer-point")
  })

  it("fails loudly when an asset blob is missing", () => {
    const data = serializeSnapshot(makeSnapshot())
    expect(() => rebuildSnapshot(data, new Map())).toThrow(/缺少底图文件/)
  })
})

describe("validateArchiveData", () => {
  it("accepts a well-formed payload", () => {
    const data = serializeSnapshot(makeSnapshot())
    expect(validateArchiveData(data)).toEqual([])
  })

  it("rejects a payload that is not an object", () => {
    expect(validateArchiveData(null)).not.toEqual([])
  })

  it("rejects entities belonging to another project", () => {
    const data = serializeSnapshot(makeSnapshot())
    const floor = data.floors[0]
    if (!floor) throw new Error("fixture missing")
    data.floors = [{ ...floor, projectId: "other" }]
    expect(validateArchiveData(data)).toContain("存在不属于该项目的楼层数据")
  })

  it("rejects layers pointing at a missing floor", () => {
    const data = serializeSnapshot(makeSnapshot())
    data.floors = data.floors.filter((floor) => floor.id !== "floor-1")
    expect(validateArchiveData(data).join(" ")).toContain("所属楼层不存在")
  })

  it("rejects edges whose feature endpoint is missing", () => {
    const data = serializeSnapshot(makeSnapshot())
    data.features = data.features.filter(
      (feature) => feature.id !== "feature-lift",
    )
    expect(validateArchiveData(data).join(" ")).toContain(
      "edge-lif 的终点点要素不存在",
    )
  })

  it("caps the error count", () => {
    const data = serializeSnapshot(makeSnapshot())
    data.layers = []
    data.features = []
    data.routeNodes = []
    data.routeEdges = []
    expect(validateArchiveData(data).length).toBeLessThanOrEqual(20)
  })
})

describe("assetDataPath", () => {
  it("maps mime types to file extensions", () => {
    expect(assetDataPath("a", "image/png")).toBe("assets/a.png")
    expect(assetDataPath("a", "image/jpeg")).toBe("assets/a.jpg")
    expect(assetDataPath("a", "image/webp")).toBe("assets/a.webp")
    expect(assetDataPath("a", "image/svg+xml")).toBe("assets/a.svg")
  })
})
