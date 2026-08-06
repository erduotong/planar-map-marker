import type { ProjectSnapshot } from "@/db/project-repository"
import {
  type Asset,
  type Constraint,
  DEFAULT_LAYER_STYLE,
  type Feature,
  type Floor,
  type Layer,
  type Project,
  type RouteEdge,
  type RouteNode,
} from "@/domain/models"

/**
 * A complete project graph used by the exporter/archive tests: two floors, a
 * point/polygon/route layer on the first floor, a point layer on the second,
 * one asset and one cross-floor route edge (node -> second-floor feature).
 */
export function makeSnapshot(
  overrides?: Partial<ProjectSnapshot>,
): ProjectSnapshot {
  const project: Project = {
    id: "project-1",
    name: "示例项目",
    description: "",
    baseSize: { width: 1000, height: 800 },
    createdAt: 1,
    updatedAt: 2,
    lastExportedAt: null,
  }
  const constraint: Constraint = {
    id: "constraint-1",
    projectId: "project-1",
    name: "点位",
    description: "",
    fields: [
      {
        id: "field-name",
        key: "name",
        label: "名称",
        description: "",
        type: "string",
        required: true,
        options: [],
        min: null,
        max: null,
      },
    ],
    createdAt: 1,
    updatedAt: 1,
  }
  function pngAsset(id: string, fileName: string): Asset {
    return {
      id,
      projectId: "project-1",
      fileName,
      mime: "image/png",
      size: { width: 1000, height: 800 },
      byteLength: 8,
      blob: new Blob(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        { type: "image/png" },
      ),
      createdAt: 1,
    }
  }
  const asset = pngAsset("asset-1", "1F.png")
  const asset2 = pngAsset("asset-2", "2F.png")
  const floor1: Floor = {
    id: "floor-1",
    projectId: "project-1",
    name: "1F",
    order: 0,
    basemap: {
      assetId: "asset-1",
      fileName: "1F.png",
      mime: "image/png",
      size: { width: 1000, height: 800 },
    },
    createdAt: 1,
    updatedAt: 1,
  }
  const floor2: Floor = {
    id: "floor-2",
    projectId: "project-1",
    name: "2F",
    order: 1,
    basemap: {
      assetId: "asset-2",
      fileName: "2F.png",
      mime: "image/png",
      size: { width: 1000, height: 800 },
    },
    createdAt: 1,
    updatedAt: 1,
  }
  const layers: Layer[] = [
    {
      id: "layer-point",
      floorId: "floor-1",
      name: "点位",
      order: 0,
      visible: true,
      locked: false,
      opacity: 1,
      style: DEFAULT_LAYER_STYLE,
      kind: "point",
      constraintId: "constraint-1",
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: "layer-polygon",
      floorId: "floor-1",
      name: "房间",
      order: 1,
      visible: true,
      locked: false,
      opacity: 1,
      style: DEFAULT_LAYER_STYLE,
      kind: "polygon",
      constraintId: null,
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: "layer-route",
      floorId: "floor-1",
      name: "路线",
      order: 2,
      visible: true,
      locked: false,
      opacity: 1,
      style: DEFAULT_LAYER_STYLE,
      kind: "route",
      nodeConstraintId: null,
      edgeConstraintId: null,
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: "layer-lift",
      floorId: "floor-2",
      name: "电梯口",
      order: 0,
      visible: true,
      locked: false,
      opacity: 1,
      style: DEFAULT_LAYER_STYLE,
      kind: "point",
      constraintId: null,
      createdAt: 1,
      updatedAt: 1,
    },
  ]
  const features: Feature[] = [
    {
      id: "feature-poi",
      layerId: "layer-point",
      geometry: { type: "Point", coord: { x: 100, y: 120 } },
      properties: { name: "入口" },
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: "feature-room",
      layerId: "layer-polygon",
      geometry: {
        type: "Polygon",
        rings: [
          [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 80 },
            { x: 0, y: 80 },
            { x: 0, y: 0 },
          ],
        ],
      },
      properties: { name: "A101" },
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: "feature-lift",
      layerId: "layer-lift",
      geometry: { type: "Point", coord: { x: 500, y: 400 } },
      properties: {},
      createdAt: 1,
      updatedAt: 1,
    },
  ]
  const routeNodes: RouteNode[] = [
    {
      id: "node-a",
      layerId: "layer-route",
      coord: { x: 200, y: 300 },
      properties: {},
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: "node-b",
      layerId: "layer-route",
      coord: { x: 400, y: 300 },
      properties: {},
      createdAt: 1,
      updatedAt: 1,
    },
  ]
  const routeEdges: RouteEdge[] = [
    {
      id: "edge-ab",
      layerId: "layer-route",
      source: { kind: "node", nodeId: "node-a" },
      target: { kind: "node", nodeId: "node-b" },
      direction: "both",
      passable: true,
      length: 200,
      properties: {},
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: "edge-lift",
      layerId: "layer-route",
      source: { kind: "node", nodeId: "node-b" },
      target: {
        kind: "feature",
        floorId: "floor-2",
        layerId: "layer-lift",
        featureId: "feature-lift",
      },
      direction: "forward",
      passable: false,
      length: 141.4,
      properties: {},
      createdAt: 1,
      updatedAt: 1,
    },
  ]

  return {
    project,
    constraints: [constraint],
    floors: [floor1, floor2],
    layers,
    features,
    routeNodes,
    routeEdges,
    assets: [asset, asset2],
    ...overrides,
  }
}
