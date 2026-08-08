import { Save, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ConstraintFieldInput } from "@/components/features/constraint-field-input"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { compileConstraint } from "@/domain/constraint-compiler"
import type { Constraint, RouteNode } from "@/domain/models"

export function RouteNodeProperties({
  node,
  constraint,
  onSave,
  onDelete,
}: {
  node: RouteNode
  constraint: Constraint | null
  onSave: (node: RouteNode) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [properties, setProperties] = useState(node.properties)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fields = constraint?.fields ?? []
  const schema = useMemo(
    () => (constraint ? compileConstraint(constraint) : null),
    [constraint],
  )

  async function save() {
    if (schema) {
      const result = schema.safeParse(properties)
      if (!result.success) {
        setErrors(
          Object.fromEntries(
            result.error.issues.map((issue) => [
              String(issue.path[0] ?? ""),
              issue.message,
            ]),
          ),
        )
        return
      }
    }
    setErrors({})
    await onSave({ ...node, properties, updatedAt: Date.now() })
  }

  return (
    <div className="border-t p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium">
          {t("routes.nodeProperties")}
        </span>
        <Button
          className="ml-auto"
          variant="ghost"
          size="icon-sm"
          aria-label={t("routes.deleteNode")}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-xs text-muted-foreground">
        <span>x {Math.round(node.coord.x)}</span>
        <span>y {Math.round(node.coord.y)}</span>
      </div>
      {constraint ? (
        <div className="grid gap-4">
          {fields.map((field) => (
            <Field key={field.id} data-invalid={Boolean(errors[field.key])}>
              <FieldLabel>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </FieldLabel>
              <ConstraintFieldInput
                field={field}
                value={properties[field.key]}
                onChange={(value) =>
                  setProperties((current) => ({
                    ...current,
                    [field.key]: value,
                  }))
                }
              />
              {errors[field.key] && (
                <FieldError>{errors[field.key]}</FieldError>
              )}
            </Field>
          ))}
          <Button onClick={save}>
            <Save /> {t("routes.saveNode")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("routes.noNodeConstraintBound")}
        </p>
      )}
    </div>
  )
}
