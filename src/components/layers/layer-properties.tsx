import { Paintbrush, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
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

/**
 * Colour pickers and the opacity slider fire many onChange events while being
 * dragged. Editing against a local draft gives instant visual feedback, while a
 * debounced commit collapses the whole drag into a single command / undo step.
 * A blur (or unmount) flushes the pending value so nothing is lost.
 */
const COMMIT_DELAY_MS = 200

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
  const [draft, setDraft] = useState(layer)
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<Layer | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    setDraft(layer)
  }, [layer])

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      if (pendingRef.current) {
        onChangeRef.current(pendingRef.current)
        pendingRef.current = null
      }
    },
    [],
  )

  function flushPending() {
    if (pendingRef.current) {
      onChangeRef.current(pendingRef.current)
      pendingRef.current = null
    }
  }

  function commit(next: Layer) {
    setDraft(next)
    pendingRef.current = next
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      if (pendingRef.current) {
        onChange(pendingRef.current)
        pendingRef.current = null
      }
    }, COMMIT_DELAY_MS)
  }

  const constraintId =
    draft.kind === "route" ? draft.nodeConstraintId : draft.constraintId

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
            value={draft.name}
            onBlur={flushPending}
            onChange={(event) => commit({ ...draft, name: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel>数据约束</FieldLabel>
          <Select
            value={constraintId ?? "none"}
            onValueChange={(value) => {
              const id = value === "none" ? null : String(value)
              commit(
                draft.kind === "route"
                  ? { ...draft, nodeConstraintId: id }
                  : { ...draft, constraintId: id },
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
              value={draft.style.color}
              className="h-8 p-1"
              onChange={(event) =>
                commit({
                  ...draft,
                  style: { ...draft.style, color: event.target.value },
                })
              }
            />
          </Field>
          <Field>
            <FieldLabel>填充</FieldLabel>
            <Input
              type="color"
              value={draft.style.fillColor}
              className="h-8 p-1"
              onChange={(event) =>
                commit({
                  ...draft,
                  style: { ...draft.style, fillColor: event.target.value },
                })
              }
            />
          </Field>
        </div>
        <Field>
          <FieldLabel>图层透明度 {Math.round(draft.opacity * 100)}%</FieldLabel>
          <Slider
            value={[draft.opacity * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value) => {
              const raw = Array.isArray(value) ? value[0] : value
              const opacity = (raw ?? 100) / 100
              commit({ ...draft, opacity })
            }}
          />
        </Field>
      </div>
    </div>
  )
}
