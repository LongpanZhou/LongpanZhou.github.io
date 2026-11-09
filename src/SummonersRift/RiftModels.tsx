import { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Html, Line, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneRig } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { BLUE, GOLD, GROUND_Y, LANES, NEXUS_AT, NEXUS_TURRET_SPOTS, RED, TOWER_SPOTS, place } from './riftLayout'
import type { Fraction, Team } from './riftLayout'
import { describeLocalModel, downloadModel, fetchLocalModels, isBundled } from './localModels'
import { clipControls, hasStates, isEpicModel, isRevealed, joinGroup, kindsOf, leaveGroup, movedParts, onClipsChange, onRevealed, planClips, registerClips, sameClip, showOfKind, showParts, timeScaleFor, unregisterClips } from './monsterClips'
import type { ClipControl, GroupMember } from './monsterClips'
import { DEFAULT_ADDED, DEFAULT_DELETED, DEFAULT_LOCKED, DEFAULT_NAMES, DEFAULT_OVERRIDES, DEFAULT_PATHS, DEFAULT_TYPE_SCALES } from './riftLayoutDefault'
import { BAKED_POSES } from './riftPoses'
import { EDITOR_ENABLED, IS_LOCAL, editState, editorStore, loadAdded, loadOpenToolbars, loadDeleted, loadLocked, loadNames, loadOverrides, loadPaths, loadTypeScales, saveAdded, saveOpenToolbars, saveDeleted, saveLocked, saveNames, saveOverrides, savePaths, saveTypeScales } from './riftEdit'
import type { AddedEntry, InventoryTile, PathPoints, Pose } from './riftEdit'
import './RiftLock.css'

// Turrets, nexus and monsters come from League of Legends game assets in public/models/rift.
// Riot owns those. They are for local testing only: .gitignore keeps them out of commits, and
// they must not go into a deployed build of the public site.
const M = '/models/rift/'
const TURRET = `${M}turrets.glb`
const NEXUS_MODEL = `${M}nexus.glb`

const TEAM_COLOR: Record<Team, string> = { blue: BLUE, red: RED }

// Target heights in world units. Every model is measured and scaled to its height, because
// the League exports come at a different scale from the rift layout.
const TOWER_HEIGHT = 7
const TURRET_HEIGHT = 5
const NEXUS_HEIGHT = 8

// The turret model's front is not along +Z like the monsters', so it is turned by this much
// on top of the facing rule.
const TURRET_YAW = -Math.PI / 2

// Layout editor. It opens by itself when the site is entered on localhost. Drag a model to move
// it, use the toolbars over each entity to turn, resize and lift it, and copy the exported layout.
// It starts expanded, on the right side, when the site is entered on localhost (minimize it to the
// small box on the right). It never shows on the public site.
const BOXES_KEY = 'riftBoxes'
const START_EDITING = IS_LOCAL

interface Monster {
  name: string
  file: string // GLB in public/models/rift
  height: number // world units
  idle: string // animation clip looped while the monster is up
  typeId?: string // entities that share a size; defaults to the name
}

const BLUE_SENTINEL: Monster = { name: 'Blue sentinel', file: 'blue_sentinel.glb', height: 2.4, idle: 'Idle1_Base' }
const RED_BRAMBLEBACK: Monster = { name: 'Red brambleback', file: 'red_brambleback.glb', height: 2, idle: 'SRU_Red_Idle1.anm' }
const GROMP: Monster = { name: 'Gromp', file: 'gromp.glb', height: 1.8, idle: 'SRU_Gromp_idle1.anm' }
const KRUG: Monster = { name: 'Krug', file: 'krug.glb', height: 1.6, idle: 'Krug_Idle_Normal.anm' }
const MURK_WOLF: Monster = { name: 'Murk wolf', file: 'murk_wolf.glb', height: 1.3, idle: 'SRU_Murkwolf_idle1.anm' }
const SCUTTLE_CRAB: Monster = { name: 'Scuttle crab', file: 'scuttle_crab.glb', height: 1.3, idle: 'Idle1' }
const VOID_GRUBS: Monster = { name: 'Void grubs', file: 'voidgrubs.glb', height: 1.6, idle: 'IdleVar1' }

// Elemental dragons. They all share one size key, so resizing any dragon resizes the whole
// family, and the active one is chosen again on every page load.
const DRAGON_FIRE: Monster = { name: 'Dragon (Fire)', file: 'dragon_fire.glb', height: 2.4, idle: 'Idle1_Base', typeId: 'Dragon' }
const DRAGON_AIR: Monster = { name: 'Dragon (Air)', file: 'dragon_air.glb', height: 2.4, idle: 'Idle1_Base', typeId: 'Dragon' }
const DRAGON_CHEMTECH: Monster = { name: 'Dragon (Chemtech)', file: 'dragon_chemtech.glb', height: 2.4, idle: 'Idle1_Base', typeId: 'Dragon' }
const DRAGON_EARTH: Monster = { name: 'Dragon (Earth)', file: 'dragon_earth.glb', height: 2.4, idle: 'Idle1_Base', typeId: 'Dragon' }
const DRAGON_ELDER: Monster = { name: 'Dragon (Elder)', file: 'dragon_elder.glb', height: 2.4, idle: 'Idle1_Base', typeId: 'Dragon' }
const DRAGON_HEXTECH: Monster = { name: 'Dragon (Hextech)', file: 'dragon_hextech.glb', height: 2.4, idle: 'Idle1_Base', typeId: 'Dragon' }
const DRAGON_WATER: Monster = { name: 'Dragon (Water)', file: 'dragon_water.glb', height: 2.4, idle: 'Idle1_Base', typeId: 'Dragon' }

const DRAGON_VARIANTS: Monster[] = [
  DRAGON_FIRE,
  DRAGON_AIR,
  DRAGON_CHEMTECH,
  DRAGON_EARTH,
  DRAGON_ELDER,
  DRAGON_HEXTECH,
  DRAGON_WATER,
]

const BARON: Monster = { name: 'Baron Nashor', file: 'baron_nashor.glb', height: 7.5, idle: 'Idle1_Base' }
const RIFT_HERALD: Monster = { name: 'Rift Herald', file: 'rift_herald.glb', height: 5, idle: 'Idle1_Base' }

// Uniform random pick, made once per page load, using the browser's RNG when it is available.
function pickOne<T>(list: readonly T[]): T {
  let value = Math.floor(Math.random() * 2 ** 32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const words = new Uint32Array(1)
    crypto.getRandomValues(words)
    value = words[0]
  }
  return list[value % list.length]
}

// Where the pit monsters stand. The values are the hand-placed positions from the layout
// editor, copied here so a random pick always lands in the same spot.
interface PitPlacement {
  id: string
  monster: Monster
  x: number
  z: number
  yawDeg: number
  y: number
}

const DRAGON_PIT: Omit<PitPlacement, 'id' | 'monster'> = { x: -99.12, z: 44.85, yawDeg: -22.4, y: -5.2 }

// Baron's pit holds one of three encounters, chosen again each load.
const BARON_PIT: PitPlacement[][] = [
  [{ id: 'pit-Baron Nashor', monster: BARON, x: -49.07, z: 102.99, yawDeg: -196.7, y: -2.7 }],
  [{ id: 'pit-Rift Herald', monster: RIFT_HERALD, x: -49.28, z: 104.08, yawDeg: 148.5, y: -2 }],
  [
    // The hand-placed spots of the grubs round the spot where Baron stands
    { id: 'pit-Void grubs-1', monster: VOID_GRUBS, x: -48.21, z: 107.08, yawDeg: -180, y: -2 },
    { id: 'pit-Void grubs-2', monster: VOID_GRUBS, x: -53.13, z: 103.9, yawDeg: 90, y: -2 },
    { id: 'pit-Void grubs-3', monster: VOID_GRUBS, x: -47.76, z: 101.43, yawDeg: -30, y: -2 },
  ],
]

const PIT_ITEMS: PitPlacement[] = [
  ...BARON_PIT[Math.floor(Math.random() * BARON_PIT.length)],
  { id: 'pit-Dragon', monster: pickOne(DRAGON_VARIANTS), ...DRAGON_PIT },
]

// Jungle camps in the blue frame. Each one is also placed mirrored for the red side.
const JUNGLE_CAMPS: { at: Fraction; monster: Monster }[] = [
  { at: [0.19, 0.36], monster: BLUE_SENTINEL },
  { at: [0.36, 0.19], monster: RED_BRAMBLEBACK },
  { at: [0.14, 0.44], monster: GROMP },
  { at: [0.44, 0.14], monster: KRUG },
  { at: [0.3, 0.6], monster: MURK_WOLF },
  { at: [0.6, 0.2], monster: SCUTTLE_CRAB },
  { at: [0.6, 0.72], monster: VOID_GRUBS },
]
const MONSTER_URLS = [...new Set([...JUNGLE_CAMPS, ...PIT_ITEMS].map((m) => `${M}${m.monster.file}`))]

const MAP_CENTER = place('blue', [0.5, 0.5])

for (const url of [TURRET, NEXUS_MODEL, ...MONSTER_URLS]) {
  useGLTF.preload(url)
}

// Yaw that turns a model's front (+Z, the glTF forward) toward `to`.
function facingToward(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.atan2(to.x - from.x, to.z - from.z)
}

// A lane tower faces down its lane, toward the enemy base. The next point along the lane
// (blue frame) gives the direction, and place() mirrors it for the red side.
function laneFacing(team: Team, spot: Fraction): number {
  for (const lane of LANES) {
    const i = lane.findIndex(([u, v]) => u === spot[0] && v === spot[1])
    if (i >= 0 && i < lane.length - 1) return facingToward(place(team, spot), place(team, lane[i + 1]))
  }
  return facingToward(place(team, spot), MAP_CENTER)
}

