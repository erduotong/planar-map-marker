import { describe, expect, it } from "vitest"
import {
  assertValidRouteEdge,
  buildEndpointContext,
  endpointLabel,
  pixelDistance,
  RouteEdgeValidationError,
  resolveEndpoint,
  sameEndpoint,
} from "@/domain/graph"
import type { Feature, RouteNode } from "@/domain/models"

const node: RouteNode = {
  id: "n1",
  layerId: "route-layer",
  coord: { x: 100, y: 200 },
  properties: {},
  createdAt: 1,
  updatedAt: 1,
}

const feature: Feature = {
  id: "f1",
  layerId: "point-layer",
  geometry: { type: "Point", coord: { x: 300, y: 400 } },
  properties: {},
  createdAt: 1,
  updatedAt: 1,
}

describe("graph endpoint resolution", () => {
  it("resolves node and feature endpoints to pixel coordinates", () => {
    const context = buildEndpointContext([node], [feature])
    expect(resolveEndpoint({ kind: "node", nodeId: "n1" }, context)).toEqual({
      x: 100,
      y: 200,
    })
    expect(
      resolveEndpoint(
        { kind: "feature", floorId: "f", layerId: "p", featureId: "f1" },
        context,
      ),
    ).toEqual({ x: 300, y: 400 })
  })

  it("returns null for missing endpoints and non-point features", () => {
    const context = buildEndpointContext([node], [feature])
    expect(resolveEndpoint({ kind: "node", nodeId: "missing" }, context)).toBe(
      null,
    )
    expect(
      resolveEndpoint(
        { kind: "feature", floorId: "f", layerId: "p", featureId: "missing" },
        context,
      ),
    ).toBe(null)
    const polygon: Feature = {
      ...feature,
      geometry: {
        type: "Polygon",
        rings: [
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
          ],
        ],
      },
    }
    const filtered = buildEndpointContext([], [polygon])
    expect(filtered.features.size).toBe(0)
  })

  it("measures pixel distance", () => {
    expect(pixelDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    expect(pixelDistance({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0)
  })

  it("detects equivalent endpoints", () => {
    expect(
      sameEndpoint(
        { kind: "node", nodeId: "a" },
        { kind: "node", nodeId: "a" },
      ),
    ).toBe(true)
    expect(
      sameEndpoint(
        { kind: "node", nodeId: "a" },
        { kind: "node", nodeId: "b" },
      ),
    ).toBe(false)
    expect(
      sameEndpoint(
        { kind: "node", nodeId: "a" },
        { kind: "feature", floorId: "f", layerId: "l", featureId: "a" },
      ),
    ).toBe(false)
  })

  it("labels endpoints with a short id", () => {
    const context = buildEndpointContext([node], [feature])
    expect(endpointLabel({ kind: "node", nodeId: "n1" }, context)).toBe(
      "节点 n1",
    )
    expect(
      endpointLabel(
        { kind: "feature", floorId: "f", layerId: "p", featureId: "f1" },
        context,
      ),
    ).toBe("要素 f1")
  })
})

describe("edge validation", () => {
  it("rejects self-loops", () => {
    const context = buildEndpointContext([node], [feature])
    expect(() =>
      assertValidRouteEdge(
        { kind: "node", nodeId: "n1" },
        { kind: "node", nodeId: "n1" },
        context,
      ),
    ).toThrow(RouteEdgeValidationError)
  })

  it("rejects edges pointing at missing endpoints", () => {
    const context = buildEndpointContext([node], [])
    expect(() =>
      assertValidRouteEdge(
        { kind: "node", nodeId: "n1" },
        { kind: "feature", floorId: "f", layerId: "p", featureId: "f1" },
        context,
      ),
    ).toThrow(RouteEdgeValidationError)
  })

  it("accepts a valid node-to-feature edge", () => {
    const context = buildEndpointContext([node], [feature])
    expect(() =>
      assertValidRouteEdge(
        { kind: "node", nodeId: "n1" },
        { kind: "feature", floorId: "f", layerId: "p", featureId: "f1" },
        context,
      ),
    ).not.toThrow()
  })
})
