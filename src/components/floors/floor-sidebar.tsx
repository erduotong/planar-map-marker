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
  FileImage,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
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
import type { Floor } from "@/domain/models"
import { cn } from "@/lib/utils"

interface FloorSidebarProps {
  floors: Floor[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (floor: Floor) => void
  onDelete: (floor: Floor) => void
  onUpload: (floor: Floor) => void
  onReorder: (ids: string[]) => void
}

export function FloorSidebar({
  floors,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onUpload,
  onReorder,
}: FloorSidebarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function dragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = floors.findIndex((floor) => floor.id === active.id)
    const newIndex = floors.findIndex((floor) => floor.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(floors, oldIndex, newIndex).map((floor) => floor.id))
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-background">
      <div className="flex h-12 shrink-0 items-center border-b px-3">
        <span className="text-sm font-medium">楼层</span>
        <Button
          className="ml-auto"
          variant="ghost"
          size="icon-sm"
          aria-label="新建楼层"
          onClick={onCreate}
        >
          <Plus />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {floors.length ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={dragEnd}
          >
            <SortableContext
              items={floors.map((floor) => floor.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="p-2">
                {floors.map((floor) => (
                  <SortableFloor
                    key={floor.id}
                    floor={floor}
                    selected={floor.id === selectedId}
                    onSelect={onSelect}
                    onRename={onRename}
                    onDelete={onDelete}
                    onUpload={onUpload}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            暂无楼层
          </div>
        )}
      </ScrollArea>
      <div className="border-t p-2">
        <Button variant="outline" className="w-full" onClick={onCreate}>
          <Plus />
          新建楼层
        </Button>
      </div>
    </aside>
  )
}

interface SortableFloorProps {
  floor: Floor
  selected: boolean
  onSelect: (id: string) => void
  onRename: (floor: Floor) => void
  onDelete: (floor: Floor) => void
  onUpload: (floor: Floor) => void
}

function SortableFloor({
  floor,
  selected,
  onSelect,
  onRename,
  onDelete,
  onUpload,
}: SortableFloorProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: floor.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group mb-1 flex h-12 items-center gap-1 border border-transparent px-1.5",
        selected && "border-border bg-muted",
        isDragging && "z-50 bg-background opacity-80 shadow-md",
      )}
    >
      <button
        type="button"
        className="flex size-7 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
        aria-label={`拖动 ${floor.name} 排序`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onSelect(floor.id)}
      >
        <FileImage
          className={cn(
            "size-4 shrink-0",
            floor.basemap ? "text-foreground" : "text-muted-foreground",
          )}
        />
        <span className="truncate text-sm">{floor.name}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`${floor.name} 的操作`}
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onUpload(floor)}>
            <Upload />
            {floor.basemap ? "替换底图" : "上传底图"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRename(floor)}>
            <Pencil /> 重命名
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(floor)}
          >
            <Trash2 /> 删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
