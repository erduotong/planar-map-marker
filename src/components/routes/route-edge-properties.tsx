import { Save, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ConstraintFieldInput } from "@/components/features/constraint-field-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { compileConstraint } from "@/domain/constraint-compiler"
import { type EndpointContext, endpointLabel } from "@/domain/graph"
import type { Constraint, EdgeDirection, RouteEdge } from "@/domain/models"

export function RouteEdgeProperties({
  edge,
  constraint,
  context,
  onSave,
  onDelete,
}: {
  edge: RouteEdge
  constraint: Constraint | null
  context: EndpointContext
  onSave: (edge: RouteEdge) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { t } = useTranslation()
  const DIRECTION_OPTIONS: { value: EdgeDirection; label: string }[] = [
    { value: "both", label: t("routes.directions.both") },
    { value: "forward", label: t("routes.directions.forward") },
    { value: "backward", label: t("routes.directions.backward") },
  ]
  const [properties, setProperties] = useState(edge.properties)
  const [direction, setDirection] = useState<EdgeDirection>(edge.direction)
  const [passable, setPassable] = useState(edge.passable)
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
    await onSave({
      ...edge,
      direction,
      passable,
      properties,
      updatedAt: Date.now(),
    })
  }

  return (
    <div className="border-t p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium">
          {t("routes.edgeProperties")}
        </span>
        <Button
          className="ml-auto"
          variant="ghost"
          size="icon-sm"
          aria-label={t("routes.deleteEdge")}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="mb-3 grid gap-1 text-xs text-muted-foreground">
        <p className="truncate">
          {t("routes.sourceLine", {
            value: endpointLabel(edge.source, context),
          })}
        </p>
        <p className="truncate">
          {t("routes.targetLine", {
            value: endpointLabel(edge.target, context),
          })}
        </p>
        <p className="font-mono">
          {t("routes.lengthLine", { value: Math.round(edge.length) })}
        </p>
      </div>
      <div className="grid gap-4">
        <Field>
          <FieldLabel>{t("routes.traversalDirection")}</FieldLabel>
          <Select
            value={direction}
            onValueChange={(value) => {
              if (
                value === "both" ||
                value === "forward" ||
                value === "backward"
              ) {
                setDirection(value)
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {DIRECTION_OPTIONS.find((item) => item.value === direction)
                  ?.label ?? direction}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DIRECTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            aria-label={t("routes.passable")}
            checked={passable}
            onCheckedChange={(checked) => setPassable(checked === true)}
          />
          <span>{t("routes.passable")}</span>
        </div>
        {constraint ? (
          fields.map((field) => (
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
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("routes.noEdgeConstraintBound")}
          </p>
        )}
        <Button onClick={save}>
          <Save /> {t("routes.saveEdge")}
        </Button>
      </div>
    </div>
  )
}
