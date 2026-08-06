import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Constraint } from "@/domain/models"

export function ConstraintFieldInput({
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
