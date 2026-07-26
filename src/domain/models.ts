import { z } from "zod"

/**
 * Every persisted entity in the app, expressed as Zod schemas with the
 * TypeScript types derived from them. Runtime validation happens at the edges
 * (import, and anything read back from a file); inside the app the derived
 * types carry the contract.
 *
 * Coordinates are ALWAYS image pixels: origin top-left, x right, y down. The
 * conversion to Leaflet's LatLng lives in the map layer, never here.
 */

export const idSchema = z.string().min(1)

/** Epoch milliseconds. Stored as a number so it survives JSON round-trips. */
export const timestampSchema = z.number().int().nonnegative()

export const pixelSchema = z.object({
  x: z.number(),
  y: z.number(),
})
export type Pixel = z.infer<typeof pixelSchema>

export const sizeSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})
export type Size = z.infer<typeof sizeSchema>

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export const projectSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(2000),
  /**
   * Baseline canvas size for the whole project, claimed by the first basemap
   * uploaded. Every later basemap must match it exactly. Null until the first
   * upload.
   */
  baseSize: sizeSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  /** Surfaced in the project list to nudge people to back up their work. */
  lastExportedAt: timestampSchema.nullable(),
})
export type Project = z.infer<typeof projectSchema>

// ---------------------------------------------------------------------------
// Constraints (the UI calls these "数据约束")
// ---------------------------------------------------------------------------

export const constraintFieldTypeSchema = z.enum([
  "string",
  "text",
  "number",
  "boolean",
  "enum",
  "date",
  "color",
])
export type ConstraintFieldType = z.infer<typeof constraintFieldTypeSchema>

/**
 * Property keys are emitted verbatim into exported GeoJSON, where the exporter
 * also injects its own `_`-prefixed keys. Reserving that prefix keeps the two
 * namespaces from ever colliding.
 */
export const RESERVED_KEY_PREFIX = "_"

export const constraintFieldKeySchema = z
  .string()
  .min(1)
  .max(64)
  .refine((key) => !key.startsWith(RESERVED_KEY_PREFIX), {
    message: `字段 key 不能以 "${RESERVED_KEY_PREFIX}" 开头，该前缀由导出器保留`,
  })
  .refine((key) => !/\s/.test(key), {
    message: "字段 key 不能包含空白字符",
  })

export const constraintFieldSchema = z.object({
  id: idSchema,
  key: constraintFieldKeySchema,
  label: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  type: constraintFieldTypeSchema,
  required: z.boolean(),
  /** Only meaningful for type "enum". */
  options: z.array(z.string().min(1)).default([]),
  /** Only meaningful for type "number". */
  min: z.number().nullable().default(null),
  max: z.number().nullable().default(null),
  defaultValue: z.unknown().optional(),
})
export type ConstraintField = z.infer<typeof constraintFieldSchema>

export const constraintSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  fields: z.array(constraintFieldSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
export type Constraint = z.infer<typeof constraintSchema>

// ---------------------------------------------------------------------------
// Assets and floors
// ---------------------------------------------------------------------------

export const assetMimeSchema = z.enum([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
])
export type AssetMime = z.infer<typeof assetMimeSchema>

/**
 * The image bytes live in IndexedDB as a Blob. Note this schema is only usable
 * in a browser-ish runtime; the archive importer rebuilds the Blob before
 * validating.
 */
export const assetSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  fileName: z.string().min(1),
  mime: assetMimeSchema,
  size: sizeSchema,
  byteLength: z.number().int().nonnegative(),
  blob: z.instanceof(Blob),
  createdAt: timestampSchema,
})
export type Asset = z.infer<typeof assetSchema>

export const basemapSchema = z.object({
  assetId: idSchema,
  fileName: z.string().min(1),
  mime: assetMimeSchema,
  size: sizeSchema,
})
export type Basemap = z.infer<typeof basemapSchema>

export const floorSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  name: z.string().min(1).max(100),
  /** Ascending display order within the project. */
  order: z.number().int(),
  basemap: basemapSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
export type Floor = z.infer<typeof floorSchema>

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

export const layerKindSchema = z.enum(["point", "polygon", "route"])
export type LayerKind = z.infer<typeof layerKindSchema>

