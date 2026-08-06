import { useState } from "react"
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
            选择节点，或选择任意楼层的点要素作为端点。
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-1">
          <Button
            variant={tab === "nodes" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTab("nodes")}
          >
            节点（{nodes.length}）
          </Button>
          <Button
            variant={tab === "features" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTab("features")}
          >
            点要素（{features.length}）
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
                    节点 {node.id.slice(0, 8)} · x {Math.round(node.coord.x)} y{" "}
                    {Math.round(node.coord.y)}
                  </Button>
                ))}
              </div>
            ) : (
              <EmptyHint text="这个路线图层还没有节点，请先在图层上放置节点。" />
            )
          ) : features.length ? (
            <div className="grid gap-3 p-1">
              {[...featuresByFloor.entries()].map(([floorId, items]) => {
                const floor = floorById.get(floorId)
                return (
                  <div key={floorId}>
                    <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">
                      {floor?.name ?? "未知楼层"}
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
                              {featureLabel(feature)}
                            </span>
                            <span className="ml-auto shrink-0 text-muted-foreground">
                              {layer?.name ?? "未知图层"}
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
            <EmptyHint text="项目里还没有点要素。" />
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

function featureLabel(feature: Feature): string {
  for (const value of Object.values(feature.properties)) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return `点 ${feature.id.slice(0, 8)}`
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
