import { describe, expect, it } from "vitest"
import { makeSnapshot } from "@/domain/export/fixtures"
import { runPreflight } from "@/domain/export/preflight"

describe("runPreflight", () => {
  it("passes a complete project", () => {
    const result = runPreflight(makeSnapshot())
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it("blocks when there are no floors", () => {
    const snapshot = makeSnapshot({ floors: [], layers: [] })
    expect(runPreflight(snapshot).errors).toContain(
      "项目还没有楼层，没有可导出的内容",
    )
  })

  it("warns about missing basemaps and baseline size", () => {
    const snapshot = makeSnapshot()
    snapshot.project = { ...snapshot.project, baseSize: null }
    snapshot.floors = snapshot.floors.map((floor) =>
      floor.id === "floor-2" ? { ...floor, basemap: null } : floor,
    )
    const warnings = runPreflight(snapshot).warnings
    expect(warnings).toContain("项目尚未上传底图，坐标没有画布尺寸基准")
    expect(warnings).toContain("楼层「2F」还没有底图")
  })

  it("warns when the project has no layers", () => {
    const snapshot = makeSnapshot({ layers: [] })
    expect(runPreflight(snapshot).warnings).toContain(
      "项目还没有图层，导出的压缩包只有底图",
    )
  })

  it("blocks on edges with dangling endpoints", () => {
    const snapshot = makeSnapshot()
    snapshot.routeNodes = snapshot.routeNodes.filter(
      (node) => node.id !== "node-a",
    )
    const errors = runPreflight(snapshot).errors
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/路线图层「路线」的边 edge-ab 的起点端点已不存在/)
  })

  it("reports every dangling edge, not just the first", () => {
    const snapshot = makeSnapshot()
    snapshot.routeNodes = []
    const errors = runPreflight(snapshot).errors
    expect(errors).toHaveLength(2)
  })
})