// Everything that stands on the rift. The default pose comes from the layout rules; the
// editor can override it per item id.
interface Item {
  id: string
  name: string
  kind: 'tower' | 'turret' | 'nexus' | 'monster' | 'model'
  team?: Team
  height: number
  pose: Pose // default pose
  monster?: Monster
  url?: string // a model from the local models folder, not one of the built-ins
  typeId?: string // what its size is shared with; defaults to the monster name or the kind
  subtitle: string
}

function poseAt(p: THREE.Vector3, yaw: number): Pose {
  return { x: p.x, z: p.z, yaw }
}

// The pit monsters are named the way the rest are: after their model's file, "pit_baron_nashor". The grubs,
// which come three together, are numbered.
const pitName = (pit: PitPlacement) =>
  `pit_${pit.monster.file.replace(/\.glb$/i, '')}${/-(\d+)$/.test(pit.id) ? `_${pit.id.match(/-(\d+)$/)![1]}` : ''}`

const ITEMS: Item[] = (() => {
  const items: Item[] = []
  for (const team of ['blue', 'red'] as Team[]) {
    TOWER_SPOTS.forEach((spot, i) => {
      items.push({
        id: `${team}-tower-${i}`,
        name: `${team}_tower_${i + 1}`,
        kind: 'tower',
        team,
        height: TOWER_HEIGHT,
        pose: poseAt(place(team, spot), laneFacing(team, spot) + TURRET_YAW),
        subtitle: 'structure · tower',
      })
    })
    NEXUS_TURRET_SPOTS.forEach((spot, i) => {
      const p = place(team, spot)
      items.push({
        id: `${team}-turret-${i}`,
        name: `${team}_nexus_turret_${i + 1}`,
        kind: 'turret',
        team,
        height: TURRET_HEIGHT,
        pose: poseAt(p, facingToward(p, MAP_CENTER) + TURRET_YAW),
        subtitle: 'structure · turret',
      })
    })
    const nexusAt = place(team, NEXUS_AT)
    items.push({
      id: `${team}-nexus`,
      name: `${team}_nexus`,
      kind: 'nexus',
      team,
      height: NEXUS_HEIGHT,
      pose: poseAt(nexusAt, facingToward(nexusAt, MAP_CENTER)),
      subtitle: 'structure · main base',
    })
  }
  for (const { at, monster } of JUNGLE_CAMPS) {
    for (const team of ['blue', 'red'] as Team[]) {
      const p = place(team, at)
      items.push({
        id: `camp-${monster.name}-${team}`,
        name: `${team}_${monster.file.replace(/\.glb$/i, '').replace('blue_sentinel', 'blue_buff').replace('red_brambleback', 'red_buff')}`,
        kind: 'monster',
        height: monster.height,
        pose: poseAt(p, facingToward(p, MAP_CENTER)),
        monster,
        subtitle: 'monster · jungle',
      })
    }
  }
  for (const pit of PIT_ITEMS) {
    items.push({
      id: pit.id,
      name: pitName(pit),
      kind: 'monster',
      height: pit.monster.height,
      pose: { x: pit.x, z: pit.z, yaw: (pit.yawDeg * Math.PI) / 180, y: pit.y },
      monster: pit.monster,
      typeId: pit.monster.typeId,
      subtitle: 'monster · pit',
    })
  }
  // Hand-placed items replace the rule-based pose
  return items.map((item) => {
    const baked = BAKED_POSES[item.id]
    if (!baked) return item
    return { ...item, pose: { x: baked.x, z: baked.z, yaw: (baked.yawDeg * Math.PI) / 180, y: baked.y } }
  })
})()

// What can be put on the map from the editor's inventory: each team's tower, turret and nexus, and
// each monster.
interface InventoryEntry {
  key: string
  label: string
  kind: Item['kind']
  team?: Team
  height: number
  monster?: Monster
  group: 'Structures' | 'Monsters'
  url: string // the model, for the preview
  tint?: string
}
const ALL_MONSTERS = [
  BLUE_SENTINEL,
  RED_BRAMBLEBACK,
  GROMP,
  KRUG,
  MURK_WOLF,
  SCUTTLE_CRAB,
  VOID_GRUBS,
  ...DRAGON_VARIANTS,
  BARON,
  RIFT_HERALD,
]
const INVENTORY: InventoryEntry[] = [
  ...(['blue', 'red'] as Team[]).flatMap((team): InventoryEntry[] => [
    { key: `${team}-tower`, label: `${team} tower`, kind: 'tower', team, height: TOWER_HEIGHT, group: 'Structures', url: TURRET },
    { key: `${team}-turret`, label: `${team} turret`, kind: 'turret', team, height: TURRET_HEIGHT, group: 'Structures', url: TURRET },
    { key: `${team}-nexus`, label: `${team} nexus`, kind: 'nexus', team, height: NEXUS_HEIGHT, group: 'Structures', url: NEXUS_MODEL, tint: TEAM_COLOR[team] },
  ]),
  ...ALL_MONSTERS.map((monster): InventoryEntry => ({
    key: `monster-${monster.name}`,
    label: monster.name,
    kind: 'monster',
    height: monster.height,
    monster,
    group: 'Monsters',
    url: `${M}${monster.file}`,
  })),
]
// Models that are already on the map. A new one dropped from the inventory takes the same height
// and joins the same size group, so it matches the ones that are placed and resizes with them.
const BUILTIN_BY_FILE = new Map<string, { height: number; typeId: string }>([
  ['turrets.glb', { height: TOWER_HEIGHT, typeId: 'tower' }],
  ['nexus.glb', { height: NEXUS_HEIGHT, typeId: 'nexus' }],
  ...ALL_MONSTERS.map((m): [string, { height: number; typeId: string }] => [m.file, { height: m.height, typeId: m.typeId ?? m.name }]),
])

// Sizes the pit monsters need even when an older saved layout predates them.
const PIT_TYPE_SCALES: Record<string, number> = {
  Dragon: 3.225,
  'Baron Nashor': 1.407,
  'Rift Herald': 1.34,
}
const DEFAULT_SCALES: Record<string, number> = { ...PIT_TYPE_SCALES, ...DEFAULT_TYPE_SCALES }

// Earlier builds placed every pit monster as ordinary added models and hid the built-in pits.
// Those saved entries would otherwise keep the static dragon/baron/herald/grubs on the map
// forever. They are cleaned once; the randomized built-in pits take over from there.
function migratePitSpawns() {
  const flag = 'riftPitSpawnV2'
  const pitFiles = new Set(['file:dragon.glb', 'file:baron_nashor.glb', 'file:rift_herald.glb', 'file:voidgrubs.glb'])
  const oldPitIds = new Set(['pit-Baron Nashor', 'pit-Dragon'])
  const isOldPitId = (id: string) => {
    const match = /^added-[^-]+-(file:.*)$/.exec(id)
    return oldPitIds.has(id) || (!!match && pitFiles.has(match[1]))
  }
  const read = <T,>(key: string): T | null => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }
  const write = (key: string, value: unknown) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage can be blocked. The defaults then apply.
    }
  }
  try {
    if (window.localStorage.getItem(flag) === '1') return
    const overrides = read<Record<string, Pose>>('riftLayoutOverrides')
    if (overrides) {
      for (const id of Object.keys(overrides)) if (isOldPitId(id)) delete overrides[id]
      write('riftLayoutOverrides', overrides)
    }
    const added = read<AddedEntry[]>('riftAdded')
    if (added) write('riftAdded', added.filter((entry) => !pitFiles.has(entry.key) && !isOldPitId(entry.id)))
    const deleted = read<string[]>('riftDeleted')
    if (deleted) write('riftDeleted', deleted.filter((id) => !oldPitIds.has(id)))
    const locked = read<string[]>('riftLocked')
    if (locked) write('riftLocked', locked.filter((id) => !isOldPitId(id)))
    const names = read<Record<string, string>>('riftNames')
    if (names) {
      for (const id of Object.keys(names)) if (isOldPitId(id)) delete names[id]
      write('riftNames', names)
    }
    window.localStorage.setItem(flag, '1')
  } catch {
    // Storage can be blocked. The built-in random pits still work for this session.
  }
}
migratePitSpawns()

// The side each local model declares, filled in when the folder's list arrives
const knownSides = new Map<string, 'order' | 'chaos'>()

// The name of a model's file, without the folder or the extension
const fileBase = (url: string) => (url.split('/').pop() ?? url).replace(/\.glb$/i, '')
// An entity added from the inventory, as an Item
function itemFromEntry(entry: AddedEntry): Item | null {
  if (entry.key.startsWith('file:')) {
    // A model from the local models folder
    const path = entry.key.slice('file:'.length)
    const model = describeLocalModel(path, knownSides.get(path))
    const same = BUILTIN_BY_FILE.get(path.split('/').pop() ?? '')
    return {
      id: entry.id,
      name: model.label,
      team: model.team === 'order' ? 'blue' : model.team === 'chaos' ? 'red' : undefined,
      kind: 'model',
      height: same?.height ?? model.height,
      pose: { x: entry.x, z: entry.z, yaw: entry.yaw },
      url: model.url,
      typeId: same?.typeId ?? entry.key,
      subtitle: `${model.group.toLowerCase()} · added`,
    }
  }
  const inv = INVENTORY.find((i) => i.key === entry.key)
  if (!inv) return null
  const file = inv.monster ? inv.monster.file.replace(/\.glb$/i, '') : fileBase(inv.url)
  return {
    id: entry.id,
    name: inv.team ? `${file} (${inv.team})` : file,
    kind: inv.kind,
    team: inv.team,
    height: inv.height,
    pose: { x: entry.x, z: entry.z, yaw: entry.yaw },
    monster: inv.monster,
    typeId: inv.monster?.typeId,
    subtitle: inv.kind === 'monster' ? 'monster · added' : `structure · ${inv.kind}`,
  }
}

