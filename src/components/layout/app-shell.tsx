import { Link, Outlet } from "react-router"
import { ThemeToggle } from "@/components/theme-toggle"

export function AppShell() {
  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Link to="/projects" className="flex items-center gap-2 font-medium">
          <img src="/favicon.svg" alt="" className="size-5" />
          Planar Map Marker
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
