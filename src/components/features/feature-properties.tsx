import { Save, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { compileConstraint } from "@/domain/constraint-compiler"
import type { Constraint, Feature } from "@/domain/models"

export function FeatureProperties({
  feature,
  constraint,
  onSave,
  onDelete,
}: {
  feature: Feature
  constraint: Constraint | null
  onSave: (feature: Feature) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [properties, setProperties] = useState(feature.properties)
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
    await onSave({ ...feature, properties, updatedAt: Date.now() })
  }

  return (
    <div className="border-t p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium">标注属性</span>
        <Button
          className="ml-auto"
          variant="ghost"
          size="icon-sm"
          aria-label="删除标注"
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
      {constraint ? (
        <div className="grid gap-4">
          {fields.map((field) => (
            <Field key={field.id} data-invalid={Boolean(errors[field.key])}>
              <FieldLabel>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </FieldLabel>
              <FeatureInput
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
            <Save /> 保存属性
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          该图层尚未绑定数据约束。
        </p>
      )}
    </div>
  )
}

function FeatureInput({
  field,
  value,
  onChange,
}: {
  field: Constraint["fields"][number]
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Checkbox
          aria-label={field.label}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        {value === true ? "是" : "否"}
      </div>
    )
  }
  if (field.type === "enum") {
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={onChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  if (field.type === "text") {
    return (
      <Textarea
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }
  return (
    <Input
      type={
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : field.type === "color"
              ? "color"
              : "text"
      }
      value={
        typeof value === "string" || typeof value === "number" ? value : ""
      }
      onChange={(event) =>
        onChange(
          field.type === "number"
            ? event.target.value === ""
              ? undefined
              : Number(event.target.value)
            : event.target.value,
        )
      }
    />
  )
}
