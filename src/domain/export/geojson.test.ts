import { describe, expect, it } from "vitest"
import { makeSnapshot } from "@/domain/export/fixtures"
import { buildExportFiles, type ExportFile } from "@/domain/export/geojson"

function fileAt(files: ExportFile[], path: string): ExportFile {
  const file = files.find((item) => item.path === path)
  if (!file) throw new Error(`fixture missing file: ${path}`)
  return file
}

describe("buildExportFiles", () => {
  it("produces one file per floor/layer with a sanitized path", () => {
    const files = buildExportFiles(makeSnapshot())
    expect(files.map((file) => file.path)).toEqual([
      "1F/点位.geojson",
      "1F/房间.geojson",
      "1F/路线.geojson",
      "2F/电梯口.geojson",
    ])
  })

  it("disambiguates colliding layer names", () => {
    const snapshot = makeSnapshot()
    const first = snapshot.layers[0]
    if (!first) throw new Error("fixture missing")
    const duplicate = structuredClone(first)
    snapshot.layers = [
      first,
      { ...duplicate, id: "layer-point-2", name: "点位" },
      ...snapshot.layers.slice(1),
    ]
    const files = buildExportFiles(snapshot)
    expect(files[0]?.path).toBe("1F/点位.geojson")
    expect(files[1]?.path).toBe("1F/点位-2.geojson")
  })

  it("declares the pixel coordinate system on every collection", () => {
    const [file] = buildExportFiles(makeSnapshot())
    expect(file?.collection.crs).toEqual({
      type: "name",
      properties: { name: "urn:ogc:def:crs:planar-map-marker:pixel" },
    })
  })
})

describe("point layers", () => {
  it("exports points with injected metadata and user properties", () => {
    const [file] = buildExportFiles(makeSnapshot())
    const feature = file?.collection.features[0]
    expect(feature?.geometry).toEqual({
      type: "Point",
      coordinates: [100, 120],
    })
    expect(feature?.properties).toMatchObject({
      _id: "feature-poi",
      _floorName: "1F",
      _layerName: "点位",
      _layerKind: "point",
      name: "入口",
    })
  })

  it("keeps user property keys that happen to be non-reserved", () => {
    const snapshot = makeSnapshot()
    snapshot.features = snapshot.features.map((feature) =>
      feature.id === "feature-poi"
        ? { ...feature, properties: { name: "入口", 编号: 7 } }
        : feature,
    )
    const [file] = buildExportFiles(snapshot)
    expect(file?.collection.features[0]?.properties).toMatchObject({
      name: "入口",
      编号: 7,
    })
  })
})

describe("polygon layers", () => {
  it("exports closed rings in [x, y] order", () => {
    const file = fileAt(buildExportFiles(makeSnapshot()), "1F/房间.geojson")
    const polygon = file.collection.features.find(
      (feature) => feature.properties._id === "feature-room",
    )
    expect(polygon?.geometry).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [100, 0],
          [100, 80],
          [0, 80],
          [0, 0],
        ],
      ],
    })
  })

  it("closes an unclosed ring automatically", () => {
    const snapshot = makeSnapshot()
    snapshot.features = snapshot.features.map((feature) =>
      feature.id === "feature-room"
        ? {
            ...feature,
            geometry: {
              type: "Polygon" as const,
              rings: [
                [
                  { x: 0, y: 0 },
                  { x: 10, y: 0 },
                  { x: 10, y: 10 },
                ],
              ],
            },
          }
        : feature,
    )
    const file = fileAt(buildExportFiles(snapshot), "1F/房间.geojson")
    const polygon = file.collection.features.find(
      (feature) => feature.properties._id === "feature-room",
    )
    const first =
      polygon?.geometry.type === "Polygon"
        ? polygon.geometry.coordinates[0]?.[0]
        : undefined
    const last =
      polygon?.geometry.type === "Polygon"
        ? polygon.geometry.coordinates[0]?.at(-1)
        : undefined
    expect(first).toEqual(last)
  })
})

describe("route layers", () => {
  it("exports nodes as points and edges as linestrings", () => {
    const file = fileAt(buildExportFiles(makeSnapshot()), "1F/路线.geojson")
    const nodes = file.collection.features.filter(
      (feature) => feature.properties._kind === "node",
    )
    const edges = file.collection.features.filter(
      (feature) => feature.properties._kind === "edge",
    )
    expect(nodes).toHaveLength(2)
    expect(edges).toHaveLength(2)
    expect(nodes?.[0]?.geometry).toEqual({
      type: "Point",
      coordinates: [200, 300],
    })
    expect(nodes?.[0]?.properties).toMatchObject({
      _nodeId: "node-a",
      _layerName: "路线",
    })
  })

  it("resolves a cross-floor edge to the shared pixel coordinates", () => {
    const file = fileAt(buildExportFiles(makeSnapshot()), "1F/路线.geojson")
    const lift = file.collection.features.find(
      (feature) => feature.properties._edgeId === "edge-lift",
    )
    expect(lift?.geometry).toEqual({
      type: "LineString",
      coordinates: [
        [400, 300],
        [500, 400],
      ],
    })
    expect(lift?.properties).toMatchObject({
      _direction: "forward",
      _passable: false,
      _length: 141.4,
      _source: { kind: "node", nodeId: "node-b" },
      _target: {
        kind: "feature",
        floorId: "floor-2",
        layerId: "layer-lift",
        featureId: "feature-lift",
      },
    })
  })

  it("carries user properties on edges", () => {
    const snapshot = makeSnapshot()
    snapshot.routeEdges = snapshot.routeEdges.map((edge) =>
      edge.id === "edge-ab" ? { ...edge, properties: { 名称: "走廊" } } : edge,
    )
    const file = fileAt(buildExportFiles(snapshot), "1F/路线.geojson")
    const edge = file.collection.features.find(
      (feature) => feature.properties._edgeId === "edge-ab",
    )
    expect(edge?.properties).toMatchObject({ 名称: "走廊" })
  })
})
