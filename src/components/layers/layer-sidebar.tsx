import {
  Eye,
  EyeOff,
  GripVertical,
  Layers3,
  Lock,
  MapPin,
  MoreHorizontal,
  Pentagon,
  Plus,
  Trash2,
  Unlock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Layer } from "@/domain/models"
import { cn } from "@/lib/utils"

interface LayerSidebarProps {
  layers: Layer[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onToggleVisible: (layer: Layer) => void
  onToggleLocked: (layer: Layer) => void
  onDelete: (layer: Layer) => void
}

export function LayerSidebar({
  layers,
  selectedId,
  onSelect,
  onCreate,
  onToggleVisible,
  onToggleLocked,
  onDelete,
}: LayerSidebarProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l bg-background">
      <div className="flex h-12 items-center border-b px-3">
        <span className="text-sm font-medium">图层</span>
        <Button
          className="ml-auto"
          variant="ghost"
          size="icon-sm"
          aria-label="新建图层"
          onClick={onCreate}
        >
          <Plus />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {layers.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              selected={selectedId === layer.id}
              onSelect={onSelect}
              onToggleVisible={onToggleVisible}
              onToggleLocked={onToggleLocked}
              onDelete={onDelete}
            />
          ))}
          {layers.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              暂无图层
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}

function LayerRow({
  layer,
  selected,
  onSelect,
  onToggleVisible,
  onToggleLocked,
  onDelete,
}: {
  layer: Layer
  selected: boolean
  onSelect: (id: string) => void
  onToggleVisible: (layer: Layer) => void
  onToggleLocked: (layer: Layer) => void
  onDelete: (layer: Layer) => void
}) {
  const Icon =
    layer.kind === "point"
      ? MapPin
      : layer.kind === "polygon"
        ? Pentagon
        : Layers3
  return (
    <div
      className={cn(
        "mb-1 flex h-11 items-center gap-1 border border-transparent px-1",
        selected && "border-border bg-muted",
      )}
    >
      <GripVertical className="size-4 text-muted-foreground" />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onSelect(layer.id)}
      >
        <span
          className="size-3 shrink-0 border"
          style={{ backgroundColor: layer.style.color }}
        />
        <Icon className="size-4 shrink-0" />
        <span className="truncate text-sm">{layer.name}</span>
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={layer.visible ? "隐藏图层" : "显示图层"}
        onClick={() => onToggleVisible(layer)}
      >
        {layer.visible ? <Eye /> : <EyeOff />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`${layer.name} 的操作`}
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onToggleLocked(layer)}>
            {layer.locked ? <Unlock /> : <Lock />}
            {layer.locked ? "解除锁定" : "锁定"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(layer)}
          >
            <Trash2 /> 删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
