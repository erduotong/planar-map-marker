import { create } from "zustand"

/**
 * A command returns the command that reverses it. Executing that inverse in
 * turn returns a fresh redo command, so mutable state is captured at execution
 * time rather than when the UI constructs the original command.
 */
export interface Command {
  readonly label: string
  execute(): Promise<Command>
}

interface HistoryEntry {
  label: string
  command: Command
}

interface ScopeHistory {
  undo: HistoryEntry[]
  redo: HistoryEntry[]
}

interface CommandState {
  histories: Record<string, ScopeHistory | undefined>
  busyScopes: Record<string, boolean | undefined>
}

const HISTORY_LIMIT = 100
const EMPTY_HISTORY: HistoryEntry[] = []

const useCommandStore = create<CommandState>(() => ({
  histories: {},
  busyScopes: {},
}))

function historyFor(state: CommandState, scope: string): ScopeHistory {
  return state.histories[scope] ?? { undo: [], redo: [] }
}

function setBusy(scope: string, busy: boolean) {
  useCommandStore.setState((state) => ({
    busyScopes: { ...state.busyScopes, [scope]: busy },
  }))
}

/** Executes a user action and records its inverse on the scope's undo stack. */
export async function dispatchCommand(scope: string, command: Command) {
  if (useCommandStore.getState().busyScopes[scope]) {
    throw new Error(`Command scope is already busy: ${scope}`)
  }

  setBusy(scope, true)
  try {
    const inverse = await command.execute()
    useCommandStore.setState((state) => {
      const history = historyFor(state, scope)
      return {
        histories: {
          ...state.histories,
          [scope]: {
            undo: [
              ...history.undo,
              { label: command.label, command: inverse },
            ].slice(-HISTORY_LIMIT),
            redo: [],
          },
        },
      }
    })
  } finally {
    setBusy(scope, false)
  }
}

export async function undoCommand(scope: string) {
  if (useCommandStore.getState().busyScopes[scope]) return
  const history = historyFor(useCommandStore.getState(), scope)
  const entry = history.undo.at(-1)
  if (!entry) return

  setBusy(scope, true)
  try {
    const redo = await entry.command.execute()
    useCommandStore.setState((state) => {
      const current = historyFor(state, scope)
      return {
        histories: {
          ...state.histories,
          [scope]: {
            undo: current.undo.slice(0, -1),
            redo: [
              ...current.redo,
              { label: entry.label, command: redo },
            ].slice(-HISTORY_LIMIT),
          },
        },
      }
    })
  } finally {
    setBusy(scope, false)
  }
}

export async function redoCommand(scope: string) {
  if (useCommandStore.getState().busyScopes[scope]) return
  const history = historyFor(useCommandStore.getState(), scope)
  const entry = history.redo.at(-1)
  if (!entry) return

  setBusy(scope, true)
  try {
    const inverse = await entry.command.execute()
    useCommandStore.setState((state) => {
      const current = historyFor(state, scope)
      return {
        histories: {
          ...state.histories,
          [scope]: {
            undo: [
              ...current.undo,
              { label: entry.label, command: inverse },
            ].slice(-HISTORY_LIMIT),
            redo: current.redo.slice(0, -1),
          },
        },
      }
    })
  } finally {
    setBusy(scope, false)
  }
}

export function clearCommandHistory(scope: string) {
  useCommandStore.setState((state) => {
    const histories = { ...state.histories }
    delete histories[scope]
    return { histories }
  })
}

export function useCommandHistory(scope: string) {
  const undo = useCommandStore(
    (state) => state.histories[scope]?.undo ?? EMPTY_HISTORY,
  )
  const redo = useCommandStore(
    (state) => state.histories[scope]?.redo ?? EMPTY_HISTORY,
  )
  const busy = useCommandStore((state) => state.busyScopes[scope] ?? false)

  return {
    canUndo: undo.length > 0,
    canRedo: redo.length > 0,
    undoLabel: undo.at(-1)?.label,
    redoLabel: redo.at(-1)?.label,
    busy,
  }
}
