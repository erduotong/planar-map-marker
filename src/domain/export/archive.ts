import JSZip from "jszip"
import type { ProjectSnapshot } from "@/db/project-repository"
import type { ExportFile } from "@/domain/export/geojson"
import {
  ARCHIVE_EXTENSION,
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
  type ArchiveProjectData,
  assetDataPath,
  type PackageManifest,
  serializeSnapshot,
  validateArchiveData,
} from "@/domain/export/snapshot-io"

/**
 * Archive packaging. Two flavours share the same GeoJSON layout:
 *
 *  - a plain data zip: one .geojson per floor/layer, no project configuration
 *  - a .mappkg: the above plus manifest.json, project.json and every basemap
 *    asset, so importing it reproduces the working environment exactly.
 *
 * The package format is versioned in the manifest; the parser refuses archives
 * from a newer format rather than silently mis-reading them.
 */

export class ArchiveImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ArchiveImportError"
  }
}

export async function buildGeojsonZip(
  files: readonly ExportFile[],
): Promise<Blob> {
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.path, JSON.stringify(file.collection))
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" })
}

export async function buildProjectPackage(
  snapshot: ProjectSnapshot,
  files: readonly ExportFile[],
): Promise<Blob> {
  const zip = new JSZip()
  zip.file("manifest.json", JSON.stringify(makeManifest(snapshot), null, 2))
  zip.file("project.json", JSON.stringify(serializeSnapshot(snapshot), null, 2))
  for (const file of files) {
    zip.file(file.path, JSON.stringify(file.collection))
  }
  for (const asset of snapshot.assets) {
    const bytes = await asset.blob.arrayBuffer()
    zip.file(assetDataPath(asset.id, asset.mime), bytes)
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" })
}

function makeManifest(snapshot: ProjectSnapshot): PackageManifest {
  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    app: "map-pointer",
    exportedAt: Date.now(),
    projectId: snapshot.project.id,
    projectName: snapshot.project.name,
  }
}

export interface ParsedPackage {
  manifest: PackageManifest
  data: ArchiveProjectData
  /** Zip path of each asset -> rehydrated Blob. */
  assetBlobs: Map<string, Blob>
}

export async function parseProjectPackage(
  input: Blob | ArrayBuffer,
): Promise<ParsedPackage> {
  const zip = await JSZip.loadAsync(input)

  const manifestFile = zip.file("manifest.json")
  if (!manifestFile) {
    throw new ArchiveImportError(
      "不是 map-pointer 项目包（缺少 manifest.json）；请上传导出的 .mappkg 文件",
    )
  }
  const manifest = parseManifest(safeJson(await manifestFile.async("string")))

  const dataFile = zip.file("project.json")
  if (!dataFile) {
    throw new ArchiveImportError("项目包缺少 project.json，数据不完整")
  }
  const rawData = safeJson(await dataFile.async("string"))
  const errors = validateArchiveData(rawData)
  if (errors.length > 0) {
    throw new ArchiveImportError(`项目包数据不合法：${errors.join("；")}`)
  }
  // validateArchiveData verified every entity and its references, so from here
  // the payload is trusted enough to treat as its typed shape.
  const data = rawData as ArchiveProjectData

  const assetBlobs = new Map<string, Blob>()
  for (const asset of data.assets) {
    const file = zip.file(asset.dataPath)
    if (!file) {
      throw new ArchiveImportError(`项目包缺少底图文件：${asset.dataPath}`)
    }
    const bytes = await file.async("arraybuffer")
    assetBlobs.set(asset.dataPath, new Blob([bytes], { type: asset.mime }))
  }

  return { manifest, data, assetBlobs }
}

function parseManifest(raw: unknown): PackageManifest {
  if (!isRecord(raw)) {
    throw new ArchiveImportError("manifest.json 无效")
  }
  if (raw.format !== ARCHIVE_FORMAT) {
    throw new ArchiveImportError("不是 map-pointer 项目包（格式不符）")
  }
  const version = raw.version
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new ArchiveImportError("项目包版本无效")
  }
  if (version > ARCHIVE_VERSION) {
    throw new ArchiveImportError(
      `项目包版本（v${version}）高于当前应用支持的版本（v${ARCHIVE_VERSION}），请升级应用后再导入`,
    )
  }
  return {
    format: ARCHIVE_FORMAT,
    version,
    app: typeof raw.app === "string" ? raw.app : "map-pointer",
    exportedAt:
      typeof raw.exportedAt === "number" ? raw.exportedAt : Date.now(),
    projectId: typeof raw.projectId === "string" ? raw.projectId : "",
    projectName:
      typeof raw.projectName === "string" ? raw.projectName : "未命名项目",
  }
}

function safeJson(source: string): unknown {
  try {
    return JSON.parse(source)
  } catch {
    throw new ArchiveImportError("项目包内包含无法解析的 JSON 文件")
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** The download extension used by the exporter UI. */
export function packageFileName(projectName: string): string {
  return `${projectName}.${ARCHIVE_EXTENSION}`
}
