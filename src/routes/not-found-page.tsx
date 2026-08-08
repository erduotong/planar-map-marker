import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <p className="text-sm text-muted-foreground">
        {t("common.pageNotFound")}
      </p>
      <Button render={<Link to="/projects">{t("projects.backToList")}</Link>} />
    </div>
  )
}
