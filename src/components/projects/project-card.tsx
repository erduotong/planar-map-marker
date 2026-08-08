import { formatDistanceToNow } from "date-fns"
import { Archive, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
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
import { getDateFnsLocale } from "@/i18n/date-locale"

interface ProjectCardProps {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
}

export function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  const { t, i18n } = useTranslation()
  return (
    <article className="group flex min-h-44 flex-col border bg-card p-5 text-card-foreground shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-3">
        <Link
          to={`/projects/${project.id}`}
          className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h2 className="truncate text-base font-medium">{project.name}</h2>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {project.description || t("projects.noDescription")}
          </p>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("common.actionsFor", { name: project.name })}
              >
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(project)}>
              <Pencil />
              {t("common.edit")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(project)}
            >
              <Trash2 />
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <span className="text-xs text-muted-foreground">
          {t("projects.updated", {
            time: formatDistanceToNow(project.updatedAt, {
              addSuffix: true,
              locale: getDateFnsLocale(i18n.language),
            }),
          })}
        </span>
        {project.lastExportedAt ? (
          <Badge variant="secondary">
            <Archive /> {t("projects.backedUp")}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            {t("projects.notBackedUp")}
          </Badge>
        )}
      </div>
    </article>
  )
}
