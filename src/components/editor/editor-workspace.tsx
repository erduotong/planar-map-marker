import {
  CircleDot,
  Link2,
  MapPin,
  MousePointer2,
  Pentagon,
  Redo2,
  Undo2,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ConstraintDialog,
  type ConstraintDraft,
} from "@/components/constraints/constraint-dialog"
import { ConstraintMenu } from "@/components/constraints/constraint-menu"
import { FeatureProperties } from "@/components/features/feature-properties"
import { FeatureTable } from "@/components/features/feature-table"
import { LayerDialog } from "@/components/layers/layer-dialog"
import { LayerProperties } from "@/components/layers/layer-properties"
import { LayerSidebar } from "@/components/layers/layer-sidebar"
import { EdgeConnectPalette } from "@/components/routes/edge-connect-palette"
import { EndpointPickerDialog } from "@/components/routes/endpoint-picker"
import { RouteEdgeProperties } from "@/components/routes/route-edge-properties"
import { RouteNodeProperties } from "@/components/routes/route-node-properties"
import { RouteTable } from "@/components/routes/route-table"
import { Button } from "@/components/ui/button"
import { ResizeHandle } from "@/components/ui/resize-handle"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { initialProperties } from "@/domain/constraint-compiler"
import { buildEndpointContext } from "@/domain/graph"
import type {
  Asset,
  Constraint,
  EdgeDirection,
  EndpointRef,
  Feature,
  Geometry,
  LayerKind,
  Pixel,
  RouteEdge,
  RouteNode,
} from "@/domain/models"
import {
  useConstraints,
  useFeatures,
  useLayers,
  useProjectLayers,
  useProjectPointFeatures,
  useRouteEdges,
  useRouteNodes,
} from "@/hooks/use-editor-data"
import { useFloors } from "@/hooks/use-floors"
import { usePersistedState } from "@/lib/use-persisted-state"
import { type DrawTool, EditorMap, type FocusRequest } from "@/map/editor-map"
import {
  dispatchCommand,
  redoCommand,
  undoCommand,
  useCommandHistory,
} from "@/store/command-store"
import {
  CreateConstraintCommand,
  CreateFeatureCommand,
  CreateLayerCommand,
  CreateRouteEdgeCommand,
  CreateRouteNodeCommand,
  DeleteConstraintCommand,
  DeleteFeatureCommand,
  DeleteLayerCommand,
  DeleteRouteEdgeCommand,
  DeleteRouteNodeCommand,
  MoveRouteNodeCommand,
  PutConstraintCommand,
  PutFeatureCommand,
  PutLayerCommand,
  PutRouteEdgeCommand,
  PutRouteNodeCommand,
  ReorderLayersCommand,
  UpdateLayerCommand,
} from "@/store/editor-commands"

interface EditorWorkspaceProps {
  projectId: string
  floorId: string
  asset: Asset
}

