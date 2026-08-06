import { useRef } from "react"
import { cn } from "@/lib/utils"

interface ResizeHandleProps {
  /** "x" drags horizontally and resizes the element's width. */
  axis: "x" | "y"
  onDelta: (delta: number) => void
  className?: string
}

/** A thin draggable separator. Pointer events are captured on the window so the drag never drops mid-move. */
export function ResizeHandle({ axis, onDelta, className }: ResizeHandleProps) {
  const lastPosition = useRef(0)

  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      onPointerDown={(event) => {
        lastPosition.current = axis === "x" ? event.clientX : event.clientY
        const move = (moveEvent: PointerEvent) => {
          const current = axis === "x" ? moveEvent.clientX : moveEvent.clientY
          onDelta(current - lastPosition.current)
          lastPosition.current = current
        }
        const up = () => {
          window.removeEventListener("pointermove", move)
          window.removeEventListener("pointerup", up)
        }
        window.addEventListener("pointermove", move)
        window.addEventListener("pointerup", up)
        event.preventDefault()
      }}
      className={cn(
        "z-10 shrink-0 touch-none select-none bg-transparent transition-colors hover:bg-primary/40 active:bg-primary/50",
        axis === "x"
          ? "h-full w-1 cursor-col-resize"
          : "h-1 w-full cursor-row-resize",
        className,
      )}
    />
  )
}
