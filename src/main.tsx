import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "@/i18n"
import { requestPersistentStorage } from "@/lib/persistent-storage"
import App from "./App.tsx"

requestPersistentStorage()

const container = document.getElementById("root")
if (!container) throw new Error("Missing #root element in index.html")

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