const RIGHT_PANEL_WIDTH_KEY = "planar-map-marker:right-panel-width"
const RIGHT_PANEL_BOTTOM_KEY = "planar-map-marker:right-panel-bottom-height"

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function EditorWorkspace({
  projectId,
  floorId,
  asset,
}: EditorWorkspaceProps) {
  const constraints = useConstraints(projectId) ?? []
  const layers = useLayers(floorId) ?? []
  const features = useFeatures(layers.map((layer) => layer.id)) ?? []
  const floors = useFloors(projectId) ?? []
  const projectLayers = useProjectLayers(projectId) ?? []
  const pointFeatures = useProjectPointFeatures(projectId) ?? []
  const routeLayers = useMemo(
    () => layers.filter((layer) => layer.kind === "route"),
    [layers],
  )
  const routeNodes = useRouteNodes(routeLayers.map((layer) => layer.id)) ?? []
  const routeEdges = useRouteEdges(routeLayers.map((layer) => layer.id)) ?? []
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(
    null,
  )
  const [selectedRouteNodeId, setSelectedRouteNodeId] = useState<string | null>(
    null,
  )
  const [selectedRouteEdgeId, setSelectedRouteEdgeId] = useState<string | null>(
    null,
  )
  const [drawTool, setDrawTool] = useState<DrawTool>(null)
  const [layerDialogOpen, setLayerDialogOpen] = useState(false)
  const [constraintDialog, setConstraintDialog] = useState<
    { mode: "create" } | { mode: "edit"; constraint: Constraint } | null
  >(null)
  const [pending, setPending] = useState(false)
  const [imageUrl, setImageUrl] = useState<string>()
  const [view, setView] = useState<"layers" | "table">("layers")
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const [rightWidth, setRightWidth] = usePersistedState(
    RIGHT_PANEL_WIDTH_KEY,
    288,
  )
  const [bottomHeight, setBottomHeight] = usePersistedState(
    RIGHT_PANEL_BOTTOM_KEY,
    220,
  )
  const [pendingEdge, setPendingEdge] = useState<{
    source: EndpointRef | null
    target: EndpointRef | null
  }>({ source: null, target: null })
  const [pickerSlot, setPickerSlot] = useState<"source" | "target" | null>(null)
  const history = useCommandHistory(projectId)

  useEffect(() => {
    const url = URL.createObjectURL(asset.blob)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [asset.blob])

  useEffect(() => {
    setSelectedLayerId((current) =>
      layers.some((layer) => layer.id === current)
        ? current
        : (layers[0]?.id ?? null),
    )
  }, [layers])

  // Switching the active layer (including a floor change) invalidates an
  // in-progress edge: its source node may belong to the previous layer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally triggers only on layer change.
  useEffect(() => {
    setPendingEdge({ source: null, target: null })
    if (drawTool === "route-node" || drawTool === "route-edge") {
      setDrawTool(null)
    }
  }, [selectedLayerId])

  useEffect(() => {
    setSelectedFeatureId((current) =>
      features.some((feature) => feature.id === current) ? current : null,
    )
  }, [features])

  useEffect(() => {
    setSelectedRouteNodeId((current) =>
      routeNodes.some((node) => node.id === current) ? current : null,
    )
  }, [routeNodes])

  useEffect(() => {
    setSelectedRouteEdgeId((current) =>
      routeEdges.some((edge) => edge.id === current) ? current : null,
    )
  }, [routeEdges])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return
      }
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "z"
      ) {
        return
      }
      event.preventDefault()
      if (event.shiftKey) void redoCommand(projectId)
      else void undoCommand(projectId)
    }
    addEventListener("keydown", keydown)
    return () => removeEventListener("keydown", keydown)
  }, [projectId])

  const selectedLayer =
    layers.find((layer) => layer.id === selectedLayerId) ?? null
  const selectedFeature =
    features.find((feature) => feature.id === selectedFeatureId) ?? null
  const selectedRouteNode =
    routeNodes.find((node) => node.id === selectedRouteNodeId) ?? null
  const selectedRouteEdge =
    routeEdges.find((edge) => edge.id === selectedRouteEdgeId) ?? null
  const selectedConstraint = useMemo(() => {
    if (!selectedLayer || selectedLayer.kind === "route") return null
    return (
      constraints.find(
        (constraint) => constraint.id === selectedLayer.constraintId,
      ) ?? null
    )
  }, [constraints, selectedLayer])
  const selectedNodeConstraint = useMemo(() => {
    if (selectedLayer?.kind !== "route") return null
    return (
      constraints.find(
        (constraint) => constraint.id === selectedLayer.nodeConstraintId,
      ) ?? null
    )
  }, [constraints, selectedLayer])
  const selectedEdgeConstraint = useMemo(() => {
    if (selectedLayer?.kind !== "route") return null
    return (
      constraints.find(
        (constraint) => constraint.id === selectedLayer.edgeConstraintId,
      ) ?? null
    )
  }, [constraints, selectedLayer])
  const routeContext = useMemo(
    () => buildEndpointContext(routeNodes, pointFeatures),
    [routeNodes, pointFeatures],
  )

  const layerFeatures = useMemo(
    () =>
      selectedLayer
        ? features.filter((feature) => feature.layerId === selectedLayer.id)
        : [],
    [features, selectedLayer],
  )

  async function run(command: Parameters<typeof dispatchCommand>[1]) {
    setPending(true)
    try {
      await dispatchCommand(projectId, command)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "操作失败")
      throw error
    } finally {
      setPending(false)
    }
  }

  async function saveConstraint(draft: ConstraintDraft) {
    if (constraintDialog?.mode === "edit") {
      await run(
        new PutConstraintCommand({
          ...constraintDialog.constraint,
          ...draft,
          updatedAt: Date.now(),
        }),
      )
    } else {
      await run(new CreateConstraintCommand({ projectId, ...draft }))
    }
    setConstraintDialog(null)
    toast.success("数据约束已保存")
  }

  async function drawComplete(layerId: string, geometry: Geometry) {
    const layer = layers.find((candidate) => candidate.id === layerId)
    if (!layer || layer.kind === "route") return
    const constraint =
      constraints.find((candidate) => candidate.id === layer.constraintId) ??
      null
    await run(
      new CreateFeatureCommand(
        layerId,
        geometry,
        initialProperties(constraint),
      ),
    )
    setDrawTool(null)
    toast.success("标注已创建")
  }

  function chooseTool(tool: Exclude<DrawTool, null>) {
    if (!selectedLayer || selectedLayer.locked) {
      toast.error("请先选择一个未锁定的图层")
      return
    }
    if (tool === "route-node" || tool === "route-edge") {
      if (selectedLayer.kind !== "route") {
        toast.error("请先选择路线图层")
        return
      }
      setDrawTool((current) => (current === tool ? null : tool))
      return
    }
    if (selectedLayer.kind !== tool) {
      toast.error(tool === "point" ? "请选择点图层" : "请选择多边形图层")
      return
    }
    setDrawTool((current) => (current === tool ? null : tool))
  }

  /** Map click: selecting a feature also switches the active layer to its owner. */
  function selectFeature(feature: Feature | null) {
    setSelectedFeatureId(feature?.id ?? null)
    setSelectedRouteNodeId(null)
    setSelectedRouteEdgeId(null)
    if (feature) {
      setSelectedLayerId(feature.layerId)
      setDrawTool(null)
    }
  }

  function selectRouteNode(node: RouteNode | null) {
    setSelectedRouteNodeId(node?.id ?? null)
    setSelectedRouteEdgeId(null)
    setSelectedFeatureId(null)
    if (node) {
      setSelectedLayerId(node.layerId)
      setDrawTool(null)
    }
  }

  function selectRouteEdge(edge: RouteEdge | null) {
    setSelectedRouteEdgeId(edge?.id ?? null)
    setSelectedRouteNodeId(null)
    setSelectedFeatureId(null)
    if (edge) {
      setSelectedLayerId(edge.layerId)
      setDrawTool(null)
    }
  }

  /** Table row click: select, switch layer, and fly the map to the feature. */
  function selectAndFocus(feature: Feature) {
    setSelectedLayerId(feature.layerId)
    setSelectedFeatureId(feature.id)
    setSelectedRouteNodeId(null)
    setSelectedRouteEdgeId(null)
    setDrawTool(null)
    setView("layers")
    setFocusRequest({ featureId: feature.id, token: Date.now() })
  }

  /**
   * Cell-level save from the data table: only the edited field is written, so
   * required fields can be filled in one at a time. Whole-record validation is
   * the job of the properties panel and the export pre-flight check.
   */
  async function updateFeatureField(
    feature: Feature,
    key: string,
    value: unknown,
  ): Promise<boolean> {
    try {
      await run(
        new PutFeatureCommand({
          ...feature,
          properties: { ...feature.properties, [key]: value },
          updatedAt: Date.now(),
        }),
      )
      return true
    } catch {
      return false
    }
  }

  async function deleteFeature(feature: Feature) {
    try {
      await run(new DeleteFeatureCommand(feature.id))
      if (selectedFeatureId === feature.id) setSelectedFeatureId(null)
    } catch {
      // run already reports the error.
    }
  }

  async function placeRouteNode(coord: Pixel) {
    if (selectedLayer?.kind !== "route") {
      toast.error("请先选择路线图层")
      return
    }
    const constraint =
      constraints.find(
        (candidate) => candidate.id === selectedLayer.nodeConstraintId,
      ) ?? null
    await run(
      new CreateRouteNodeCommand(
        selectedLayer.id,
        coord,
        initialProperties(constraint),
      ),
    )
    toast.success("节点已创建")
  }

  function pickEndpoint(ref: EndpointRef | null) {
    if (selectedLayer?.kind !== "route") {
      toast.error("请先选择路线图层")
      return
    }
    if (!pendingEdge.source) {
      if (!ref) {
        toast.error("未吸附到端点，请点击节点或点要素，或从列表选择")
        return
      }
      setPendingEdge({ source: ref, target: null })
      toast("起点已选择，请再选择终点")
      return
    }
    if (!pendingEdge.target) {
      if (!ref) {
        toast.error("未吸附到端点，请点击节点或点要素，或从列表选择")
        return
      }
      setPendingEdge((current) => ({ ...current, target: ref }))
      toast.success("两端点已就绪，点击「创建边」完成")
    }
  }

  async function createEdge(direction: EdgeDirection, passable: boolean) {
    if (selectedLayer?.kind !== "route") return
    const { source, target } = pendingEdge
    if (!source || !target) return
    try {
      await run(
        new CreateRouteEdgeCommand({
          layerId: selectedLayer.id,
          source,
          target,
          direction,
          passable,
        }),
      )
      setPendingEdge({ source: null, target: null })
      setDrawTool(null)
      toast.success("边已创建")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建边失败")
    }
  }

  function cancelEdgeConnect() {
    setPendingEdge({ source: null, target: null })
    setDrawTool(null)
  }

  function pickEndpointFromDialog(ref: EndpointRef) {
    pickEndpoint(ref)
    setPickerSlot(null)
  }

  function moveRouteNode(nodeId: string, coord: Pixel) {
    return run(new MoveRouteNodeCommand(nodeId, coord))
  }

  async function updateRouteNodeField(
    node: RouteNode,
    key: string,
    value: unknown,
  ): Promise<boolean> {
    try {
      if (key === "coord") {
        await run(new MoveRouteNodeCommand(node.id, value as Pixel))
      } else {
        await run(
          new PutRouteNodeCommand({
            ...node,
            properties: { ...node.properties, [key]: value },
            updatedAt: Date.now(),
          }),
        )
      }
      return true
    } catch {
      return false
    }
  }

  async function updateRouteEdgeField(
    edge: RouteEdge,
    key: string,
    value: unknown,
  ): Promise<boolean> {
    try {
      const next: RouteEdge = { ...edge, updatedAt: Date.now() }
      if (key === "direction") next.direction = value as EdgeDirection
      else if (key === "passable") next.passable = value === true
      else next.properties = { ...edge.properties, [key]: value }
      await run(new PutRouteEdgeCommand(next))
      return true
    } catch {
      return false
    }
  }

  async function deleteRouteNode(node: RouteNode) {
    try {
      await run(new DeleteRouteNodeCommand(node.id))
      if (selectedRouteNodeId === node.id) setSelectedRouteNodeId(null)
    } catch {
      // run already reports the error.
    }
  }

  async function deleteRouteEdge(edge: RouteEdge) {
    try {
      await run(new DeleteRouteEdgeCommand(edge.id))
      if (selectedRouteEdgeId === edge.id) setSelectedRouteEdgeId(null)
    } catch {
      // run already reports the error.
    }
  }

  if (!imageUrl) return <div className="h-full bg-muted/50" />

  return (
    <div className="flex h-full min-w-0">
      <div className="relative min-w-0 flex-1">
        <EditorMap
          imageUrl={imageUrl}
          size={asset.size}
          floorId={floorId}
          layers={layers}
          features={features}
          routeNodes={routeNodes}
          routeEdges={routeEdges}
          pointFeatures={pointFeatures}
          selectedFeatureId={selectedFeatureId}
          selectedRouteNodeId={selectedRouteNodeId}
          selectedRouteEdgeId={selectedRouteEdgeId}
          drawTool={drawTool}
          drawLayerId={selectedLayerId}
          focus={focusRequest}
          onDrawComplete={drawComplete}
          onSelectFeature={selectFeature}
          onGeometryChange={(feature, geometry) =>
            run(
              new PutFeatureCommand({
                ...feature,
                geometry,
                updatedAt: Date.now(),
              }),
            )
          }
          onPlaceRouteNode={placeRouteNode}
          onSelectRouteNode={selectRouteNode}
          onSelectRouteEdge={selectRouteEdge}
          onMoveRouteNode={moveRouteNode}
          onPickEndpoint={pickEndpoint}
        />
        <div className="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 bg-background p-1 shadow-md ring-1 ring-border">
          <ToolButton
            label="选择"
            active={drawTool === null}
            icon={<MousePointer2 />}
            onClick={() => setDrawTool(null)}
          />
          <ToolButton
            label="添加点"
            active={drawTool === "point"}
            icon={<MapPin />}
            onClick={() => chooseTool("point")}
          />
          <ToolButton
            label="绘制多边形"
            active={drawTool === "polygon"}
            icon={<Pentagon />}
            onClick={() => chooseTool("polygon")}
          />
          <ToolButton
            label="放置节点"
            active={drawTool === "route-node"}
            icon={<CircleDot />}
            onClick={() => chooseTool("route-node")}
          />
          <ToolButton
            label="连接边"
            active={drawTool === "route-edge"}
            icon={<Link2 />}
            onClick={() => chooseTool("route-edge")}
          />
          <span className="mx-1 h-6 w-px bg-border" />
          <ToolButton
            label={history.undoLabel ? `撤销：${history.undoLabel}` : "撤销"}
            disabled={!history.canUndo || history.busy}
            icon={<Undo2 />}
            onClick={() => undoCommand(projectId)}
          />
          <ToolButton
            label={history.redoLabel ? `重做：${history.redoLabel}` : "重做"}
            disabled={!history.canRedo || history.busy}
            icon={<Redo2 />}
            onClick={() => redoCommand(projectId)}
          />
          <span className="mx-1 h-6 w-px bg-border" />
          <ConstraintMenu
            constraints={constraints}
            onCreate={() => setConstraintDialog({ mode: "create" })}
            onEdit={(constraint) =>
              setConstraintDialog({ mode: "edit", constraint })
            }
            onDelete={(constraint) =>
              run(new DeleteConstraintCommand(constraint.id)).then(() =>
                toast.success("数据约束已删除"),
              )
            }
          />
        </div>
        {drawTool === "route-edge" && (
          <EdgeConnectPalette
            source={pendingEdge.source}
            target={pendingEdge.target}
            context={routeContext}
            onPickSlot={setPickerSlot}
            onCreate={createEdge}
            onCancel={cancelEdgeConnect}
          />
        )}
      </div>

      <ResizeHandle
        axis="x"
        onDelta={(delta) =>
          // The handle sits at the panel's left edge; dragging it right shrinks
          // the panel, so the width moves opposite to the pointer delta.
          setRightWidth((current) => clamp(current - delta, 260, 640))
        }
      />

      <div
        style={{ width: rightWidth }}
        className="flex shrink-0 flex-col border-l bg-background"
      >
        <Tabs
          value={view}
          onValueChange={(value) => {
            if (value === "layers" || value === "table") setView(value)
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-2 mt-2 grid shrink-0 grid-cols-2">
            <TabsTrigger value="layers">图层</TabsTrigger>
            <TabsTrigger value="table">数据表</TabsTrigger>
          </TabsList>
          <TabsContent value="layers" className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <LayerSidebar
                layers={layers}
                selectedId={selectedLayerId}
                onSelect={(id) => {
                  setSelectedLayerId(id)
                  setSelectedFeatureId(null)
                  setSelectedRouteNodeId(null)
                  setSelectedRouteEdgeId(null)
                  setPendingEdge({ source: null, target: null })
                  setDrawTool(null)
                }}
                onCreate={() => setLayerDialogOpen(true)}
                onToggleVisible={(layer) =>
                  run(
                    new UpdateLayerCommand(layer.id, {
                      visible: !layer.visible,
                    }),
                  )
                }
                onToggleLocked={(layer) =>
                  run(
                    new UpdateLayerCommand(layer.id, { locked: !layer.locked }),
                  )
                }
                onDelete={(layer) => run(new DeleteLayerCommand(layer.id))}
                onReorder={(ids) => run(new ReorderLayersCommand(floorId, ids))}
              />
            </div>
            <ResizeHandle
              axis="y"
              onDelta={(delta) =>
                setBottomHeight((current) => clamp(current - delta, 120, 480))
              }
            />
            <ScrollArea
              style={{ height: bottomHeight }}
              className="shrink-0 border-t"
            >
              {selectedRouteNode ? (
                <RouteNodeProperties
                  key={selectedRouteNode.id}
                  node={selectedRouteNode}
                  constraint={selectedNodeConstraint}
                  onSave={(node) => run(new PutRouteNodeCommand(node))}
                  onDelete={() =>
                    run(new DeleteRouteNodeCommand(selectedRouteNode.id)).then(
                      () => setSelectedRouteNodeId(null),
                    )
                  }
                />
              ) : selectedRouteEdge ? (
                <RouteEdgeProperties
                  key={selectedRouteEdge.id}
                  edge={selectedRouteEdge}
                  constraint={selectedEdgeConstraint}
                  context={routeContext}
                  onSave={(edge) => run(new PutRouteEdgeCommand(edge))}
                  onDelete={() =>
                    run(new DeleteRouteEdgeCommand(selectedRouteEdge.id)).then(
                      () => setSelectedRouteEdgeId(null),
                    )
                  }
                />
              ) : selectedFeature ? (
                <FeatureProperties
                  key={selectedFeature.id}
                  feature={selectedFeature}
                  constraint={selectedConstraint}
                  onSave={(feature) => run(new PutFeatureCommand(feature))}
                  onDelete={() =>
                    run(new DeleteFeatureCommand(selectedFeature.id)).then(() =>
                      setSelectedFeatureId(null),
                    )
                  }
                />
              ) : selectedLayer ? (
                <LayerProperties
                  key={selectedLayer.id}
                  layer={selectedLayer}
                  constraints={constraints}
                  onChange={(layer) => run(new PutLayerCommand(layer))}
                  onDelete={() => run(new DeleteLayerCommand(selectedLayer.id))}
                />
              ) : null}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="table" className="min-h-0 flex-1">
            {selectedLayer ? (
              selectedLayer.kind === "route" ? (
                <RouteTable
                  nodes={routeNodes.filter(
                    (node) => node.layerId === selectedLayer.id,
                  )}
                  edges={routeEdges.filter(
                    (edge) => edge.layerId === selectedLayer.id,
                  )}
                  nodeConstraint={selectedNodeConstraint}
                  edgeConstraint={selectedEdgeConstraint}
                  context={routeContext}
                  selectedNodeId={selectedRouteNodeId}
                  selectedEdgeId={selectedRouteEdgeId}
                  onSelectNode={selectRouteNode}
                  onSelectEdge={selectRouteEdge}
                  onUpdateNode={updateRouteNodeField}
                  onUpdateEdge={updateRouteEdgeField}
                  onDeleteNode={deleteRouteNode}
                  onDeleteEdge={deleteRouteEdge}
                />
              ) : (
                <FeatureTable
                  features={layerFeatures}
                  layer={selectedLayer}
                  constraint={selectedConstraint}
                  selectedFeatureId={selectedFeatureId}
                  onSelect={selectAndFocus}
                  onUpdate={updateFeatureField}
                  onDelete={deleteFeature}
                />
              )
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                请先选择一个图层
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <LayerDialog
        open={layerDialogOpen}
        pending={pending}
        onOpenChange={setLayerDialogOpen}
        onSubmit={async (name: string, kind: LayerKind) => {
          await run(new CreateLayerCommand(floorId, name, kind))
          setLayerDialogOpen(false)
          toast.success("图层已创建")
        }}
      />
      <ConstraintDialog
        key={
          constraintDialog?.mode === "edit"
            ? constraintDialog.constraint.id
            : "new"
        }
        open={constraintDialog !== null}
        constraint={
          constraintDialog?.mode === "edit" ? constraintDialog.constraint : null
        }
        pending={pending}
        onOpenChange={(open) => {
          if (!open) setConstraintDialog(null)
        }}
        onSubmit={saveConstraint}
      />
      <EndpointPickerDialog
        open={pickerSlot !== null}
        title={pickerSlot === "source" ? "选择起点" : "选择终点"}
        nodes={routeNodes.filter((node) => node.layerId === selectedLayer?.id)}
        features={pointFeatures}
        floors={floors}
        layers={projectLayers}
        onPick={pickEndpointFromDialog}
        onOpenChange={(open) => {
          if (!open) setPickerSlot(null)
        }}
      />
    </div>
  )
}

function ToolButton({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick: () => void | Promise<void>
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={active ? "secondary" : "ghost"}
            size="icon-sm"
            disabled={disabled}
            aria-label={label}
            onClick={onClick}
          >
            {icon}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
