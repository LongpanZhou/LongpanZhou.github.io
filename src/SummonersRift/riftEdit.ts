// Shared state for the rift layout editor (it opens by itself on localhost).

// True while a model is being dragged. The camera controller reads it so it does not
// re-enable the orbit controls in the middle of a drag.
export const editState = { dragging: false }

// Where an item stands and which way it faces. yaw is the group's rotation about the
// vertical axis, in radians.
export interface Pose {
  x: number
  z: number
  yaw: number
  scale?: number // size multiplier, 1 when missing
  y?: number // height above the ground, in world units, 0 when missing
  pitch?: number // tilt about the model's own sideways axis in radians, positive is nose down, 0 when missing
}

// A route drawn on the map: points as [x, z] in world units. It is walked at the height of the entity.
export type PathPoints = [number, number][]
const PATHS_KEY = 'riftPaths'

export function loadPaths(fallback: Record<string, PathPoints> = {}): Record<string, PathPoints> {
  try {
    const raw = window.localStorage.getItem(PATHS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, PathPoints>) : JSON.parse(JSON.stringify(fallback))
  } catch {
    return JSON.parse(JSON.stringify(fallback))
  }
}

export function savePaths(paths: Record<string, PathPoints>) {
  try {
    window.localStorage.setItem(PATHS_KEY, JSON.stringify(paths))
  } catch {
    // Storage can be blocked. The editor still works for this session.
  }
}

const KEY = 'riftLayoutOverrides'

// Positions the user has dragged. They persist in this browser and apply with the editor closed.
export function loadOverrides(fallback: Record<string, Pose> = {}): Record<string, Pose> {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, Pose>) : copy(fallback)
  } catch {
    return copy(fallback)
  }
}

export function saveOverrides(overrides: Record<string, Pose>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(overrides))
  } catch {
    // Storage can be blocked. The editor still works for this session.
  }
}

const TYPE_KEY = 'riftTypeScales'

// Size multipliers per type of entity (all towers, all turrets, the nexus, each monster).
// Resizing one entity resizes every entity of its type.
export function loadTypeScales(fallback: Record<string, number> = {}): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(TYPE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : copy(fallback)
  } catch {
    return copy(fallback)
  }
}

export function saveTypeScales(scales: Record<string, number>) {
  try {
    window.localStorage.setItem(TYPE_KEY, JSON.stringify(scales))
  } catch {
    // Storage can be blocked. The editor still works for this session.
  }
}

// The editor's own UI lives in the page, outside the 3D canvas. These tell it whether to exist.
export const IS_LOCAL =
  typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
// The editor is on for everyone, not only on localhost. Visitors get the add-models part of it: the
// export of the layout (for the developer to paste into the default) stays local.
export const EDITOR_ENABLED = true
export const IS_VISITOR = !IS_LOCAL

// A model in the editor's inventory
export interface InventoryTile {
  key: string
  label: string // the file name, exactly as it is on disk (no extension)
  group: string
  url: string
  tint?: string
  team?: 'order' | 'chaos' // Order is the blue side, Chaos the red side; only when the model is for one
  thumb?: string // a ready-made picture of it (otherwise one is drawn from the model)
  size?: number // the model's size in bytes, when known
}

export interface EditorSnapshot {
  panelOpen: boolean // the editor panel is expanded (otherwise it is the small pill)
  boxes: boolean // the floating boxes over the models are shown
  selected: string | null // name of the selected entity
  readout: string | null // its position, rotation, size and height
  exported: string // the layout as JSON, ready to copy
  count: number // number of entities changed
  deleted: number // built-in entities currently deleted
  inventory: InventoryTile[] // everything that can be put on the map
  download: { name: string; progress: number } | null // a model being downloaded for the map (progress -1: it failed)
}

let snapshot: EditorSnapshot = { panelOpen: false, boxes: false, selected: null, readout: null, exported: '{}', count: 0, deleted: 0, inventory: [], download: null }
const listeners = new Set<() => void>()

