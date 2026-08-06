import { Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type EndpointContext, endpointLabel } from "@/domain/graph"
import type {
  Constraint,
  ConstraintField,
  EdgeDirection,
  RouteEdge,
  RouteNode,
} from "@/domain/models"
import { cn } from "@/lib/utils"

interface RouteTableProps {
  nodes: RouteNode[]
  edges: RouteEdge[]
  nodeConstraint: Constraint | null
  edgeConstraint: Constraint | null
  context: EndpointContext
  selectedNodeId: string | null
  selectedEdgeId: string | null
  onSelectNode: (node: RouteNode) => void
  onSelectEdge: (edge: RouteEdge) => void
  onUpdateNode: (
    node: RouteNode,
    key: string,
    value: unknown,
  ) => Promise<boolean>
  onUpdateEdge: (
    edge: RouteEdge,
    key: string,
    value: unknown,
  ) => Promise<boolean>
  onDeleteNode: (node: RouteNode) => void
  onDeleteEdge: (edge: RouteEdge) => void
}

export function RouteTable({
  nodes,
  edges,
  nodeConstraint,
  edgeConstraint,
  context,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
}: RouteTableProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs defaultValue="nodes" className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-10 shrink-0 items-center border-b px-3">
          <TabsList>
            <TabsTrigger value="nodes">节点（{nodes.length}）</TabsTrigger>
            <TabsTrigger value="edges">边（{edges.length}）</TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <TabsContent value="nodes" className="min-h-full">
            <NodeTable
              nodes={nodes}
              constraint={nodeConstraint}
              selectedNodeId={selectedNodeId}
              onSelect={onSelectNode}
              onUpdate={onUpdateNode}
              onDelete={onDeleteNode}
            />
          </TabsContent>
          <TabsContent value="edges" className="min-h-full">
            <EdgeTable
              edges={edges}
              constraint={edgeConstraint}
              context={context}
              selectedEdgeId={selectedEdgeId}
              onSelect={onSelectEdge}
              onUpdate={onUpdateEdge}
              onDelete={onDeleteEdge}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

function NodeTable({
  nodes,
  constraint,
  selectedNodeId,
  onSelect,
  onUpdate,
  onDelete,
}: {
  nodes: RouteNode[]
  constraint: Constraint | null
  selectedNodeId: string | null
  onSelect: (node: RouteNode) => void
  onUpdate: (node: RouteNode, key: string, value: unknown) => Promise<boolean>
  onDelete: (node: RouteNode) => void
}) {
  const fields = constraint?.fields ?? []
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">x</TableHead>
          <TableHead className="w-16">y</TableHead>
          {fields.map((field) => (
            <TableHead key={field.id}>{field.label}</TableHead>
          ))}
          <TableHead className="w-9" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {nodes.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={fields.length + 3}
              className="py-8 text-center text-muted-foreground"
            >
              这个图层还没有节点，用「放置节点」工具在地图上添加。
            </TableCell>
          </TableRow>
        )}
        {nodes.map((node) => (
          <TableRow
            key={node.id}
            className={cn(
              "cursor-pointer",
              node.id === selectedNodeId && "bg-accent/60",
            )}
            onClick={() => onSelect(node)}
          >
            <TableCell className="font-mono text-xs text-muted-foreground">
              {Math.round(node.coord.x)}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {Math.round(node.coord.y)}
            </TableCell>
            {fields.map((field) => (
              <TableCell
                key={field.id}
                onClick={(event) => event.stopPropagation()}
              >
                <PropertyCell
                  field={field}
                  value={node.properties[field.key]}
                  onCommit={(value) => onUpdate(node, field.key, value)}
                />
              </TableCell>
            ))}
            <TableCell onClick={(event) => event.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="删除节点"
                onClick={() => onDelete(node)}
              >
                <Trash2 />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

function EdgeTable({
  edges,
  constraint,
  context,
  selectedEdgeId,
  onSelect,
  onUpdate,
  onDelete,
}: {
  edges: RouteEdge[]
  constraint: Constraint | null
  context: EndpointContext
  selectedEdgeId: string | null
  onSelect: (edge: RouteEdge) => void
  onUpdate: (edge: RouteEdge, key: string, value: unknown) => Promise<boolean>
  onDelete: (edge: RouteEdge) => void
}) {
  const fields = constraint?.fields ?? []
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>起点</TableHead>
          <TableHead>终点</TableHead>
          <TableHead className="w-20">方向</TableHead>
          <TableHead className="w-16">可通行</TableHead>
          <TableHead className="w-20">长度</TableHead>
          {fields.map((field) => (
            <TableHead key={field.id}>{field.label}</TableHead>
          ))}
          <TableHead className="w-9" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {edges.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={fields.length + 6}
              className="py-8 text-center text-muted-foreground"
            >
              这个图层还没有边，用「连接边」工具在地图上连接节点或点要素。
            </TableCell>
          </TableRow>
        )}
        {edges.map((edge) => (
          <TableRow
            key={edge.id}
            className={cn(
              "cursor-pointer",
              edge.id === selectedEdgeId && "bg-accent/60",
            )}
            onClick={() => onSelect(edge)}
          >
            <TableCell
              className="max-w-32 truncate text-xs"
              title={endpointLabel(edge.source, context)}
            >
              {endpointLabel(edge.source, context)}
            </TableCell>
            <TableCell
              className="max-w-32 truncate text-xs"
              title={endpointLabel(edge.target, context)}
            >
              {endpointLabel(edge.target, context)}
            </TableCell>
            <TableCell onClick={(event) => event.stopPropagation()}>
              <DirectionSelect
                value={edge.direction}
                onChange={(value) => onUpdate(edge, "direction", value)}
              />
            </TableCell>
            <TableCell onClick={(event) => event.stopPropagation()}>
              <Checkbox
                aria-label="可通行"
                checked={edge.passable}
                onCheckedChange={(checked) =>
                  onUpdate(edge, "passable", checked === true)
                }
              />
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {Math.round(edge.length)}
            </TableCell>
            {fields.map((field) => (
              <TableCell
                key={field.id}
                onClick={(event) => event.stopPropagation()}
              >
                <PropertyCell
                  field={field}
                  value={edge.properties[field.key]}
                  onCommit={(value) => onUpdate(edge, field.key, value)}
                />
              </TableCell>
            ))}
            <TableCell onClick={(event) => event.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="删除边"
                onClick={() => onDelete(edge)}
              >
                <Trash2 />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const DIRECTION_LABELS: Record<EdgeDirection, string> = {
  both: "双向",
  forward: "顺向",
  backward: "逆向",
}

function DirectionSelect({
  value,
  onChange,
}: {
  value: EdgeDirection
  onChange: (value: EdgeDirection) => Promise<boolean>
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next === "both" || next === "forward" || next === "backward") {
          void onChange(next)
        }
      }}
    >
      <SelectTrigger className="h-7 w-full text-xs">
        <SelectValue>{DIRECTION_LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(DIRECTION_LABELS).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ---------------------------------------------------------------------------
// Shared cell editing (mirrors the feature table's per-field save)
// ---------------------------------------------------------------------------

function PropertyCell({
  field,
  value,
  onCommit,
}: {
  field: ConstraintField
  value: unknown
  onCommit: (value: unknown) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<unknown>(value)
  const [invalid, setInvalid] = useState(false)

  async function commit(next: unknown) {
    if (await onCommit(next)) {
      setDraft(next)
      setInvalid(false)
    } else {
      setInvalid(true)
      setDraft(value)
    }
  }

  if (field.type === "boolean") {
    return (
      <Checkbox
        checked={draft === true}
        aria-label={field.label}
        onCheckedChange={(checked) => commit(checked === true)}
      />
    )
  }
  if (field.type === "enum") {
    return (
      <Select
        value={typeof draft === "string" ? draft : ""}
        onValueChange={(next) => commit(next)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  const text =
    typeof draft === "string"
      ? draft
      : draft === null || draft === undefined
        ? ""
        : String(draft)
  return (
    <Input
      type={
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : field.type === "color"
              ? "color"
              : "text"
      }
      className={cn(
        "h-7 w-full px-1.5",
        field.type === "color" && "p-1",
        invalid && "border-destructive ring-2 ring-destructive/20",
      )}
      value={text}
      onClick={(event) => event.stopPropagation()}
      onBlur={() => commit(parseFieldValue(field, draft))}
      onChange={(event) => setDraft(event.target.value)}
    />
  )
}

function parseFieldValue(field: ConstraintField, draft: unknown): unknown {
  if (field.type === "number") {
    if (typeof draft === "string") {
      return draft === "" ? undefined : Number(draft)
    }
    return draft
  }
  return typeof draft === "string" ? draft : String(draft ?? "")
}