// A deep copy, so resetting never hands the default layout itself to the editor to change
const fresh = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

// Sizes are per type only, with no per-entity exceptions. Moves saved by an older version may
// carry a per-entity size, and the baked items now hold their own placements, so both are
// cleared once.
function loadCleanOverrides(): Record<string, Pose> {
  const overrides = loadOverrides(DEFAULT_OVERRIDES)
  const flag = 'riftLayoutClean'
  try {
    if (window.localStorage.getItem(flag) === '1') return overrides
  } catch {
    // Storage can be blocked: clean the in-memory copy and carry on.
  }
  for (const id of Object.keys(BAKED_POSES)) delete overrides[id]
  for (const pose of Object.values(overrides)) delete pose.scale
  saveOverrides(overrides)
  try {
    window.localStorage.setItem(flag, '1')
  } catch {
    // Storage can be blocked. It is cleaned again next load.
  }
  return overrides
}

// Entities of the same type are resized together: all towers, all turrets, both nexuses, and
// each kind of monster.
const typeKey = (item: Item) =>
  item.typeId ?? (item.kind === 'monster' && item.monster ? item.monster.typeId ?? item.monster.name : item.kind)
const typeLabel = (item: Item) => {
  if (item.kind === 'model') return `all ${item.name}`
  if (item.typeId === 'Dragon' || item.monster?.typeId === 'Dragon') return 'all dragons'
  if (item.kind === 'monster' && item.monster) return `all ${item.monster.file.replace(/\.glb$/i, '')}`
  if (item.kind === 'nexus') return 'all nexus'
  return item.kind === 'tower' ? 'all turrets (lane)' : 'all turrets (guards)'
}

// What a clicked unit reports to the lock label. The anchor is where the label sits.
interface LockInfo {
  title: string
  subtitle: string
  color: string
  anchor: [number, number, number]
}

// Components call this when they are clicked. RiftModels owns the lock state.
const LockContext = createContext<(lock: LockInfo) => void>(() => {})

// Copies a loaded GLB and scales it to `height` units, standing on y = 0 and centred on x/z.
// A League export's origin sits wherever the artist put it, so the bounds are measured.
// The copy uses cloneRig, not clone(true): a plain clone keeps every skinned mesh pointing at
// the source's skeleton, which is not in the scene, so the skinned models collapse to the origin.
function fitToHeight(source: THREE.Object3D, height: number, tint?: string): THREE.Group {
  const copy = cloneRig(source)
  if (tint) {
    copy.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const material = (mesh.material as THREE.MeshStandardMaterial).clone()
      material.color.set(tint)
      mesh.material = material
    })
  }
  const holder = new THREE.Group()
  holder.add(copy)
  holder.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(holder)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  copy.position.x -= center.x
  copy.position.y -= box.min.y
  copy.position.z -= center.z
  holder.scale.setScalar(height / Math.max(size.y, 1e-6))
  return holder
}

// One fitted template per URL, height and tint. Each instance clones the template, so the
// bounds are measured once per model instead of once per tower, nexus or monster.
const fitCache = new Map<string, THREE.Group>()
function fittedInstance(url: string, source: THREE.Object3D, height: number, tint?: string): THREE.Object3D {
  const key = `${url}|${height}|${tint ?? ''}`
  let template = fitCache.get(key)
  if (!template) {
    template = fitToHeight(source, height, tint)
    fitCache.set(key, template)
  }
  const copy = cloneRig(template)
  showParts(copy, null) // a building's other states lie on top of its standing one: see monsterClips.ts
  return copy
}

// A static League model, fitted to `height` and tinted when a team colour is given.
function FittedModel({ url, height, tint, entityId }: { url: string; height: number; tint?: string; entityId?: string }) {
  const gltf = useGLTF(url)
  const scene = useMemo(() => fittedInstance(url, gltf.scene, height, tint), [url, gltf, height, tint])
  const group = useRef<THREE.Group>(null)
  const pop = usePop(group, true) // it grows in when the site has loaded
  useEffect(() => {
    if (!entityId) return
    const control: ClipControl = {
      names: [],
      play: () => {},
      stop: () => {},
      death: () => {
        if (control.dead) return null
        control.dead = true
        return pop.die() // and shrinks away when it is deleted
      },
      dead: false,
    }
    registerClips(entityId, control)
    return () => unregisterClips(entityId, control)
  }, [entityId, pop])
  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}

// The clip to loop for a model that does not name one: a plain idle, not an aggro or transition clip.
// What a model does when it has no spawn clip, or no death clip: it grows in once the site has loaded, and
// shrinks away when it is deleted. `die` starts the shrinking and says how long it takes (ms).
function usePop(group: { current: THREE.Object3D | null }, growIn: boolean) {
  const state = useRef<{ phase: 'in' | 'out' | 'none'; t: number }>({ phase: growIn ? 'in' : 'none', t: 0 })
  useFrame((_, dt) => {
    const g = group.current
    const s = state.current
    if (!g || s.phase === 'none') return
    if (s.phase === 'in') {
      if (!isRevealed()) {
        g.scale.setScalar(0.001) // waiting for the loading screen to go
        return
      }
      s.t = Math.min(1, s.t + dt / 1.1)
      const k = s.t - 1
      g.scale.setScalar(Math.max(0.001, 1 + 2.3 * k * k * k + 1.3 * k * k)) // ease out with a little overshoot
      if (s.t >= 1) s.phase = 'none'
    } else {
      s.t = Math.min(1, s.t + dt / 0.9)
      g.scale.setScalar(Math.max(0.001, 1 - s.t * s.t))
    }
  })
  return useMemo(
    () => ({
      die: () => {
        state.current = { phase: 'out', t: 0 }
        return 950
      },
    }),
    [],
  )
}

function MonsterModel({
  url,
  height,
  clip,
  entityId,
  at,
  moving = false,
}: {
  url: string
  height: number
  clip?: string // the idle it prefers
  entityId?: string // the entity this is, for the editor's clip list and the death on delete
  at?: [number, number] // where it stands (x, z), to find the entities it moves together with
  moving?: boolean // it is walking a route: it runs instead of standing
}) {
  const gltf = useGLTF(url)
  const root = useRef<THREE.Group>(null)
  const scene = useMemo(() => fittedInstance(url, gltf.scene, height), [url, gltf, height])
  const { actions, mixer } = useAnimations(gltf.animations, root)
  const plan = useMemo(() => planClips(gltf.animations.map((a) => a.name), clip), [gltf.animations, clip])
  const epic = useMemo(() => isEpicModel(url), [url])
  const pop = usePop(root, !plan.spawn)
  const stateful = useMemo(() => hasStates(scene), [scene])
  const movingRef = useRef(moving)
  movingRef.current = moving
  const atRef = useRef(at)
  atRef.current = at
  const refreshBase = useRef<() => void>(() => {})

  // What a model does: it spawns once when the site has loaded, then stands (or runs, on a route). Now and
  // then the group it stands with (a camp, the turrets round a nexus) plays a move together, each member its
  // own clip of the same kind. The four big ones also spawn in again every so often.
  useEffect(() => {
    const baseAction = () => {
      const name = movingRef.current && plan.run ? plan.run : plan.idle
      return name ? actions[name] ?? null : null
    }
    let current: THREE.AnimationAction | null = null
    let busy = false // a clip that plays once is playing
    const timers = new Set<number>()
    const later = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        timers.delete(id)
        fn()
      }, ms)
      timers.add(id)
    }
    const start = (action: THREE.AnimationAction, once: boolean) => {
      action.reset()
      action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity)
      action.clampWhenFinished = once
      // The quick clips are slowed down so they can be seen, and the very long ones sped up
      action.timeScale = once ? timeScaleFor(action.getClip().duration) : 1
      action.fadeIn(0.2).play()
      if (current && current !== action) current.fadeOut(0.25)
      current = action
    }
    // The meshes that show: the standing ones, or the ones a clip moves (a tower's Respawn moves its broken
    // pieces, a nexus's Death its destroyed mesh)
    const showFor = (action: THREE.AnimationAction | null) => {
      if (!stateful) return
      const clipOf = action?.getClip()
      showParts(scene, clipOf ? movedParts(gltf.scene, clipOf, `${url}|${clipOf.name}`) : null)
    }
    const toBase = () => {
      busy = false
      showFor(null)
      const action = baseAction()
      if (action) start(action, false)
    }
    const playOnce = (name: string | null) => {
      const action = name ? actions[name] : null
      if (!action) return false
      busy = true
      start(action, true)
      showFor(action)
      return true
    }
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action === current && busy && !control.dead) toBase()
    }
    const control: ClipControl = {
      names: gltf.animations.map((a) => a.name),
      play: (name) => {
        if (!control.dead) playOnce(name)
      },
      stop: () => {
        if (!control.dead) toBase()
      },
      death: () => {
        if (control.dead) return null
        control.dead = true
        busy = true
        const action = plan.death ? actions[plan.death] : null
        // No death clip: it shrinks away
        if (!action) return pop.die()
        const clipOf = action.getClip()
        const spawnClip = plan.spawn ? actions[plan.spawn]?.getClip() : null
        // A tower's "Destroyed" is its "Respawn" under another name, which builds it up: for a death the
        // same clip is played backwards, so it falls apart
        const backwards = !!spawnClip && sameClip(clipOf, spawnClip)
        start(action, true)
        action.timeScale = timeScaleFor(clipOf.duration, 6)
        if (backwards) {
          action.timeScale = -action.timeScale
          action.time = clipOf.duration
        }
        showFor(action)
        return Math.min(6000, (clipOf.duration / Math.abs(action.timeScale)) * 1000) + 150
      },
      dead: false,
    }
    refreshBase.current = () => {
      if (!busy && !control.dead) toBase()
    }

    mixer.addEventListener('finished', onFinished as never)

    // The spawn waits for the site to have loaded (the models are ready while the loading screen is still
    // up), standing on its first frame meanwhile
    const spawned = playOnce(plan.spawn)
    if (!spawned) toBase()
    let stopWaiting = () => {}
    const spawning = plan.spawn ? actions[plan.spawn] : null
    if (spawned && spawning && !isRevealed()) {
      spawning.paused = true
      stopWaiting = onRevealed(() => {
        spawning.paused = false
      })
    }
    if (entityId) registerClips(entityId, control)

    // The group moves
    const member: GroupMember = {
      x: atRef.current?.[0] ?? 0,
      z: atRef.current?.[1] ?? 0,
      kinds: () => kindsOf(plan.show),
      ready: () => !control.dead && !busy && !movingRef.current && plan.show.length > 0,
      cue: (kind, seed, delay) => {
        const choices = showOfKind(plan.show, kind)
        if (choices.length === 0) return
        later(delay, () => {
          if (!control.dead && !busy && !movingRef.current) playOnce(choices[seed % choices.length])
        })
      },
    }
    if (entityId) joinGroup(entityId, member)

    const respawn = () =>
      later(50000 + Math.random() * 40000, () => {
        if (!control.dead && !busy && !movingRef.current) playOnce(plan.spawn)
        respawn()
      })
    if (epic && plan.spawn) respawn()

    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      stopWaiting()
      mixer.removeEventListener('finished', onFinished as never)
      if (entityId) {
        unregisterClips(entityId, control)
        leaveGroup(entityId, member)
      }
      current?.fadeOut(0.25)
    }
  }, [actions, mixer, plan, epic, entityId, gltf.animations, scene, stateful, pop, url, gltf.scene])

  // A route starts or ends: stand or run
  useEffect(() => {
    refreshBase.current()
  }, [moving])

  return (
    <group ref={root}>
      <primitive object={scene} />
    </group>
  )
}

