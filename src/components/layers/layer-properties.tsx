import { Paintbrush, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import type { Constraint, Layer } from "@/domain/models"

export function LayerProperties({
  layer,
  constraints,
  onChange,
  onDelete,
}: {
  layer: Layer
  constraints: Constraint[]
  onChange: (layer: Layer) => void
  onDelete: () => void
}) {
  const constraintId =
    layer.kind === "route" ? layer.nodeConstraintId : layer.constraintId

  return (
    <div className="border-t p-3">
      <div className="mb-3 flex items-center gap-2">
        <Paintbrush className="size-4" />
        <span className="text-sm font-medium">图层设置</span>
        <Button
          className="ml-auto"
          variant="ghost"
          size="icon-sm"
          aria-label="删除图层"
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="grid gap-4">
        <Field>
          <FieldLabel>名称</FieldLabel>
          <Input
            value={layer.name}
            onChange={(event) =>
              onChange({ ...layer, name: event.target.value })
            }
          />
        </Field>
        <Field>
          <FieldLabel>数据约束</FieldLabel>
          <Select
            value={constraintId ?? "none"}
            onValueChange={(value) => {
              const id = value === "none" ? null : String(value)
              onChange(
                layer.kind === "route"
                  ? { ...layer, nodeConstraintId: id }
                  : { ...layer, constraintId: id },
              )
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">无约束</SelectItem>
              {constraints.map((constraint) => (
                <SelectItem key={constraint.id} value={constraint.id}>
                  {constraint.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>线条</FieldLabel>
            <Input
              type="color"
              value={layer.style.color}
              className="h-8 p-1"
              onChange={(event) =>
                onChange({
                  ...layer,
                  style: { ...layer.style, color: event.target.value },
                })
              }
            />
          </Field>
          <Field>
            <FieldLabel>填充</FieldLabel>
            <Input
              type="color"
              value={layer.style.fillColor}
              className="h-8 p-1"
              onChange={(event) =>
                onChange({
                  ...layer,
                  style: { ...layer.style, fillColor: event.target.value },
                })
              }
            />
          </Field>
        </div>
        <Field>
          <FieldLabel>图层透明度 {Math.round(layer.opacity * 100)}%</FieldLabel>
          <Slider
            value={[layer.opacity * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value) => {
              const raw = Array.isArray(value) ? value[0] : value
              const opacity = (raw ?? 100) / 100
              onChange({ ...layer, opacity })
            }}
          />
        </Field>
      </div>
    </div>
  )
}
