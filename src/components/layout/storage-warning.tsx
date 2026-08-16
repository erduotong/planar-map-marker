import { TriangleAlert } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { hasEvictionRisk } from "@/lib/persistent-storage"

/**
 * Header badge shown while the browser may evict this origin's data
 * (persistent storage not granted), nudging the user to export backups.
 */
export function StorageWarning() {
  const { t } = useTranslation()
  const [atRisk, setAtRisk] = useState(false)

  useEffect(() => {
    let cancelled = false
    hasEvictionRisk().then((risk) => {
      if (!cancelled) setAtRisk(risk)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!atRisk) return null

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge variant="destructive">
            <TriangleAlert />
            {t("storageWarning.badge")}
          </Badge>
        }
      />
      <TooltipContent>{t("storageWarning.tooltip")}</TooltipContent>
    </Tooltip>
  )
}
