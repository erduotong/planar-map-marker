import { Database, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Constraint } from "@/domain/models"

export function ConstraintMenu({
  constraints,
  onCreate,
  onEdit,
  onDelete,
}: {
  constraints: Constraint[]
  onCreate: () => void
  onEdit: (constraint: Constraint) => void
  onDelete: (constraint: Constraint) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            <Database /> 数据约束
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onClick={onCreate}>
          <Plus /> 新建数据约束
        </DropdownMenuItem>
        {constraints.length > 0 && <DropdownMenuSeparator />}
        {constraints.map((constraint) => (
          <DropdownMenuItem key={constraint.id}>
            <span className="min-w-0 flex-1 truncate">{constraint.name}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`编辑 ${constraint.name}`}
              onClick={(event) => {
                event.stopPropagation()
                onEdit(constraint)
              }}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`删除 ${constraint.name}`}
              onClick={(event) => {
                event.stopPropagation()
                onDelete(constraint)
              }}
            >
              <Trash2 />
            </Button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
