import type { Size } from "@/domain/models"

const SUPPORTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
])

export const BASEMAP_ACCEPT = [...SUPPORTED_TYPES].join(",")

export class UnsupportedImageError extends Error {
  constructor(readonly mime: string) {
    super(`不支持的底图格式：${mime || "未知格式"}`)
    this.name = "UnsupportedImageError"
  }
}

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidImageError"
  }
}

export async function inspectImage(file: File): Promise<Size> {
  if (!SUPPORTED_TYPES.has(file.type))
    throw new UnsupportedImageError(file.type)
  return file.type === "image/svg+xml"
    ? inspectSvg(await file.text())
    : inspectBitmap(file)
}

export function inspectSvg(source: string): Size {
  const document = new DOMParser().parseFromString(source, "image/svg+xml")
  if (document.querySelector("parsererror")) {
    throw new InvalidImageError("SVG 文件无法解析")
  }
  const svg = document.documentElement
  if (svg.localName !== "svg") {
    throw new InvalidImageError("文件根节点不是 SVG")
  }

  const width = parseSvgLength(svg.getAttribute("width"))
  const height = parseSvgLength(svg.getAttribute("height"))
  if (width && height) return integerSize(width, height)

  const viewBox = svg.getAttribute("viewBox")
  if (viewBox) {
    const numbers = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number)
    const viewWidth = numbers[2]
    const viewHeight = numbers[3]
    if (
      numbers.length === 4 &&
      viewWidth !== undefined &&
      viewHeight !== undefined &&
      Number.isFinite(viewWidth) &&
      Number.isFinite(viewHeight) &&
      viewWidth > 0 &&
      viewHeight > 0
    ) {
      return integerSize(viewWidth, viewHeight)
    }
  }

  throw new InvalidImageError(
    "SVG 必须同时提供 width/height，或提供有效的 viewBox",
  )
}

function parseSvgLength(value: string | null): number | null {
  if (!value) return null
  // Absolute CSS units have a deterministic 96dpi conversion. Percentages and
  // relative units don't have an intrinsic pixel size, so fall back to viewBox.
  const match = value
    .trim()
    .match(/^([+]?(?:\d+\.?\d*|\.\d+))(px|in|cm|mm|pt|pc)?$/i)
  if (!match) return null
  const numeric = Number(match[1])
  if (!(numeric > 0)) return null
  const unit = match[2]?.toLowerCase() ?? "px"
  const pixelsPerUnit: Record<string, number> = {
    px: 1,
    in: 96,
    cm: 96 / 2.54,
    mm: 96 / 25.4,
    pt: 96 / 72,
    pc: 16,
  }
  return numeric * (pixelsPerUnit[unit] ?? 1)
}

async function inspectBitmap(file: File): Promise<Size> {
  try {
    const bitmap = await createImageBitmap(file)
    try {
      return integerSize(bitmap.width, bitmap.height)
    } finally {
      bitmap.close()
    }
  } catch {
    throw new InvalidImageError("无法读取图片尺寸，文件可能已损坏")
  }
}

function integerSize(width: number, height: number): Size {
  const normalized = { width: Math.round(width), height: Math.round(height) }
  if (normalized.width <= 0 || normalized.height <= 0) {
    throw new InvalidImageError("图片尺寸必须大于 0")
  }
  return normalized
}

export function assertBasemapMatches(
  expected: Size | null,
  actual: Size,
): void {
  if (
    expected &&
    (expected.width !== actual.width || expected.height !== actual.height)
  ) {
    throw new BasemapSizeMismatchError(expected, actual)
  }
}

export class BasemapSizeMismatchError extends Error {
  constructor(
    readonly expected: Size,
    readonly actual: Size,
  ) {
    super(
      `底图尺寸不一致：期望 ${expected.width} × ${expected.height}，实际 ${actual.width} × ${actual.height}`,
    )
    this.name = "BasemapSizeMismatchError"
  }
}
