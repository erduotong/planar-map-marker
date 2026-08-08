import type { Size } from "@/domain/models"
import i18n from "@/i18n"

const SUPPORTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
])

export const BASEMAP_ACCEPT = [...SUPPORTED_TYPES].join(",")

export class UnsupportedImageError extends Error {
  constructor(readonly mime: string) {
    super(
      i18n.t("errors.basemap.unsupportedFormat", {
        mime: mime || i18n.t("errors.basemap.unknownFormat"),
      }),
    )
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
    throw new InvalidImageError(i18n.t("errors.basemap.svgParse"))
  }
  const svg = document.documentElement
  if (svg.localName !== "svg") {
    throw new InvalidImageError(i18n.t("errors.basemap.svgRoot"))
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

  throw new InvalidImageError(i18n.t("errors.basemap.svgDimensions"))
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
    throw new InvalidImageError(i18n.t("errors.basemap.readSize"))
  }
}

function integerSize(width: number, height: number): Size {
  const normalized = { width: Math.round(width), height: Math.round(height) }
  if (normalized.width <= 0 || normalized.height <= 0) {
    throw new InvalidImageError(i18n.t("errors.basemap.positiveSize"))
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
      i18n.t("errors.basemap.sizeMismatch", {
        expectedWidth: expected.width,
        expectedHeight: expected.height,
        actualWidth: actual.width,
        actualHeight: actual.height,
      }),
    )
    this.name = "BasemapSizeMismatchError"
  }
}
