import { z } from "zod"
import type { Constraint, ConstraintField } from "@/domain/models"
import i18n from "@/i18n"

export class DuplicateConstraintKeyError extends Error {
  constructor(readonly key: string) {
    super(i18n.t("errors.constraints.duplicateKey", { key }))
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
      let number = z.number({
        error: i18n.t("errors.constraints.mustBeNumber", {
          label: field.label,
        }),
      })
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
        message: i18n.t("errors.constraints.invalidEnum", {
          label: field.label,
        }),
      })
      break
    case "date":
      schema = z.string().regex(
        /^\d{4}-\d{2}-\d{2}$/,
        i18n.t("errors.constraints.invalidFormat", {
          label: field.label,
        }),
      )
      break
    case "color":
      schema = z.string().regex(
        /^#[0-9a-f]{6}$/i,
        i18n.t("errors.constraints.invalidColor", {
          label: field.label,
        }),
      )
      break
  }

  if (field.required) {
    return schema.refine(
      (value) => !(typeof value === "string" && value.trim() === ""),
      {
        message: i18n.t("errors.constraints.required", {
          label: field.label,
        }),
      },
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
