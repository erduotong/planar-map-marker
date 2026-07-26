import { MapIcon } from "lucide-react"
import { Link, Outlet } from "react-router"
import { ThemeToggle } from "@/components/theme-toggle"

export function AppShell() {
  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Link to="/projects" className="flex items-center gap-2 font-medium">
          <MapIcon className="size-5 text-primary" />
          map-pointer
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
