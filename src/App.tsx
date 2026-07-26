import { RouterProvider } from "react-router"
import { router } from "@/app/router"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