interface EditContextValue {
  interactive: boolean // false in the arXiv view: the entities do not answer clicks, and show no name
  version: number // bumped on reset, so every floating box starts again from its default state
  editing: boolean
  boxes: boolean // the floating boxes over the models are shown
  selected: string | null
  beginDrag: (item: Item, event: ThreeEvent<PointerEvent>) => void
  adjust: (item: Item, change: Adjust) => void
  reset: (item: Item) => void
  select: (id: string) => void
  typeScales: Record<string, number>
  names: Record<string, string>
  rename: (item: Item, name: string) => void
  finishRename: (item: Item) => void
  remove: (item: Item) => void
  locked: ReadonlySet<string> // entities that cannot be moved, turned, raised, reset or deleted
  toggleLock: (item: Item) => void
  duplicate: (item: Item) => void
  paths: Record<string, PathPoints> // the routes drawn for the scuttle crab
  drawingPath: string | null // the entity whose route is being drawn
  startPath: (item: Item) => void
  endPath: () => void
  undoPath: (item: Item) => void
  clearPath: (item: Item) => void
}
const EditContext = createContext<EditContextValue>({ interactive: true, version: 0, editing: false, boxes: false, selected: null, beginDrag: () => {}, adjust: () => {}, reset: () => {}, select: () => {}, typeScales: {}, names: {}, rename: () => {}, finishRename: () => {}, remove: () => {}, locked: new Set(), toggleLock: () => {}, duplicate: () => {}, paths: {}, drawingPath: null, startPath: () => {}, endPath: () => {}, undoPath: () => {}, clearPath: () => {} })

const floatButton: CSSProperties = {
  flex: 1,
  background: 'rgba(10, 200, 255, 0.14)',
  border: '1px solid #0ac8ff',
  color: '#f0e6d2',
  padding: '4px 4px',
  cursor: 'pointer',
  font: '10px Consolas, monospace',
  userSelect: 'none',
  touchAction: 'none',
  whiteSpace: 'nowrap',
}

// Which entities have their floating toolbar folded down. Kept at module level so a toolbar
// keeps its state when the editor is switched off and on again.
// Every floating box starts folded. Boxes the user opens are remembered in this browser. Earlier
// versions saved different states, so the saved state is cleared once when this version first runs.
try {
  if (typeof window !== 'undefined' && window.localStorage.getItem('riftToolbarsDefault') !== '3') {
    window.localStorage.removeItem('riftToolbarsCollapsed')
    window.localStorage.removeItem('riftToolbarsOpen')
    window.localStorage.setItem('riftToolbarsDefault', '3')
  }
} catch {
  // Storage can be blocked. The boxes then keep whatever state they had.
}
const openToolbars = new Set(loadOpenToolbars())
// Who wants to know when a box is opened or folded (the routes show only for the entities whose box is open)
const toolbarListeners = new Set<() => void>()
const notifyToolbars = () => toolbarListeners.forEach((fn) => fn())

