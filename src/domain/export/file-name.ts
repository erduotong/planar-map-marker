/**
 * Path building for exported archives. Floor and layer names are user text, so
 * every path component is scrubbed before it lands in a zip; collisions get a
 * numeric suffix instead of silently overwriting each other.
 */
import i18n from "@/i18n"

/** Characters that would corrupt a zip path on any common platform. */
const FORBIDDEN = new Set(["\\", "/", ":", "*", "?", '"', "<", ">", "|"])

/** Scrubs a component so it is safe inside a zip path (no separators, dots or
 * control characters). Falls back to `fallback` when nothing survives. */
export function sanitizeFileName(
  name: string,
  fallback = i18n.t("export.unnamed"),
): string {
  const cleaned = [...name]
    .map((ch) => (ch.charCodeAt(0) < 0x20 || FORBIDDEN.has(ch) ? " " : ch))
    .join("")
    .replace(/ {2,}/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80)
  return cleaned || fallback
}

/** Appends a numeric suffix when `base` is already taken. */
export function uniquePath(
  existing: ReadonlySet<string>,
  base: string,
): string {
  if (!existing.has(base)) return base
  const dot = base.lastIndexOf(".")
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ""
  for (let index = 2; ; index += 1) {
    const candidate = `${stem}-${index}${ext}`
    if (!existing.has(candidate)) return candidate
  }
}
