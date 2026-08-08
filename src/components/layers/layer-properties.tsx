import { Paintbrush, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
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

  return (
    <div className="border-t p-3">
      <div className="mb-3 flex items-center gap-2">
        <Paintbrush className="size-4" />
        <span className="text-sm font-medium">{t("layers.settings")}</span>
        <Button
          className="ml-auto"
          variant="ghost"
          size="icon-sm"
          aria-label={t("layers.delete")}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="grid gap-4">
        <Field>
          <FieldLabel>{t("common.name")}</FieldLabel>
          <Input
            value={draft.name}
            onBlur={flushPending}
            onChange={(event) => commit({ ...draft, name: event.target.value })}
          />
        </Field>
        {draft.kind === "route" ? (
          <>
            <Field>
              <FieldLabel>{t("layers.nodeConstraint")}</FieldLabel>
              <ConstraintSelect
                value={draft.nodeConstraintId}
                constraints={constraints}
                onSelect={(id) => commit({ ...draft, nodeConstraintId: id })}
              />
            </Field>
            <Field>
              <FieldLabel>{t("layers.edgeConstraint")}</FieldLabel>
              <ConstraintSelect
                value={draft.edgeConstraintId}
                constraints={constraints}
                onSelect={(id) => commit({ ...draft, edgeConstraintId: id })}
              />
            </Field>
          </>
        ) : (
          <Field>
            <FieldLabel>{t("layers.constraint")}</FieldLabel>
            <ConstraintSelect
              value={draft.constraintId}
              constraints={constraints}
              onSelect={(id) => commit({ ...draft, constraintId: id })}
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>{t("layers.stroke")}</FieldLabel>
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
            <FieldLabel>{t("layers.fill")}</FieldLabel>
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
          <FieldLabel>
            {t("layers.opacity", {
              percent: Math.round(draft.opacity * 100),
            })}
          </FieldLabel>
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

function ConstraintSelect({
  value,
  constraints,
  onSelect,
}: {
  value: string | null
  constraints: Constraint[]
  onSelect: (id: string | null) => void
}) {
  const { t } = useTranslation()
  return (
    <Select
      value={value ?? "none"}
      onValueChange={(next) => onSelect(next === "none" ? null : String(next))}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          {value
            ? (constraints.find((item) => item.id === value)?.name ?? value)
            : t("layers.noConstraint")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{t("layers.noConstraint")}</SelectItem>
        {constraints.map((constraint) => (
          <SelectItem key={constraint.id} value={constraint.id}>
            {constraint.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
