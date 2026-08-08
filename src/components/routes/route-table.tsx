import type { TFunction } from "i18next"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs defaultValue="nodes" className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-10 shrink-0 items-center border-b px-3">
          <TabsList>
            <TabsTrigger value="nodes">
              {t("routes.nodesTab", { count: nodes.length })}
            </TabsTrigger>
            <TabsTrigger value="edges">
              {t("routes.edgesTab", { count: edges.length })}
            </TabsTrigger>
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
  const { t } = useTranslation()
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
              {t("routes.noNodes")}
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
                aria-label={t("routes.deleteNode")}
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
  const { t } = useTranslation()
  const fields = constraint?.fields ?? []
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("routes.source")}</TableHead>
          <TableHead>{t("routes.target")}</TableHead>
          <TableHead className="w-20">{t("routes.direction")}</TableHead>
          <TableHead className="w-16">{t("routes.passable")}</TableHead>
          <TableHead className="w-20">{t("routes.length")}</TableHead>
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
              {t("routes.noEdges")}
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
                aria-label={t("routes.passable")}
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
                aria-label={t("routes.deleteEdge")}
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

function directionLabels(t: TFunction): Record<EdgeDirection, string> {
  return {
    both: t("routes.directions.both"),
    forward: t("routes.directions.forward"),
    backward: t("routes.directions.backward"),
  }
}

function DirectionSelect({
  value,
  onChange,
}: {
  value: EdgeDirection
  onChange: (value: EdgeDirection) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const labels = directionLabels(t)
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
        <SelectValue>{labels[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(labels).map(([key, label]) => (
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
