import { Link } from "react-router"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <p className="text-sm text-muted-foreground">页面不存在</p>
      <Button render={<Link to="/projects">回到项目列表</Link>} />
    </div>
  )
}