export const layerStyleSchema = z.object({
  /** Stroke / marker colour as a #rrggbb string. */
  color: z.string(),
  fillColor: z.string(),
  fillOpacity: z.number().min(0).max(1),
  weight: z.number().min(0),
  /** Marker radius in screen pixels. */
  radius: z.number().positive(),
})
export type LayerStyle = z.infer<typeof layerStyleSchema>

export const DEFAULT_LAYER_STYLE: LayerStyle = {
  color: "#2563eb",
  fillColor: "#3b82f6",
  fillOpacity: 0.25,
  weight: 2,
  radius: 6,
}

const layerBaseShape = {
  id: idSchema,
  floorId: idSchema,
  name: z.string().min(1).max(100),
  order: z.number().int(),
  visible: z.boolean(),
  locked: z.boolean(),
  opacity: z.number().min(0).max(1),
  style: layerStyleSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}

export const pointLayerSchema = z.object({
  ...layerBaseShape,
  kind: z.literal("point"),
  constraintId: idSchema.nullable(),
})

export const polygonLayerSchema = z.object({
  ...layerBaseShape,
  kind: z.literal("polygon"),
  constraintId: idSchema.nullable(),
})

export const routeLayerSchema = z.object({
  ...layerBaseShape,
  kind: z.literal("route"),
  /** Route layers constrain nodes and edges separately. */
  nodeConstraintId: idSchema.nullable(),
  edgeConstraintId: idSchema.nullable(),
})

export const layerSchema = z.discriminatedUnion("kind", [
  pointLayerSchema,
  polygonLayerSchema,
  routeLayerSchema,
])
export type Layer = z.infer<typeof layerSchema>
export type PointLayer = z.infer<typeof pointLayerSchema>
export type PolygonLayer = z.infer<typeof polygonLayerSchema>
export type RouteLayer = z.infer<typeof routeLayerSchema>

// ---------------------------------------------------------------------------
// Features (point / polygon layers)
// ---------------------------------------------------------------------------

export const propertiesSchema = z.record(z.string(), z.unknown())
export type Properties = z.infer<typeof propertiesSchema>

export const pointGeometrySchema = z.object({
  type: z.literal("Point"),
  coord: pixelSchema,
})

export const polygonGeometrySchema = z.object({
  type: z.literal("Polygon"),
  /** First ring is the outer boundary; any further rings are holes. */
  rings: z.array(z.array(pixelSchema).min(3)).min(1),
})

export const geometrySchema = z.discriminatedUnion("type", [
  pointGeometrySchema,
  polygonGeometrySchema,
])
export type Geometry = z.infer<typeof geometrySchema>

export const featureSchema = z.object({
  id: idSchema,
  layerId: idSchema,
  geometry: geometrySchema,
  properties: propertiesSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
export type Feature = z.infer<typeof featureSchema>

// ---------------------------------------------------------------------------
// Route graph
// ---------------------------------------------------------------------------

export const routeNodeSchema = z.object({
  id: idSchema,
  layerId: idSchema,
  coord: pixelSchema,
  properties: propertiesSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
export type RouteNode = z.infer<typeof routeNodeSchema>

/**
 * An edge endpoint is either a node owned by the same route layer, or a point
 * feature anywhere in the project — including another floor, which is how
 * stairs and lifts get expressed.
 */
export const endpointRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("node"), nodeId: idSchema }),
  z.object({
    kind: z.literal("feature"),
    floorId: idSchema,
    layerId: idSchema,
    featureId: idSchema,
  }),
])
export type EndpointRef = z.infer<typeof endpointRefSchema>

export const edgeDirectionSchema = z.enum(["both", "forward", "backward"])
export type EdgeDirection = z.infer<typeof edgeDirectionSchema>

export const routeEdgeSchema = z.object({
  id: idSchema,
  /** The layer that owns the edge; a cross-floor edge is exported only here. */
  layerId: idSchema,
  source: endpointRefSchema,
  target: endpointRefSchema,
  direction: edgeDirectionSchema,
  passable: z.boolean(),
  /** Derived pixel length, recomputed whenever an endpoint moves. */
  length: z.number().nonnegative(),
  properties: propertiesSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
export type RouteEdge = z.infer<typeof routeEdgeSchema>