// The editor that floats above one entity's head. It is drawn in the 3D scene with a distance
// factor, so it shrinks as the camera zooms out. Html does not carry this file's React contexts
// into its content, so everything arrives through props.
function EntityToolbar({
  item,
  selected,
  onAdjust,
  onReset,
  onSelect,
  name,
  onRename,
  onNameDone,
  onDelete,
  locked,
  onToggleLock,
  onCopy,
  pathPoints,
  drawingPath,
  onPathDraw,
  onPathFinish,
  onPathUndo,
  onPathClear,
}: {
  item: Item
  selected: boolean
  onAdjust: (change: Adjust) => void
  onReset: () => void
  onSelect: () => void
  name: string
  onRename: (name: string) => void
  onNameDone: () => void
  onDelete: () => void
  locked: boolean
  onToggleLock: () => void
  onCopy: () => void
  pathPoints: number // points of its route so far
  drawingPath: boolean // its route is being drawn: clicks on the ground add points
  onPathDraw: () => void
  onPathFinish: () => void
  onPathUndo: () => void
  onPathClear: () => void
}) {
  const [collapsed, setCollapsed] = useState(() => !openToolbars.has(item.id))
  // The clips of this entity's model, once it has loaded
  const [clipNames, setClipNames] = useState<string[]>(() => clipControls.get(item.id)?.names ?? [])
  useEffect(() => {
    const update = () => setClipNames(clipControls.get(item.id)?.names ?? [])
    update()
    return onClipsChange((id) => {
      if (id === item.id) update()
    })
  }, [item.id])
  // The name field keeps its own copy of the text. This toolbar is drawn through Html, a separate
  // React root, so a value that only came back from the page's state arrived after the browser had
  // already moved the caret to the end. A local copy updates inside the keystroke, so it stays put.
  const [draft, setDraft] = useState(name)
  const typing = useRef(false)
  useEffect(() => {
    if (!typing.current) setDraft(name)
  }, [name])
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      // prev is true when the box is folded, so this press opens it
      if (prev) openToolbars.add(item.id)
      else openToolbars.delete(item.id)
      saveOpenToolbars([...openToolbars])
      queueMicrotask(notifyToolbars) // not while this box is being redrawn
      return !prev
    })
  }
  const miniButton: CSSProperties = {
    background: 'none',
    border: '1px solid rgba(200, 170, 110, 0.7)',
    color: '#c8aa6e',
    padding: '0 6px',
    lineHeight: '14px',
    font: 'inherit',
    cursor: 'pointer',
  }
  if (collapsed) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 6px',
          background: 'rgba(1, 10, 19, 0.9)',
          border: `1px solid ${selected ? '#c8aa6e' : 'rgba(200, 170, 110, 0.6)'}`,
          color: '#c8aa6e',
          font: '10px Consolas, monospace',
          whiteSpace: 'nowrap',
          pointerEvents: 'auto',
        }}
      >
        <span>
          {locked ? '🔒 ' : ''}
          {name || item.name}
        </span>
        <button type="button" style={miniButton} onClick={toggleCollapsed} aria-label={`Expand the editor for ${name}`}>
          ▢
        </button>
      </div>
    )
  }
  const row: CSSProperties = { display: 'flex', gap: 2, marginBottom: 3 }
  // Turning, lifting, resetting and deleting are switched off while the entity is locked
  const frozen: CSSProperties = locked ? { opacity: 0.35, pointerEvents: 'none' } : {}
  const label: CSSProperties = { color: '#c8aa6e', fontSize: 8, letterSpacing: 1, marginBottom: 1 }
  // Pressing any button also selects the entity, so its ring and the panel readout follow
  const step = (change: Adjust) => () => {
    onSelect()
    onAdjust(change)
  }
  return (
    <div
      style={{
        width: 190,
        padding: 6,
        background: 'rgba(1, 10, 19, 0.9)',
        border: `1px solid ${selected ? '#c8aa6e' : '#0ac8ff'}`,
        color: '#f0e6d2',
        font: '10px Consolas, monospace',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            onRename(e.target.value)
          }}
          onFocus={() => {
            typing.current = true
            onSelect()
          }}
          // Typing a name must not reach the camera's key controls or the editor's shortcuts
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          onBlur={() => {
            typing.current = false
            onNameDone()
          }}
          spellCheck={false}
          aria-label={`Name of ${item.name}`}
          style={{
            flex: 1,
            minWidth: 0,
            boxSizing: 'border-box',
            padding: '2px 4px',
            background: 'rgba(10, 200, 255, 0.08)',
            border: '1px solid rgba(200, 170, 110, 0.6)',
            color: '#c8aa6e',
            font: 'inherit',
          }}
        />
        <button
          type="button"
          style={{ ...miniButton, borderColor: locked ? '#c8aa6e' : miniButton.border as string }}
          onClick={onToggleLock}
          title={locked ? 'Locked: it cannot be moved. Click to unlock.' : 'Lock it so it cannot be moved again'}
          aria-label={locked ? `Unlock ${name}` : `Lock ${name}`}
        >
          {locked ? '🔒' : '🔓'}
        </button>
        <button type="button" style={miniButton} onClick={toggleCollapsed} aria-label={`Hide the editor for ${name}`}>
          —
        </button>
      </div>
      <div style={label}>ROTATE</div>
      <div style={{ ...row, ...frozen }}>
        <HoldButton style={floatButton} label="⟲15" onStep={step({ yawDeg: -15 })} />
        <HoldButton style={floatButton} label="⟲1" onStep={step({ yawDeg: -1 })} />
        <HoldButton style={floatButton} label="1⟳" onStep={step({ yawDeg: 1 })} />
        <HoldButton style={floatButton} label="15⟳" onStep={step({ yawDeg: 15 })} />
      </div>
      {clipNames.length > 0 && (
        <>
          <div style={label}>CLIPS · {clipNames.length} · click one to play it</div>
          {/* A plain list of buttons, not a drop-down: a native drop-down does not stay open inside a box
              that is placed in the 3D scene */}
          <div
            style={{
              maxHeight: 92,
              overflowY: 'auto',
              marginBottom: 3,
              border: '1px solid rgba(10, 200, 255, 0.5)',
              background: 'rgba(1, 10, 19, 0.7)',
            }}
          >
            {clipNames.map((n) => (
              <button
                key={n}
                type="button"
                title={n}
                onClick={() => clipControls.get(item.id)?.play(n)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid rgba(10, 200, 255, 0.15)',
                  color: '#f0e6d2',
                  font: 'inherit',
                  fontSize: 10,
                  padding: '2px 4px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                ▶ {n}
              </button>
            ))}
          </div>
          <div style={row}>
            <button type="button" style={floatButton} onClick={() => clipControls.get(item.id)?.stop()}>
              ■ back to standing
            </button>
          </div>
        </>
      )}
      <div style={label}>PITCH · down / up</div>
      <div style={{ ...row, ...frozen }}>
        <HoldButton style={floatButton} label="▼15" onStep={step({ pitchDeg: 15 })} />
        <HoldButton style={floatButton} label="▼1" onStep={step({ pitchDeg: 1 })} />
        <HoldButton style={floatButton} label="▲1" onStep={step({ pitchDeg: -1 })} />
        <HoldButton style={floatButton} label="▲15" onStep={step({ pitchDeg: -15 })} />
      </div>
      <div style={label}>SIZE · {typeLabel(item).toUpperCase()}</div>
      <div style={row}>
        <HoldButton style={floatButton} label="− smaller" onStep={step({ scaleBy: 1 / 1.05 })} />
        <HoldButton style={floatButton} label="+ bigger" onStep={step({ scaleBy: 1.05 })} />
      </div>
      <div style={label}>HEIGHT</div>
      <div style={{ ...row, ...frozen }}>
        <HoldButton style={floatButton} label="▼" onStep={step({ yBy: -0.1 })} />
        <HoldButton style={floatButton} label="▲" onStep={step({ yBy: 0.1 })} />
        <button
          style={floatButton}
          onClick={() => {
            onSelect()
            onReset()
          }}
        >
          reset
        </button>
        <button
          style={{ ...floatButton, borderColor: '#ff4d4d', color: '#ff9a9a' }}
          onClick={onDelete}
          aria-label={`Delete ${name}`}
        >
          delete
        </button>
      </div>
      {(
        <>
          <div style={label}>
            ROUTE · {pathPoints} point{pathPoints === 1 ? '' : 's'}
            {drawingPath ? ' · drag on the ground to draw' : ''}
          </div>
          <div style={row}>
            {drawingPath ? (
              <>
                <button type="button" style={floatButton} onClick={onPathFinish}>
                  Finish
                </button>
                <button type="button" style={floatButton} onClick={onPathUndo}>
                  Undo stroke
                </button>
              </>
            ) : (
              <button type="button" style={floatButton} onClick={onPathDraw}>
                Draw route
              </button>
            )}
            <button type="button" style={floatButton} onClick={onPathClear}>
              Clear
            </button>
          </div>
        </>
      )}
      <button
        type="button"
        style={{ ...floatButton, width: '100%' }}
        onClick={() => {
          onSelect()
          onCopy()
        }}
        title="Make another one next to it"
        aria-label={`Copy ${name}`}
      >
        ⧉ copy
      </button>
    </div>
  )
}

// While a model is dragged out of the inventory, this shows where it would land: a gold ring on the
// ground under the pointer. It keeps its own state, so the rest of the scene does not re-render.
function DropMarker() {
  const { camera, gl, raycaster } = useThree()
  const [at, setAt] = useState<{ x: number; z: number } | null>(null)
  useEffect(() => {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y)
    const hit = new THREE.Vector3()
    const ndc = new THREE.Vector2()
    editorStore.actions.dropHover = (clientX, clientY) => {
      if (clientX === null || clientY === undefined) {
        setAt(null)
        return
      }
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const p = raycaster.ray.intersectPlane(plane, hit)
      setAt(p ? { x: p.x, z: p.z } : null)
    }
    return () => {
      editorStore.actions.dropHover = () => {}
    }
  }, [camera, gl, raycaster])
  if (!at) return null
  return (
    <group position={[at.x, GROUND_Y + 0.15, at.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={20}>
      <mesh>
        <ringGeometry args={[2.2, 2.7, 48]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.95} depthTest={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.35, 24]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.95} depthTest={false} />
      </mesh>
    </group>
  )
}

// One structure or monster at its current pose. Clicking locks a label onto it; in the
// editor, pressing on it selects it and starts a drag instead.
function Placed({ item, pose }: { item: Item; pose: Pose }) {
  const select = useContext(LockContext)
  const edit = useContext(EditContext)
  // An entity with a route walks it back and forth, at its own height, facing the way it goes
  const route = edit.paths[item.id]
  const walking = !!route && route.length >= 2 && edit.drawingPath !== item.id
  const group = useRef<THREE.Group>(null)
  // Crabs do not all start at the same place on the route: half of the time one stands in the middle (going
  // either way), otherwise it starts at one end or the other (a quarter each). It is rolled once, when the
  // crab appears, so every load is different.
  const isCrab = /crab/i.test(`${item.monster?.name ?? ''} ${item.url ?? ''} ${item.name}`)
  const walk = useRef({ along: 0, dir: 1, placed: false })
  // The tilt as one object that only changes with the pose. A new object on every render would be put
  // back on the group each time the page redraws (and it redraws whenever the camera moves), which
  // would undo the heading the walking crab has turned to.
  const tilt = useMemo(() => new THREE.Euler(pose.pitch ?? 0, pose.yaw, 0, 'YXZ'), [pose.pitch, pose.yaw])
  useFrame((_, dt) => {
    const g = group.current
    if (!walking || !g || !route || clipControls.get(item.id)?.dead) return
    const lens: number[] = []
    let total = 0
    for (let i = 1; i < route.length; i++) {
      const l = Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1])
      lens.push(l)
      total += l
    }
    if (total < 0.01) return
    const w = walk.current
    const fresh = !w.placed
    if (fresh) {
      w.placed = true
      if (isCrab) {
        const roll = Math.random()
        if (roll < 0.5) {
          w.along = total / 2
          w.dir = Math.random() < 0.5 ? 1 : -1
        } else if (roll < 0.75) {
          w.along = 0
          w.dir = 1
        } else {
          w.along = total
          w.dir = -1
        }
      }
    }
    w.along += w.dir * ROUTE_SPEED * Math.min(dt, 0.1)
    if (w.along >= total) {
      w.along = total
      w.dir = -1
    } else if (w.along <= 0) {
      w.along = 0
      w.dir = 1
    }
    let left = w.along
    let i = 0
    while (i < lens.length - 1 && left > lens[i]) {
      left -= lens[i]
      i++
    }
    const t = lens[i] > 0 ? Math.min(1, left / lens[i]) : 0
    const [x0, z0] = route[i]
    const [x1, z1] = route[i + 1]
    g.position.set(x0 + (x1 - x0) * t, GROUND_Y + (pose.y ?? 0), z0 + (z1 - z0) * t)
    // Towers and turrets are modelled facing sideways, so their heading carries the same turn as their pose
    const heading = Math.atan2(x1 - x0, z1 - z0) + (w.dir < 0 ? Math.PI : 0) + (item.kind === 'tower' || item.kind === 'turret' ? TURRET_YAW : 0)
    g.rotation.order = 'YXZ'
    if (fresh) {
      g.rotation.y = heading // it appears already facing the way it goes
    } else {
      let turn = heading - g.rotation.y
      turn = Math.atan2(Math.sin(turn), Math.cos(turn))
      g.rotation.y += turn * (1 - Math.exp(-8 * Math.min(dt, 0.1)))
    }
  })
  const selected = edit.editing && edit.selected === item.id
  // The item's own size times its type's size, so one resize changes every entity of the type
  const size = edit.typeScales[typeKey(item)] ?? 1
  const color = item.team ? TEAM_COLOR[item.team] : GOLD

  const body =
    item.kind === 'monster' && item.monster ? (
      <MonsterModel url={`${M}${item.monster.file}`} height={item.height} clip={item.monster.idle} entityId={item.id} at={[pose.x, pose.z]} moving={walking} />
    ) : item.kind === 'model' && item.url ? (
      <MonsterModel url={item.url} height={item.height} entityId={item.id} at={[pose.x, pose.z]} moving={walking} />
    ) : (
      <FittedModel
        url={item.kind === 'nexus' ? NEXUS_MODEL : TURRET}
        height={item.height}
        // Towers and turrets keep the model's own colours. Only the nexus is team-tinted.
        tint={item.kind === 'nexus' ? color : undefined}
        entityId={item.id}
      />
    )

  return (
    <group
      ref={group}
      name={item.id}
      position={[pose.x, GROUND_Y + (pose.y ?? 0), pose.z]}
      rotation={tilt}
      scale={size}
      onPointerDown={edit.editing ? (e) => edit.beginDrag(item, e) : undefined}
      onClick={
        edit.editing || !edit.interactive
          ? undefined
          : (e) => {
              e.stopPropagation()
              select({
                title: edit.names[item.id] || item.name,
                subtitle: item.subtitle,
                color,
                anchor: [
                  pose.x,
                  GROUND_Y + (pose.y ?? 0) + item.height * size + (item.kind === 'monster' ? 1 : 2),
                  pose.z,
                ],
              })
            }
      }
    >
      <Suspense fallback={null}>{body}</Suspense>
      {/* The box stands on a point above the head, so it grows upward however tall it gets (folded, with the
          clip list, with the route row), instead of spreading both ways over the model */}
      {edit.editing && edit.boxes && (
        <Html position={[0, item.height + 1.6, 0]} distanceFactor={30} zIndexRange={[2500, 0]}>
          <div style={{ transform: 'translate(-50%, -100%)' }}>
          <EntityToolbar
            key={edit.version}
            item={item}
            name={edit.names[item.id] ?? item.name}
            onRename={(n) => edit.rename(item, n)}
            onNameDone={() => edit.finishRename(item)}
            onDelete={() => edit.remove(item)}
            locked={edit.locked.has(item.id)}
            onToggleLock={() => edit.toggleLock(item)}
            onCopy={() => edit.duplicate(item)}
            selected={selected}
            onAdjust={(change) => edit.adjust(item, change)}
            onReset={() => edit.reset(item)}
            onSelect={() => edit.select(item.id)}
            pathPoints={route?.length ?? 0}
            drawingPath={edit.drawingPath === item.id}
            onPathDraw={() => edit.startPath(item)}
            onPathFinish={edit.endPath}
            onPathUndo={() => edit.undoPath(item)}
            onPathClear={() => edit.clearPath(item)}
          />
          </div>
        </Html>
      )}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} renderOrder={10}>
          <ringGeometry args={[Math.max(1.6, item.height * 0.45), Math.max(1.9, item.height * 0.45 + 0.3), 48]} />
          <meshBasicMaterial color={GOLD} transparent opacity={0.95} depthTest={false} />
        </mesh>
      )}
    </group>
  )
}

