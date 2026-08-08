import type { TFunction } from "i18next"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type {
  EndpointRef,
  Feature,
  Floor,
  Layer,
  RouteNode,
} from "@/domain/models"

interface EndpointPickerDialogProps {
  open: boolean
  title: string
  /** Nodes of the current route layer. */
  nodes: RouteNode[]
  /** Project-wide point features, grouped by floor. */
  features: Feature[]
  floors: Floor[]
  layers: Layer[]
  onPick: (ref: EndpointRef) => void
  onOpenChange: (open: boolean) => void
}

export function EndpointPickerDialog({
  open,
  title,
  nodes,
  features,
  floors,
  layers,
  onPick,
  onOpenChange,
}: EndpointPickerDialogProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<"nodes" | "features">(
    nodes.length ? "nodes" : "features",
  )
  const floorById = new Map(floors.map((floor) => [floor.id, floor]))
  const layerById = new Map(layers.map((layer) => [layer.id, layer]))
  const featuresByFloor = groupFeaturesByFloor(features, layers)

  function pick(ref: EndpointRef) {
    onPick(ref)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t("routes.endpointPickerDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-1">
          <Button
            variant={tab === "nodes" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTab("nodes")}
          >
            {t("routes.nodesTab", { count: nodes.length })}
          </Button>
          <Button
            variant={tab === "features" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTab("features")}
          >
            {t("routes.featuresTab", { count: features.length })}
          </Button>
        </div>
        <ScrollArea className="max-h-80 min-h-40">
          {tab === "nodes" ? (
            nodes.length ? (
              <div className="grid gap-1 p-1">
                {nodes.map((node) => (
                  <Button
                    key={node.id}
                    variant="ghost"
                    className="justify-start font-mono text-xs"
                    onClick={() => pick({ kind: "node", nodeId: node.id })}
                  >
                    {t("routes.pickNode", {
                      id: node.id.slice(0, 8),
                      x: Math.round(node.coord.x),
                      y: Math.round(node.coord.y),
                    })}
                  </Button>
                ))}
              </div>
            ) : (
              <EmptyHint text={t("routes.noNodesHint")} />
            )
          ) : features.length ? (
            <div className="grid gap-3 p-1">
              {[...featuresByFloor.entries()].map(([floorId, items]) => {
                const floor = floorById.get(floorId)
                return (
                  <div key={floorId}>
                    <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">
                      {floor?.name ?? t("routes.unknownFloor")}
                    </p>
                    <div className="grid gap-1">
                      {items.map((feature) => {
                        const layer = layerById.get(feature.layerId)
                        return (
                          <Button
                            key={feature.id}
                            variant="ghost"
                            className="justify-start text-xs"
                            onClick={() =>
                              pick({
                                kind: "feature",
                                floorId,
                                layerId: feature.layerId,
                                featureId: feature.id,
                              })
                            }
                          >
                            <span className="truncate">
                              {featureLabel(feature, t)}
                            </span>
                            <span className="ml-auto shrink-0 text-muted-foreground">
                              {layer?.name ?? t("routes.unknownLayer")}
                            </span>
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyHint text={t("routes.noPointFeatures")} />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function featureLabel(feature: Feature, t: TFunction): string {
  for (const value of Object.values(feature.properties)) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return t("routes.pointLabel", { id: feature.id.slice(0, 8) })
}

function groupFeaturesByFloor(
  features: Feature[],
  layers: Layer[],
): Map<string, Feature[]> {
  const layerFloor = new Map(layers.map((layer) => [layer.id, layer.floorId]))
  const grouped = new Map<string, Feature[]>()
  for (const feature of features) {
    const floorId = layerFloor.get(feature.layerId)
    if (!floorId) continue
    const list = grouped.get(floorId)
    if (list) list.push(feature)
    else grouped.set(floorId, [feature])
  }
  return grouped
}
