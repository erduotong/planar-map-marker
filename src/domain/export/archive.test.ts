import JSZip from "jszip"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PlanarMapMarkerDatabase } from "@/db/database"
import { ProjectRepository } from "@/db/project-repository"
import {
  ArchiveImportError,
  buildGeojsonZip,
  buildProjectPackage,
  parseProjectPackage,
} from "@/domain/export/archive"
import { makeSnapshot } from "@/domain/export/fixtures"
import { buildExportFiles } from "@/domain/export/geojson"
import {
  ARCHIVE_VERSION,
  rebuildSnapshot,
  serializeSnapshot,
} from "@/domain/export/snapshot-io"

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer))
}

describe("buildGeojsonZip", () => {
  it("contains one geojson file per layer", async () => {
    const snapshot = makeSnapshot()
    const blob = await buildGeojsonZip(buildExportFiles(snapshot))
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const files = Object.keys(zip.files).filter((name) => !name.endsWith("/"))
    expect(files.sort()).toEqual([
      "1F/房间.geojson",
      "1F/点位.geojson",
      "1F/路线.geojson",
      "2F/电梯口.geojson",
    ])
  })
})

describe("package round-trip", () => {
  let database: PlanarMapMarkerDatabase
  let repository: ProjectRepository

  beforeEach(() => {
    database = new PlanarMapMarkerDatabase(`archive-test-${crypto.randomUUID()}`)
    repository = new ProjectRepository(database)
  })

  afterEach(async () => {
    await database.delete()
  })

  it("exports, parses and restores an identical project", async () => {
    const original = makeSnapshot()
    const blob = await buildProjectPackage(original, buildExportFiles(original))
    const parsed = await parseProjectPackage(await blob.arrayBuffer())

    expect(parsed.manifest).toMatchObject({
      format: "planar-map-marker-project",
      version: ARCHIVE_VERSION,
      projectName: "示例项目",
    })
    expect(parsed.data.project.id).toBe("project-1")
    expect(parsed.data.assets[0]?.dataPath).toBe("assets/asset-1.png")

    const rehydrated = rebuildSnapshot(parsed.data, parsed.assetBlobs)
    const rehydratedAsset = rehydrated.assets[0]
    const originalAsset = original.assets[0]
    if (!rehydratedAsset || !originalAsset) throw new Error("fixture missing")

    // The asset bytes survived the round-trip intact.
    expect(await blobBytes(rehydratedAsset.blob)).toEqual(
      await blobBytes(originalAsset.blob),
    )

    await repository.restore(rehydrated)
    const restored = await repository.snapshot(rehydrated.project.id)
    const restoredAsset = restored.assets[0]
    expect(restored.project.name).toBe("示例项目")
    expect(restored.floors).toHaveLength(2)
    expect(restored.layers).toHaveLength(4)
    expect(restored.features).toHaveLength(3)
    expect(restored.routeNodes).toHaveLength(2)
    expect(restored.routeEdges).toHaveLength(2)
    expect(restoredAsset?.blob.size).toBe(originalAsset.blob.size)
    expect(restoredAsset?.mime).toBe("image/png")
  })

  it("rejects a package from a newer format version", async () => {
    const snapshot = makeSnapshot()
    const data = serializeSnapshot(snapshot)
    const zip = new JSZip()
    zip.file(
      "manifest.json",
      JSON.stringify({
        format: "planar-map-marker-project",
        version: ARCHIVE_VERSION + 1,
        app: "planar-map-marker",
        exportedAt: 1,
        projectId: "project-1",
        projectName: "示例项目",
      }),
    )
    zip.file("project.json", JSON.stringify(data))
    const blob = await zip.generateAsync({ type: "blob" })

    await expect(parseProjectPackage(await blob.arrayBuffer())).rejects.toThrow(
      /版本（v2）高于当前应用支持的版本/,
    )
  })

  it("rejects a package from another application", async () => {
    const zip = new JSZip()
    zip.file(
      "manifest.json",
      JSON.stringify({ format: "something-else", version: 1 }),
    )
    zip.file("project.json", JSON.stringify({}))
    const blob = await zip.generateAsync({ type: "blob" })
    await expect(parseProjectPackage(await blob.arrayBuffer())).rejects.toThrow(
      /不是 Planar Map Marker 项目包/,
    )
  })

  it("rejects a package with corrupt data", async () => {
    const zip = new JSZip()
    zip.file(
      "manifest.json",
      JSON.stringify({
        format: "planar-map-marker-project",
        version: 1,
        app: "planar-map-marker",
        exportedAt: 1,
        projectId: "project-1",
        projectName: "示例项目",
      }),
    )
    zip.file("project.json", JSON.stringify({ floors: "nope" }))
    const blob = await zip.generateAsync({ type: "blob" })
    await expect(parseProjectPackage(await blob.arrayBuffer())).rejects.toThrow(
      ArchiveImportError,
    )
  })

  it("rejects a zip that is not a package at all", async () => {
    const zip = new JSZip()
    zip.file("hello.txt", "hi")
    const blob = await zip.generateAsync({ type: "blob" })
    await expect(parseProjectPackage(await blob.arrayBuffer())).rejects.toThrow(
      /缺少 manifest.json/,
    )
  })
})