// The canvas (RiftModels) owns the layout state and publishes it here. The page UI reads it
// and calls back through `actions`, which RiftModels fills in.
export const editorStore = {
  getSnapshot: () => snapshot,
  setSnapshot(next: EditorSnapshot) {
    snapshot = next
    listeners.forEach((listener) => listener())
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  actions: {
    toggle: () => {},
    toggleBoxes: () => {},
    clear: () => {},
    restore: () => {},
    // Adds an inventory entry at the ground point under a screen position
    addAt: (_key: string, _clientX: number, _clientY: number) => {},
    // Shows where a dragged model would land. Null clears it.
    dropHover: (_clientX: number | null, _clientY?: number) => {},
  },
}

const NAMES_KEY = 'riftNames'

// Names the user gave to entities, by entity id.
export function loadNames(fallback: Record<string, string> = {}): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(NAMES_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : copy(fallback)
  } catch {
    return copy(fallback)
  }
}

export function saveNames(names: Record<string, string>) {
  try {
    window.localStorage.setItem(NAMES_KEY, JSON.stringify(names))
  } catch {
    // Storage can be blocked. Renaming still works for this session.
  }
}

const OPEN_KEY = 'riftToolbarsOpen'

// Ids of the entities whose floating toolbar the user has opened. Every other box starts folded.
export function loadOpenToolbars(): string[] {
  try {
    const raw = window.localStorage.getItem(OPEN_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveOpenToolbars(ids: string[]) {
  try {
    window.localStorage.setItem(OPEN_KEY, JSON.stringify(ids))
  } catch {
    // Storage can be blocked. Opening still works for this session.
  }
}

// Entities added from the inventory. `key` says what kind (see INVENTORY in RiftModels); x, z and
// yaw are where it was dropped. Moving it later is saved as an ordinary override.
export interface AddedEntry {
  id: string
  key: string
  x: number
  z: number
  yaw: number
}

const ADDED_KEY = 'riftAdded'
const DELETED_KEY = 'riftDeleted'

export function loadAdded(fallback: AddedEntry[] = []): AddedEntry[] {
  try {
    const raw = window.localStorage.getItem(ADDED_KEY)
    return raw ? (JSON.parse(raw) as AddedEntry[]) : copy(fallback)
  } catch {
    return copy(fallback)
  }
}

export function saveAdded(added: AddedEntry[]) {
  try {
    window.localStorage.setItem(ADDED_KEY, JSON.stringify(added))
  } catch {
    // Storage can be blocked. Adding still works for this session.
  }
}

// Ids of the built-in entities the user deleted.
export function loadDeleted(fallback: string[] = []): string[] {
  try {
    const raw = window.localStorage.getItem(DELETED_KEY)
    return raw ? (JSON.parse(raw) as string[]) : copy(fallback)
  } catch {
    return copy(fallback)
  }
}

export function saveDeleted(ids: string[]) {
  try {
    window.localStorage.setItem(DELETED_KEY, JSON.stringify(ids))
  } catch {
    // Storage can be blocked. Deleting still works for this session.
  }
}

const LOCKED_KEY = 'riftLocked'

// Ids of the entities that are locked: they cannot be moved, turned, raised, reset or deleted.
export function loadLocked(fallback: string[] = []): string[] {
  try {
    const raw = window.localStorage.getItem(LOCKED_KEY)
    return raw ? (JSON.parse(raw) as string[]) : copy(fallback)
  } catch {
    return copy(fallback)
  }
}

export function saveLocked(ids: string[]) {
  try {
    window.localStorage.setItem(LOCKED_KEY, JSON.stringify(ids))
  } catch {
    // Storage can be blocked. Locking still works for this session.
  }
}

// A deep copy, so the default layout is never changed by editing the loaded one
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/**
 * A visitor's changes to the layout are saved in their browser and win over the default. So when the default
 * layout is updated, a visitor who saved before would keep the old one for good. Each saved layout is stamped
 * with the version of the default it started from, and when the default has changed since, the visitor's saved
 * layout (positions, additions, deletions, names, sizes, routes) is dropped and they get the new default.
 * The developer's own browser (localhost) is left alone: those edits are theirs.
 */
export function dropStaleLayout(version: string) {
  if (IS_LOCAL) return
  try {
    const seen = window.localStorage.getItem('riftLayoutVersion')
    if (seen !== null && seen !== version) {
      for (const key of [KEY, TYPE_KEY, NAMES_KEY, ADDED_KEY, DELETED_KEY, LOCKED_KEY, PATHS_KEY]) window.localStorage.removeItem(key)
    }
    window.localStorage.setItem('riftLayoutVersion', version)
  } catch {
    // Storage can be blocked: nothing is saved, so nothing can be stale
  }
}
