import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  onReorder: (ids: string[]) => void
}

export function LayerSidebar({
  layers,
  selectedId,
  onSelect,
  onCreate,
  onToggleVisible,
  onToggleLocked,
  onDelete,
  onReorder,
}: LayerSidebarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function dragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = layers.findIndex((layer) => layer.id === active.id)
    const newIndex = layers.findIndex((layer) => layer.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(layers, oldIndex, newIndex).map((layer) => layer.id))
  }

  return (
    <aside className="flex h-full w-full shrink-0 flex-col bg-background">
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
          {layers.length ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={dragEnd}
            >
              <SortableContext
                items={layers.map((layer) => layer.id)}
                strategy={verticalListSortingStrategy}
              >
                {layers.map((layer) => (
                  <SortableLayerRow
                    key={layer.id}
                    layer={layer}
                    selected={selectedId === layer.id}
                    onSelect={onSelect}
                    onToggleVisible={onToggleVisible}
                    onToggleLocked={onToggleLocked}
                    onDelete={onDelete}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              暂无图层
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}

function SortableLayerRow({
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id })

  const Icon =
    layer.kind === "point"
      ? MapPin
      : layer.kind === "polygon"
        ? Pentagon
        : Layers3

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group mb-1 flex h-11 items-center gap-1 border border-transparent px-1",
        selected && "border-border bg-muted",
        isDragging && "z-50 bg-background opacity-80 shadow-md",
      )}
    >
      <button
        type="button"
        className="flex size-5 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
        aria-label={`拖动 ${layer.name} 排序`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
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
        <span
          className={cn(
            "truncate text-sm",
            layer.locked && "italic text-muted-foreground",
          )}
        >
          {layer.name}
        </span>
      </button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={layer.visible ? "隐藏图层" : "显示图层"}
              onClick={() => onToggleVisible(layer)}
            >
              {layer.visible ? <Eye /> : <EyeOff />}
            </Button>
          }
        />
        <TooltipContent>{layer.visible ? "隐藏" : "显示"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={layer.locked ? "解除锁定" : "锁定图层"}
              data-locked={layer.locked ? "" : undefined}
              onClick={() => onToggleLocked(layer)}
            >
              <Lock
                className={
                  layer.locked ? "text-amber-500" : "text-muted-foreground"
                }
              />
            </Button>
          }
        />
        <TooltipContent>{layer.locked ? "已锁定" : "锁定"}</TooltipContent>
      </Tooltip>
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
            <Lock /> {layer.locked ? "解除锁定" : "锁定"}
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
