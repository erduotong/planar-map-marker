import { z } from "zod"
import type { Constraint, ConstraintField } from "@/domain/models"

export class DuplicateConstraintKeyError extends Error {
  constructor(readonly key: string) {
    super(`字段 key 重复：${key}`)
    this.name = "DuplicateConstraintKeyError"
  }
}

export function compileConstraint(
  constraint: Pick<Constraint, "fields">,
): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {}
  for (const field of constraint.fields) {
    if (shape[field.key]) throw new DuplicateConstraintKeyError(field.key)
    shape[field.key] = compileField(field)
  }
  return z.object(shape)
}

function compileField(field: ConstraintField): z.ZodType {
  let schema: z.ZodType
  switch (field.type) {
    case "string":
    case "text":
      schema = z.string()
      break
    case "number": {
      let number = z.number({ error: `${field.label}必须是数字` })
      if (field.min !== null) number = number.min(field.min)
      if (field.max !== null) number = number.max(field.max)
      schema = number
      break
    }
    case "boolean":
      schema = z.boolean()
      break
    case "enum":
      schema = z.string().refine((value) => field.options.includes(value), {
        message: `请选择有效的${field.label}`,
      })
      break
    case "date":
      schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${field.label}格式无效`)
      break
    case "color":
      schema = z.string().regex(/^#[0-9a-f]{6}$/i, `${field.label}必须是颜色值`)
      break
  }

  if (field.required) {
    return schema.refine(
      (value) => !(typeof value === "string" && value.trim() === ""),
      { message: `${field.label}为必填项` },
    )
  }
  return schema.optional().or(z.literal(""))
}

export function initialProperties(
  constraint: Constraint | null,
): Record<string, unknown> {
  if (!constraint) return {}
  return Object.fromEntries(
    constraint.fields.map((field) => [
      field.key,
      field.defaultValue ?? defaultFor(field),
    ]),
  )
}

function defaultFor(field: ConstraintField): unknown {
  if (field.type === "boolean") return false
  if (field.type === "number") return undefined
  return ""
}
