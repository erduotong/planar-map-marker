import { MapPin, Pentagon, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  Constraint,
  ConstraintField,
  Feature,
  Layer,
} from "@/domain/models"
import { cn } from "@/lib/utils"

interface FeatureTableProps {
  features: Feature[]
  layer: Layer
  constraint: Constraint | null
  selectedFeatureId: string | null
  onSelect: (feature: Feature) => void
  onUpdate: (feature: Feature, key: string, value: unknown) => Promise<boolean>
  onDelete: (feature: Feature) => void
}

export function FeatureTable({
  features,
  layer,
  constraint,
  selectedFeatureId,
  onSelect,
  onUpdate,
  onDelete,
}: FeatureTableProps) {
  const { t } = useTranslation()
  const fields = constraint?.fields ?? []

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center border-b px-3">
        <span className="text-sm font-medium">
          {t("features.tableTitle", { name: layer.name })}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {t("features.count", { count: features.length })}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {features.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {t("features.empty")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-9">{t("features.geometry")}</TableHead>
                {fields.map((field) => (
                  <TableHead key={field.id}>{field.label}</TableHead>
                ))}
                <TableHead className="w-9" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map((feature) => (
                <TableRow
                  key={feature.id}
                  data-selected={
                    feature.id === selectedFeatureId ? "" : undefined
                  }
                  className={cn(
                    "cursor-pointer",
                    feature.id === selectedFeatureId && "bg-accent/60",
                  )}
                  onClick={() => onSelect(feature)}
                >
                  <TableCell className="text-muted-foreground">
                    <GeometryIcon feature={feature} />
                  </TableCell>
                  {fields.map((field) => (
                    <TableCell
                      key={field.id}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <PropertyCell
                        field={field}
                        value={feature.properties[field.key]}
                        onCommit={(value) =>
                          onUpdate(feature, field.key, value)
                        }
                      />
                    </TableCell>
                  ))}
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("features.delete")}
                      onClick={() => onDelete(feature)}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

function GeometryIcon({ feature }: { feature: Feature }) {
  const { t } = useTranslation()
  if (feature.geometry.type === "Point") {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <MapPin className="size-3.5" />
        {feature.geometry.coord.x}, {feature.geometry.coord.y}
      </span>
    )
  }
  const vertexCount = feature.geometry.rings.flat().length
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <Pentagon className="size-3.5" />
      {t("features.polygonVertices", { count: vertexCount })}
    </span>
  )
}

function PropertyCell({
  field,
  value,
  onCommit,
}: {
  field: ConstraintField
  value: unknown
  onCommit: (value: unknown) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<unknown>(value)
  const [invalid, setInvalid] = useState(false)

  async function commit(next: unknown) {
    if (await onCommit(next)) {
      setDraft(next)
      setInvalid(false)
    } else {
      setInvalid(true)
      setDraft(value)
    }
  }

  if (field.type === "boolean") {
    return (
      <Checkbox
        checked={draft === true}
        aria-label={field.label}
        onCheckedChange={(checked) => commit(checked === true)}
      />
    )
  }
  if (field.type === "enum") {
    return (
      <Select
        value={typeof draft === "string" ? draft : ""}
        onValueChange={(next) => commit(next)}
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
  // Text-like inputs keep a string draft while editing and only parse on blur,
  // so an in-progress number never carries a NaN into the DOM.
  const text =
    typeof draft === "string"
      ? draft
      : draft === null || draft === undefined
        ? ""
        : String(draft)
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
      className={cn(
        "h-7 w-full px-1.5",
        field.type === "color" && "p-1",
        invalid && "border-destructive ring-2 ring-destructive/20",
      )}
      value={text}
      onClick={(event) => event.stopPropagation()}
      onBlur={() => commit(parseFieldValue(field, draft))}
      onChange={(event) => setDraft(event.target.value)}
    />
  )
}

function parseFieldValue(field: ConstraintField, draft: unknown): unknown {
  if (field.type === "number") {
    if (typeof draft === "string") {
      return draft === "" ? undefined : Number(draft)
    }
    return draft
  }
  return typeof draft === "string" ? draft : String(draft ?? "")
}