// One editor step: turn, resize or lift the selected item.
interface Adjust {
  yawDeg?: number
  pitchDeg?: number // positive tips the nose down
  scaleBy?: number
  yBy?: number
}
// Every entity can be given a route to walk (the scuttle crab is the one it was made for)
const ROUTE_SPEED = 3 // world units per second along its route
const ROUTE_STEP = 0.8 // drawing a route: a point is added each time the pointer has moved this far
const ROUTE_TOLERANCE = 0.25 // and a finished stroke is thinned out until no point is further than this off its line

// Thins out the points of a stroke (Ramer-Douglas-Peucker): the ends stay, and so does every point that
// is more than `tolerance` away from the straight line between the points kept either side of it.
function simplify(points: PathPoints, tolerance: number): PathPoints {
  if (points.length < 3) return points
  const [ax, az] = points[0]
  const [bx, bz] = points[points.length - 1]
  const len = Math.hypot(bx - ax, bz - az)
  let far = 0
  let at = -1
  for (let i = 1; i < points.length - 1; i++) {
    const [x, z] = points[i]
    const d = len === 0 ? Math.hypot(x - ax, z - az) : Math.abs((bx - ax) * (az - z) - (ax - x) * (bz - az)) / len
    if (d > far) {
      far = d
      at = i
    }
  }
  if (far <= tolerance) return [points[0], points[points.length - 1]]
  return [...simplify(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(points.slice(at), tolerance)]
}
const clampScale = (s: number) => Math.min(8, Math.max(0.1, s))

const deg = (rad: number) => (rad * 180) / Math.PI
const round = (v: number, places = 2) => Math.round(v * 10 ** places) / 10 ** places

// A button that fires once on press, then repeats while it is held.
function HoldButton({ label, onStep, style }: { label: string; onStep: () => void; style: CSSProperties }) {
  const timer = useRef(0)
  const latest = useRef(onStep)
  latest.current = onStep
  const stop = () => {
    window.clearTimeout(timer.current)
    window.clearInterval(timer.current)
  }
  // Stops repeating and stops listening for the release
  const release = () => {
    stop()
    window.removeEventListener('pointerup', release)
    window.removeEventListener('pointercancel', release)
  }
  useEffect(() => release, [])
  const start = () => {
    release()
    latest.current()
    timer.current = window.setTimeout(() => {
      timer.current = window.setInterval(() => latest.current(), 55)
    }, 300)
    // Listen on the window, not the button. The up and down buttons move the model, its toolbar
    // moves with it, and the pointer ends up off the button while it is still held down.
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
  }
  return (
    <button
      style={style}
      onPointerDown={(e) => {
        e.preventDefault()
        start()
      }}
    >
      {label}
    </button>
  )
}

// Everything on the rift that comes from a real model. Clicking a tower, nexus or monster
// locks a bracket label onto it for a few seconds. On localhost it is also a layout editor.
// The route of a crab, drawn on the map while editing: a line through the points, a dot at each (the
// first one green, where it starts)
function RouteLine({ points, y, active }: { points: PathPoints; y: number; active: boolean }) {
  const vectors = useMemo(() => points.map(([x, z]) => new THREE.Vector3(x, y, z)), [points, y])
  const color = active ? '#ffd23f' : '#0ac8ff'
  return (
    <group>
      {vectors.length >= 2 && <Line points={vectors} color={color} lineWidth={2} depthTest={false} renderOrder={10} />}
      {vectors.map((v, i) => (
        <mesh key={i} position={v} renderOrder={11}>
          <sphereGeometry args={[0.35, 12, 12]} />
          <meshBasicMaterial color={i === 0 ? '#4cd964' : color} depthTest={false} />
        </mesh>
      ))}
    </group>
  )
}

// hideTags turns the floating tags over the models (and the editing that goes with them) off for
// as long as it is set, without touching the saved setting, so it comes back as it was.
export default function RiftModels({ hideTags = false }: { hideTags?: boolean }) {
  const [lock, setLock] = useState<LockInfo | null>(null)
  // A name label that was locked onto an entity goes when the arXiv view comes
  useEffect(() => {
    if (hideTags) setLock(null)
  }, [hideTags])
  const [overrides, setOverrides] = useState<Record<string, Pose>>(loadCleanOverrides)
  const [selected, setSelected] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(START_EDITING)
  const [boxes, setBoxes] = useState(() => {
    try {
      // The floating tags start on, for visitors too, until they are turned off from the editor
      return window.localStorage.getItem(BOXES_KEY) !== '0'
    } catch {
      return true
    }
  })
  // The editor is active while its panel is open or the floating boxes are shown, so models can be
  // picked and dragged even with the panel folded away. Hiding both gives the normal view again.
  const editing = EDITOR_ENABLED && !hideTags && (panelOpen || boxes)
  const [typeScales, setTypeScales] = useState<Record<string, number>>(() => ({ ...PIT_TYPE_SCALES, ...loadTypeScales(DEFAULT_SCALES) }))
  const [names, setNames] = useState<Record<string, string>>(() => loadNames(DEFAULT_NAMES))
  const [added, setAdded] = useState<AddedEntry[]>(() => loadAdded(DEFAULT_ADDED))
  const [deleted, setDeleted] = useState<string[]>(() => loadDeleted(DEFAULT_DELETED))
  const [locked, setLocked] = useState<string[]>(() => loadLocked(DEFAULT_LOCKED))
  // Routes for the entities, and the one being drawn (clicks on the ground add points to it)
  const [paths, setPaths] = useState<Record<string, PathPoints>>(() => loadPaths(DEFAULT_PATHS))
  const [drawingPath, setDrawingPath] = useState<string | null>(null)
  // A box opened or folded: the routes drawn on the map follow it
  const [, setBoxesOpenTick] = useState(0)
  useEffect(() => {
    const changed = () => setBoxesOpenTick((t) => t + 1)
    toolbarListeners.add(changed)
    return () => {
      toolbarListeners.delete(changed)
    }
  }, [])
  const [toolbarVersion, setToolbarVersion] = useState(0)
  // A model being downloaded because it was dropped on the map: its name and how far it has got
  const [download, setDownload] = useState<{ name: string; progress: number } | null>(null)
  const lockedSet = useMemo(() => new Set(locked), [locked])
  const [localTiles, setLocalTiles] = useState<InventoryTile[]>([])
  const { camera, gl, raycaster, controls } = useThree()

  useEffect(() => {
    if (!lock) return
    const timer = window.setTimeout(() => setLock(null), 6000)
    return () => window.clearTimeout(timer)
  }, [lock])

  useEffect(() => saveOverrides(overrides), [overrides])
  useEffect(() => saveTypeScales(typeScales), [typeScales])
  useEffect(() => saveNames(names), [names])
  useEffect(() => saveAdded(added), [added])
  useEffect(() => saveDeleted(deleted), [deleted])
  useEffect(() => savePaths(paths), [paths])
  useEffect(() => saveLocked(locked), [locked])

  // The inventory also lists every model in the local models folder (dev server only)
  useEffect(() => {
    if (!EDITOR_ENABLED) return
    let alive = true
    fetchLocalModels().then((list) => {
      if (!alive) return
      for (const m of list) if (m.side) knownSides.set(m.path, m.side)
      setLocalTiles(
        list.map((m) => {
            const d = describeLocalModel(m.path, m.side)
            return { key: d.key, label: d.label, group: d.group, url: d.url, team: d.team, thumb: m.thumb, size: m.size }
          }),
      )
    })
    return () => {
      alive = false
    }
  }, [])
  // Every tile is a file from the folders. Nothing is added to the list by hand.
  const inventoryTiles = localTiles

  // Built-in entities that are not deleted, plus the ones added from the inventory
  const items = useMemo(() => {
    const gone = new Set(deleted)
    const custom = added.map(itemFromEntry).filter((i): i is Item => i !== null)
    return [...ITEMS.filter((i) => !gone.has(i.id)), ...custom]
  }, [added, deleted, localTiles])

  const poseOf = useCallback((item: Item): Pose => overrides[item.id] ?? item.pose, [overrides])
  const selectedItem = useMemo(() => items.find((i) => i.id === selected) ?? null, [items, selected])

  // Ground point under the pointer: the ray from the camera meets the plane y = GROUND_Y.
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])
  const groundPoint = useCallback(
    (clientX: number, clientY: number): THREE.Vector3 | null => {
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      return raycaster.ray.intersectPlane(plane, hit)
    },
    [camera, gl, raycaster, plane, hit, ndc],
  )

  const drag = useRef<{ id: string; dx: number; dz: number; base: Pose } | null>(null)
  const setPose = useCallback((id: string, pose: Pose) => setOverrides((prev) => ({ ...prev, [id]: pose })), [])

  // Puts an inventory entry on the map, at the ground point under a screen position. A model that is not
  // on the site is downloaded first (the editor shows how far it has got), then it appears.
  const addAt = useCallback(
    (key: string, clientX: number, clientY: number) => {
      const inv = INVENTORY.find((i) => i.key === key)
      const p = groundPoint(clientX, clientY)
      if ((!inv && !key.startsWith('file:')) || !p) return // pointing at the sky: nothing to stand it on
      const at = new THREE.Vector3(p.x, GROUND_Y, p.z)
      const facing = facingToward(at, MAP_CENTER) + (inv && (inv.kind === 'tower' || inv.kind === 'turret') ? TURRET_YAW : 0)
      const id = `added-${Date.now().toString(36)}-${key}`
      const put = () => {
        setAdded((prev) => [...prev, { id, key, x: p.x, z: p.z, yaw: facing }])
        setSelected(id)
      }
      const path = key.startsWith('file:') ? key.slice(5) : null
      if (!path || isBundled(path)) {
        put()
        return
      }
      const name = path.replace(/\.glb$/i, '')
      setDownload({ name, progress: 0 })
      void downloadModel(path, (progress) => setDownload({ name, progress })).then((ok) => {
        if (ok) {
          setDownload(null)
          put()
        } else {
          setDownload({ name, progress: -1 })
          window.setTimeout(() => setDownload(null), 4000)
        }
      })
    },
    [groundPoint],
  )

  // Deleting a built-in entity hides it (it can be restored). An added one is removed for good.
  // Deleting plays the entity's death clip first (if its model has one), then it goes
  const removeItem = useCallback((item: Item) => {
    if (lockedSet.has(item.id)) return
    const control = clipControls.get(item.id)
    if (control?.dead) return // already dying
    const go = () => {
      if (item.id.startsWith('added-')) setAdded((prev) => prev.filter((a) => a.id !== item.id))
      else setDeleted((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))
      setSelected((cur) => (cur === item.id ? null : cur))
    }
    const lasts = control?.death() ?? null
    if (lasts === null) go()
    else window.setTimeout(go, lasts)
  }, [lockedSet])

  const beginDrag = useCallback(
    (item: Item, e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      setSelected(item.id)
      // A locked entity can be picked but not dragged: the press does nothing to it
      if (lockedSet.has(item.id)) return
      const cur = overrides[item.id] ?? item.pose
      const p = groundPoint(e.nativeEvent.clientX, e.nativeEvent.clientY)
      // Remember where on the model it was grabbed, so it does not jump to the pointer
      drag.current = { id: item.id, dx: p ? cur.x - p.x : 0, dz: p ? cur.z - p.z : 0, base: cur }
      editState.dragging = true
      const orbit = controls as unknown as { enabled: boolean } | null
      if (orbit) orbit.enabled = false
    },
    [overrides, groundPoint, controls, lockedSet],
  )

  useEffect(() => {
    if (!editing) return
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const p = groundPoint(e.clientX, e.clientY)
      if (p) setPose(d.id, { ...d.base, x: p.x + d.dx, z: p.z + d.dz })
    }
    const up = () => {
      if (!drag.current) return
      drag.current = null
      editState.dragging = false
      const orbit = controls as unknown as { enabled: boolean } | null
      if (orbit) orbit.enabled = true
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [editing, groundPoint, setPose, controls])

  const adjustItem = useCallback(
    (item: Item, change: Adjust) => {
      const cur = overrides[item.id] ?? item.pose
      const by = change.scaleBy
      if (by) {
        const key = typeKey(item)
        setTypeScales((prev) => ({ ...prev, [key]: clampScale((prev[key] ?? 1) * by) }))
      }
      // Sizes belong to the whole type, so they still apply. Turning and lifting do not.
      if (lockedSet.has(item.id)) return
      setPose(item.id, {
        ...cur,
        yaw: cur.yaw + ((change.yawDeg ?? 0) * Math.PI) / 180,
        y: (cur.y ?? 0) + (change.yBy ?? 0),
        pitch: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, (cur.pitch ?? 0) + ((change.pitchDeg ?? 0) * Math.PI) / 180)),
      })
    },
    [overrides, setPose, lockedSet],
  )
  const adjustSelected = useCallback(
    (change: Adjust) => {
      if (selectedItem) adjustItem(selectedItem, change)
    },
    [selectedItem, adjustItem],
  )

  // Drawing a route: each click on the ground adds a point, at the height of the entity. Enter or Esc
  // finishes, Backspace takes the last point back.
  const pathPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const pathHit = useMemo(() => new THREE.Vector3(), [])
  const pathsNow = useRef(paths) // the routes as they are now, for the pointer handlers below
  pathsNow.current = paths
  const strokeStarts = useRef<number[]>([]) // where each stroke of the route being drawn begins
  const startPath = useCallback((item: Item) => {
    setSelected(item.id)
    setPaths((prev) => ({ ...prev, [item.id]: [] })) // a new route replaces the old one
    strokeStarts.current = []
    setDrawingPath(item.id)
  }, [])
  // Undo takes back the last stroke
  const undoPath = useCallback((item: Item) => {
    const start = strokeStarts.current.pop()
    setPaths((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? []).slice(0, start ?? -1) }))
  }, [])
  const clearPath = useCallback((item: Item) => {
    setDrawingPath((cur) => (cur === item.id ? null : cur))
    setPaths((prev) => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
  }, [])
  useEffect(() => {
    if (!editing) setDrawingPath(null)
  }, [editing])
  useEffect(() => {
    if (!drawingPath) return
    const id = drawingPath
    const item = items.find((i) => i.id === id)
    const height = GROUND_Y + ((overrides[id] ?? item?.pose)?.y ?? 0)
    const groundAt = (e: PointerEvent): [number, number] | null => {
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      pathPlane.constant = -height
      return raycaster.ray.intersectPlane(pathPlane, pathHit) ? [round(pathHit.x), round(pathHit.z)] : null
    }
    // Press and drag on the ground to draw the route freehand. A point is added each time the pointer
    // has gone a little way from the last one, and the stroke is thinned out when it ends.
    let stroking = false
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || e.target !== gl.domElement) return
      const first = groundAt(e)
      if (!first) return
      e.stopPropagation() // not a click on the map, and the camera does not move
      e.preventDefault()
      stroking = true
      strokeStarts.current.push(pathsNow.current[id]?.length ?? 0)
      setPaths((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), first] }))
    }
    const onMove = (e: PointerEvent) => {
      if (!stroking) return
      const next = groundAt(e)
      if (!next) return
      setPaths((prev) => {
        const list = prev[id] ?? []
        const last = list[list.length - 1]
        if (last && Math.hypot(next[0] - last[0], next[1] - last[1]) < ROUTE_STEP) return prev
        return { ...prev, [id]: [...list, next] }
      })
    }
    const onUp = () => {
      if (!stroking) return
      stroking = false
      const start = strokeStarts.current[strokeStarts.current.length - 1] ?? 0
      setPaths((prev) => {
        const list = prev[id] ?? []
        return { ...prev, [id]: [...list.slice(0, start), ...simplify(list.slice(start), ROUTE_TOLERANCE)] }
      })
    }
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.key === 'Enter' || e.key === 'Escape') setDrawingPath(null)
      else if (e.key === 'Backspace') {
        e.preventDefault()
        const undo = strokeStarts.current.pop()
        setPaths((prev) => ({ ...prev, [id]: (prev[id] ?? []).slice(0, undo ?? -1) }))
      }
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [drawingPath, items, overrides, gl, camera, raycaster, ndc, pathPlane, pathHit])

  // [ and ] rotate the selected item. Typing in a field never rotates anything.
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const fine = e.shiftKey
      switch (e.key) {
        case '[':
        case '{':
          adjustSelected({ yawDeg: fine ? -1 : -5 })
          break
        case ']':
        case '}':
          adjustSelected({ yawDeg: fine ? 1 : 5 })
          break
        case '-':
        case '_':
          adjustSelected({ scaleBy: fine ? 1 / 1.02 : 1 / 1.1 })
          break
        case '=':
        case '+':
          adjustSelected({ scaleBy: fine ? 1.02 : 1.1 })
          break
        case ',':
        case '<':
          adjustSelected({ yBy: fine ? -0.05 : -0.25 })
          break
        case '.':
        case '>':
          adjustSelected({ yBy: fine ? 0.05 : 0.25 })
          break
        case 'Delete':
        case 'Backspace':
          if (selectedItem) removeItem(selectedItem)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, adjustSelected, selectedItem, removeItem])

  const resetItem = useCallback(
    (item: Item) => {
      if (lockedSet.has(item.id)) return
      setOverrides((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
    },
    [lockedSet],
  )

  const togglePanel = useCallback(() => {
    setPanelOpen((prev) => !prev)
  }, [])

  const toggleBoxes = useCallback(() => {
    setBoxes((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(BOXES_KEY, next ? '1' : '0')
      } catch {
        // Storage can be blocked. The toggle still works for this session.
      }
      return next
    })
  }, [])

  // The raw text is kept while typing, so the field can be emptied completely. An empty name
  // only goes back to the default one when the field is left.
  // Makes another of the same entity, a few units to the side of it. It is an ordinary added
  // entity, so it can be moved, locked and deleted on its own.
  const duplicateItem = useCallback(
    (item: Item) => {
      const entry = added.find((a) => a.id === item.id)
      const key = entry
        ? entry.key
        : item.kind === 'monster' && item.monster
          ? `monster-${item.monster.name}`
          : item.team
            ? `${item.team}-${item.kind}`
            : null
      if (!key) return
      const pose = overrides[item.id] ?? item.pose
      const id = `added-${Date.now().toString(36)}-${key}`
      setAdded((prev) => [...prev, { id, key, x: pose.x + 3, z: pose.z + 3, yaw: pose.yaw }])
      if (pose.y || pose.pitch) setOverrides((prev) => ({ ...prev, [id]: { x: pose.x + 3, z: pose.z + 3, yaw: pose.yaw, y: pose.y, pitch: pose.pitch } }))
      // A copy is numbered after the original: tier1_top_2, tier1_top_3 ...
      const original = (names[item.id] || item.name).replace(/_\d+$/, '')
      const taken = new Set([...Object.values(names), ...ITEMS.map((i) => i.name)])
      let n = 2
      while (taken.has(`${original}_${n}`)) n++
      setNames((prev) => ({ ...prev, [id]: `${original}_${n}` }))
      setSelected(id)
    },
    [added, overrides, names],
  )

  const toggleLock = useCallback((item: Item) => {
    setLocked((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]))
  }, [])

  const renameItem = useCallback((item: Item, name: string) => {
    setNames((prev) => ({ ...prev, [item.id]: name }))
  }, [])
  const finishRename = useCallback((item: Item) => {
    setNames((prev) => {
      if ((prev[item.id] ?? 'x').trim() !== '') return prev
      const next = { ...prev }
      delete next[item.id]
      return next
    })
  }, [])

  const editValue = useMemo<EditContextValue>(
    () => ({ interactive: !hideTags, version: toolbarVersion, editing, boxes: boxes && !hideTags, selected, beginDrag, adjust: adjustItem, reset: resetItem, select: setSelected, typeScales, names, rename: renameItem, finishRename, remove: removeItem, locked: lockedSet, toggleLock, duplicate: duplicateItem, paths, drawingPath, startPath, endPath: () => setDrawingPath(null), undoPath, clearPath }),
    [toolbarVersion, editing, boxes, hideTags, selected, beginDrag, adjustItem, resetItem, typeScales, names, renameItem, finishRename, removeItem, lockedSet, toggleLock, duplicateItem, paths, drawingPath, startPath, undoPath, clearPath],
  )

  // The editor's pill and panel live in the page (LayoutEditorUI), outside this canvas. Publish
  // what they show, and hand them the actions they can trigger.
  const exported = useMemo(() => {
    const out: Record<string, unknown> = {}
    const live = new Set(items.map((i) => i.id))
    for (const [id, p] of Object.entries(overrides)) {
      if (!live.has(id)) continue
      out[id] = { x: round(p.x), z: round(p.z), yawDeg: round(deg(p.yaw), 1), y: round(p.y ?? 0), ...(p.pitch ? { pitchDeg: round(deg(p.pitch), 1) } : {}) }
    }
    // Routes drawn for the entities
    const routes = Object.fromEntries(Object.entries(paths).filter(([id, pts]) => live.has(id) && pts.length > 0))
    if (Object.keys(routes).length > 0) out.__paths = routes
    // Sizes shared by every entity of a type
    const sizes = Object.fromEntries(Object.entries(typeScales).map(([k, v]) => [k, round(v, 3)]))
    if (Object.keys(sizes).length > 0) out.__typeScales = sizes
    const named = Object.fromEntries(Object.entries(names).filter(([, v]) => v.trim() !== ''))
    if (Object.keys(named).length > 0) out.__names = named
    // Entities added from the inventory (their moved pose, if any, is in the entries above) and
    // the built-in ones that were deleted
    if (added.length > 0) {
      out.__added = added.map((a) => ({ id: a.id, type: a.key, x: round(a.x), z: round(a.z), yawDeg: round(deg(a.yaw), 1) }))
    }
    if (deleted.length > 0) out.__deleted = deleted
    const lockedLive = locked.filter((id) => live.has(id))
    if (lockedLive.length > 0) out.__locked = lockedLive
    return JSON.stringify(out, null, 1)
  }, [overrides, typeScales, names, items, added, deleted, locked, paths])

  useEffect(() => {
    const pose = selectedItem ? overrides[selectedItem.id] ?? selectedItem.pose : null
    editorStore.setSnapshot({
      panelOpen,
      boxes,
      selected: selectedItem ? names[selectedItem.id] || selectedItem.name : null,
      readout:
        selectedItem && pose
          ? `x ${round(pose.x, 1)} · z ${round(pose.z, 1)} · yaw ${round(deg(pose.yaw), 1)}°\nsize ×${round(typeScales[typeKey(selectedItem)] ?? 1, 2)} (${typeLabel(selectedItem)}) · height ${round(pose.y ?? 0, 2)}${pose.pitch ? ` · pitch ${round(deg(pose.pitch), 1)}°` : ''}`
          : null,
      exported,
      count: Object.keys(overrides).length,
      deleted: deleted.length,
      inventory: inventoryTiles,
      download,
    })
  }, [panelOpen, boxes, selectedItem, overrides, typeScales, names, exported, deleted, inventoryTiles, download])

  useEffect(() => {
    editorStore.actions.toggle = togglePanel
    editorStore.actions.toggleBoxes = toggleBoxes
    editorStore.actions.clear = () => {
      // Back to the default layout (riftLayoutDefault.ts), not to an empty one
      setOverrides(fresh(DEFAULT_OVERRIDES))
      setTypeScales(fresh(DEFAULT_SCALES))
      setNames(fresh(DEFAULT_NAMES))
      setAdded(fresh(DEFAULT_ADDED))
      setDeleted(fresh(DEFAULT_DELETED))
      setLocked(fresh(DEFAULT_LOCKED))
      setPaths(fresh(DEFAULT_PATHS))
      setDrawingPath(null)
      openToolbars.clear()
      notifyToolbars()
      saveOpenToolbars([])
      setToolbarVersion((v) => v + 1)
    }
    editorStore.actions.restore = () => setDeleted([])
    editorStore.actions.addAt = addAt
    return () => {
      editorStore.actions.toggle = () => {}
      editorStore.actions.toggleBoxes = () => {}
      editorStore.actions.clear = () => {}
      editorStore.actions.restore = () => {}
      editorStore.actions.addAt = () => {}
    }
  }, [togglePanel, toggleBoxes, addAt, exported])

  return (
    <LockContext.Provider value={setLock}>
      <EditContext.Provider value={editValue}>
        <group>
          {items.map((item) => (
            <Placed key={item.id} item={item} pose={poseOf(item)} />
          ))}
          {EDITOR_ENABLED && <DropMarker />}

          {editing &&
            Object.entries(paths).map(([id, points]) => {
              const item = items.find((i) => i.id === id)
              // A route shows only while the floating editor of its entity is open (or it is being drawn)
              if (!item || points.length === 0 || !(drawingPath === id || openToolbars.has(id))) return null
              return <RouteLine key={id} points={points} y={GROUND_Y + (poseOf(item).y ?? 0) + 0.15} active={drawingPath === id} />
            })}

          {lock && !hideTags && (
            <Html position={lock.anchor} center>
              <div className="rift-lock" style={{ '--lock-color': lock.color } as CSSProperties}>
                <span className="rift-lock__title">{lock.title}</span>
                <span className="rift-lock__sub">{lock.subtitle}</span>
              </div>
            </Html>
          )}

        </group>
      </EditContext.Provider>
    </LockContext.Provider>
  )
}
