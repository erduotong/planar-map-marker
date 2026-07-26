import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Archive, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Project } from "@/domain/models"

interface ProjectCardProps {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
}

export function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  return (
    <article className="group flex min-h-44 flex-col border bg-card p-5 text-card-foreground shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-3">
        <Link
          to={`/projects/${project.id}`}
          className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h2 className="truncate text-base font-medium">{project.name}</h2>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {project.description || "暂无简介"}
          </p>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${project.name} 的操作`}
              >
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(project)}>
              <Pencil />
              编辑
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(project)}
            >
              <Trash2 />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(project.updatedAt, {
            addSuffix: true,
            locale: zhCN,
          })}
          更新
        </span>
        {project.lastExportedAt ? (
          <Badge variant="secondary">
            <Archive /> 已备份
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            未备份
          </Badge>
        )}
      </div>
    </article>
  )
}
