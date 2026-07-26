import { describe, expect, it } from "vitest"
import {
  constraintFieldKeySchema,
  endpointRefSchema,
  layerSchema,
  projectSchema,
  routeEdgeSchema,
} from "@/domain/models"

describe("domain model schemas", () => {
  it("rejects user field keys reserved by the exporter", () => {
    expect(constraintFieldKeySchema.safeParse("name").success).toBe(true)
    expect(constraintFieldKeySchema.safeParse("room id").success).toBe(false)
    expect(constraintFieldKeySchema.safeParse("_kind").success).toBe(false)
  })

  it("validates route endpoint references", () => {
    expect(
      endpointRefSchema.safeParse({ kind: "node", nodeId: "n1" }).success,
    ).toBe(true)
    expect(
      endpointRefSchema.safeParse({
        kind: "feature",
        floorId: "f2",
        layerId: "points",
        featureId: "stairs",
      }).success,
    ).toBe(true)
    expect(
      endpointRefSchema.safeParse({ kind: "node", featureId: "oops" }).success,
    ).toBe(false)
  })

  it("discriminates route layers from geometry layers", () => {
    const base = {
      id: "layer",
      floorId: "floor",
      name: "路线",
      order: 0,
      visible: true,
      locked: false,
      opacity: 1,
      style: {
        color: "#000000",
        fillColor: "#ffffff",
        fillOpacity: 0.2,
        weight: 2,
        radius: 6,
      },
      createdAt: 1,
      updatedAt: 1,
    }

    expect(
      layerSchema.safeParse({
        ...base,
        kind: "route",
        nodeConstraintId: null,
        edgeConstraintId: null,
      }).success,
    ).toBe(true)
    expect(
      layerSchema.safeParse({
        ...base,
        kind: "route",
        constraintId: null,
      }).success,
    ).toBe(false)
  })

  it("requires nonnegative derived edge length", () => {
    const edge = {
      id: "edge",
      layerId: "routes",
      source: { kind: "node", nodeId: "a" },
      target: { kind: "node", nodeId: "b" },
      direction: "both",
      passable: true,
      length: -1,
      properties: {},
      createdAt: 1,
      updatedAt: 1,
    }
    expect(routeEdgeSchema.safeParse(edge).success).toBe(false)
  })

  it("validates project baseline sizes", () => {
    const project = {
      id: "project",
      name: "测试",
      description: "",
      baseSize: { width: 1920, height: 1080 },
      createdAt: 1,
      updatedAt: 1,
      lastExportedAt: null,
    }
    expect(projectSchema.safeParse(project).success).toBe(true)
    expect(
      projectSchema.safeParse({
        ...project,
        baseSize: { width: 0, height: 1080 },
      }).success,
    ).toBe(false)
  })
})
