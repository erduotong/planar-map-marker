import { X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type EndpointContext, endpointLabel } from "@/domain/graph"
import type { EdgeDirection, EndpointRef } from "@/domain/models"

const DIRECTION_OPTIONS: { value: EdgeDirection; label: string }[] = [
  { value: "both", label: "双向" },
  { value: "forward", label: "顺向" },
  { value: "backward", label: "逆向" },
]

interface EdgeConnectPaletteProps {
  source: EndpointRef | null
  target: EndpointRef | null
  context: EndpointContext
  /** Opens the endpoint picker for a slot. */
  onPickSlot: (slot: "source" | "target") => void
  onCreate: (direction: EdgeDirection, passable: boolean) => Promise<void>
  onCancel: () => void
}

export function EdgeConnectPalette({
  source,
  target,
  context,
  onPickSlot,
  onCreate,
  onCancel,
}: EdgeConnectPaletteProps) {
  const [direction, setDirection] = useState<EdgeDirection>("both")
  const [passable, setPassable] = useState(true)
  const [pending, setPending] = useState(false)
  const complete = source !== null && target !== null

  async function create() {
    setPending(true)
    try {
      await onCreate(direction, passable)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="absolute top-16 left-1/2 z-10 w-[22rem] -translate-x-1/2 rounded-lg border bg-background p-3 shadow-lg">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium">连接边</span>
        <Button
          className="ml-auto"
          variant="ghost"
          size="icon-xs"
          aria-label="退出连边"
          onClick={onCancel}
        >
          <X />
        </Button>
      </div>
      <div className="grid gap-2 text-xs">
        <EndpointSlot
          label="起点"
          ref={source}
          context={context}
          onOpen={() => onPickSlot("source")}
        />
        <EndpointSlot
          label="终点"
          ref={target}
          context={context}
          onOpen={() => onPickSlot("target")}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        也可以直接在地图上点击节点或点要素拾取端点。
      </p>
      {complete && (
        <div className="mt-3 grid gap-3 border-t pt-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">方向</span>
            <Select
              value={direction}
              onValueChange={(value) => {
                if (
                  value === "both" ||
                  value === "forward" ||
                  value === "backward"
                ) {
                  setDirection(value)
                }
              }}
            >
              <SelectTrigger className="h-7 flex-1 text-xs">
                <SelectValue>
                  {DIRECTION_OPTIONS.find((item) => item.value === direction)
                    ?.label ?? direction}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DIRECTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              aria-label="可通行"
              checked={passable}
              onCheckedChange={(checked) => setPassable(checked === true)}
            />
            <span>可通行</span>
          </div>
          <Button onClick={create} disabled={pending}>
            {pending ? "正在创建…" : "创建边"}
          </Button>
        </div>
      )}
    </div>
  )
}

function EndpointSlot({
  label,
  ref,
  context,
  onOpen,
}: {
  label: string
  ref: EndpointRef | null
  context: EndpointContext
  onOpen: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate">
        {ref ? endpointLabel(ref, context) : "未选择"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 shrink-0"
        onClick={onOpen}
      >
        选择
      </Button>
    </div>
  )
}
