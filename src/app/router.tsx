import { createHashRouter, Navigate } from "react-router"
import { AppShell } from "@/components/layout/app-shell"
import { NotFoundPage } from "@/routes/not-found-page"
import { ProjectPage } from "@/routes/project-page"
import { ProjectsPage } from "@/routes/projects-page"

// Hash routing keeps the app deployable as plain static files — no server-side
// rewrite rules needed, which matters for a zero-backend tool.
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/projects" replace /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "projects/:projectId", element: <ProjectPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])
