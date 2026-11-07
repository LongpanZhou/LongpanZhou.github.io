import { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Html, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneRig } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { BLUE, GOLD, GROUND_Y, LANES, NEXUS_AT, NEXUS_TURRET_SPOTS, RED, TOWER_SPOTS, place } from './riftLayout'
import type { Fraction, Team } from './riftLayout'
import { describeLocalModel, fetchLocalModels } from './localModels'
import { DEFAULT_ADDED, DEFAULT_DELETED, DEFAULT_LOCKED, DEFAULT_NAMES, DEFAULT_OVERRIDES, DEFAULT_TYPE_SCALES } from './riftLayoutDefault'
import { BAKED_POSES } from './riftPoses'
import { EDITOR_ENABLED, IS_LOCAL, editState, editorStore, loadAdded, loadOpenToolbars, loadDeleted, loadLocked, loadNames, loadOverrides, loadTypeScales, saveAdded, saveOpenToolbars, saveDeleted, saveLocked, saveNames, saveOverrides, saveTypeScales } from './riftEdit'
import type { AddedEntry, InventoryTile, Pose } from './riftEdit'
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
    { id: 'pit-Void grubs-1', monster: VOID_GRUBS, x: -48.04, z: 107.52, yawDeg: -138.3, y: -2 },
    { id: 'pit-Void grubs-2', monster: VOID_GRUBS, x: -47.86, z: 102.31, yawDeg: -33.3, y: -2 },
    { id: 'pit-Void grubs-3', monster: VOID_GRUBS, x: -52.38, z: 103.97, yawDeg: 71.7, y: -2 },
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

const ITEMS: Item[] = (() => {
  const items: Item[] = []
  for (const team of ['blue', 'red'] as Team[]) {
    TOWER_SPOTS.forEach((spot, i) => {
      items.push({
        id: `${team}-tower-${i}`,
        name: `turrets (${team}) ${i + 1}`,
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
        name: `turrets (${team}) guard ${i + 1}`,
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
      name: `nexus (${team})`,
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
        name: `${monster.file.replace(/\.glb$/i, '')} (${team} side)`,
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
      name: pit.monster.name,
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
  return cloneRig(template)
}

// A static League model, fitted to `height` and tinted when a team colour is given.
function FittedModel({ url, height, tint }: { url: string; height: number; tint?: string }) {
  const gltf = useGLTF(url)
  const scene = useMemo(() => fittedInstance(url, gltf.scene, height, tint), [url, gltf, height, tint])
  return <primitive object={scene} />
}

// The clip to loop for a model that does not name one: a plain idle, not an aggro or transition clip.
function pickIdle(animations: THREE.AnimationClip[]): string | null {
  const names = animations.map((a) => a.name)
  const plain = (n: string) => /idle/i.test(n) && !/aggro|a2n|n2a|spawn|alert|death|attack/i.test(n)
  return names.find((n) => /^idle(1)?(_base)?$/i.test(n)) ?? names.find(plain) ?? names.find((n) => /idle/i.test(n)) ?? names[0] ?? null
}

// A monster with its own animation mixer. It stands still and loops its idle clip.
function MonsterModel({ url, height, clip }: { url: string; height: number; clip?: string }) {
  const gltf = useGLTF(url)
  const root = useRef<THREE.Group>(null)
  const scene = useMemo(() => fittedInstance(url, gltf.scene, height), [url, gltf, height])
  const { actions } = useAnimations(gltf.animations, root)

  useEffect(() => {
    const name = clip && actions[clip] ? clip : pickIdle(gltf.animations)
    const action = name ? actions[name] : null
    action?.reset().fadeIn(0.25).play()
    return () => {
      action?.fadeOut(0.25)
    }
  }, [actions, clip, gltf.animations])

  return (
    <group ref={root}>
      <primitive object={scene} />
    </group>
  )
}

interface EditContextValue {
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
}
const EditContext = createContext<EditContextValue>({ version: 0, editing: false, boxes: false, selected: null, beginDrag: () => {}, adjust: () => {}, reset: () => {}, select: () => {}, typeScales: {}, names: {}, rename: () => {}, finishRename: () => {}, remove: () => {}, locked: new Set(), toggleLock: () => {}, duplicate: () => {} })

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
}) {
  const [collapsed, setCollapsed] = useState(() => !openToolbars.has(item.id))
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
  const selected = edit.editing && edit.selected === item.id
  // The item's own size times its type's size, so one resize changes every entity of the type
  const size = edit.typeScales[typeKey(item)] ?? 1
  const color = item.team ? TEAM_COLOR[item.team] : GOLD

  const body =
    item.kind === 'monster' && item.monster ? (
      <MonsterModel url={`${M}${item.monster.file}`} height={item.height} clip={item.monster.idle} />
    ) : item.kind === 'model' && item.url ? (
      <MonsterModel url={item.url} height={item.height} />
    ) : (
      <FittedModel
        url={item.kind === 'nexus' ? NEXUS_MODEL : TURRET}
        height={item.height}
        // Towers and turrets keep the model's own colours. Only the nexus is team-tinted.
        tint={item.kind === 'nexus' ? color : undefined}
      />
    )

  return (
    <group
      position={[pose.x, GROUND_Y + (pose.y ?? 0), pose.z]}
      rotation={[0, pose.yaw, 0]}
      scale={size}
      onPointerDown={edit.editing ? (e) => edit.beginDrag(item, e) : undefined}
      onClick={
        edit.editing
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
      {edit.editing && edit.boxes && (
        <Html position={[0, item.height + 1.2, 0]} center distanceFactor={30} zIndexRange={[2500, 0]}>
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
          />
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
  scaleBy?: number
  yBy?: number
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
// hideTags turns the floating tags over the models (and the editing that goes with them) off for
// as long as it is set, without touching the saved setting, so it comes back as it was.
export default function RiftModels({ hideTags = false }: { hideTags?: boolean }) {
  const [lock, setLock] = useState<LockInfo | null>(null)
  const [overrides, setOverrides] = useState<Record<string, Pose>>(loadCleanOverrides)
  const [selected, setSelected] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(START_EDITING)
  const [boxes, setBoxes] = useState(() => {
    try {
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
  const [toolbarVersion, setToolbarVersion] = useState(0)
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
            return { key: d.key, label: d.label, group: d.group, url: d.url, team: d.team }
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

  // Puts an inventory entry on the map, at the ground point under a screen position
  const addAt = useCallback(
    (key: string, clientX: number, clientY: number) => {
      const inv = INVENTORY.find((i) => i.key === key)
      const p = groundPoint(clientX, clientY)
      if ((!inv && !key.startsWith('file:')) || !p) return // pointing at the sky: nothing to stand it on
      const at = new THREE.Vector3(p.x, GROUND_Y, p.z)
      const facing = facingToward(at, MAP_CENTER) + (inv && (inv.kind === 'tower' || inv.kind === 'turret') ? TURRET_YAW : 0)
      const id = `added-${Date.now().toString(36)}-${key}`
      setAdded((prev) => [...prev, { id, key, x: p.x, z: p.z, yaw: facing }])
      setSelected(id)
    },
    [groundPoint],
  )

  // Deleting a built-in entity hides it (it can be restored). An added one is removed for good.
  const removeItem = useCallback((item: Item) => {
    if (lockedSet.has(item.id)) return
    if (item.id.startsWith('added-')) setAdded((prev) => prev.filter((a) => a.id !== item.id))
    else setDeleted((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))
    setSelected((cur) => (cur === item.id ? null : cur))
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
      if (pose.y) setOverrides((prev) => ({ ...prev, [id]: { x: pose.x + 3, z: pose.z + 3, yaw: pose.yaw, y: pose.y } }))
      if (names[item.id]) setNames((prev) => ({ ...prev, [id]: `${names[item.id]} copy` }))
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
    () => ({ version: toolbarVersion, editing, boxes: boxes && !hideTags, selected, beginDrag, adjust: adjustItem, reset: resetItem, select: setSelected, typeScales, names, rename: renameItem, finishRename, remove: removeItem, locked: lockedSet, toggleLock, duplicate: duplicateItem }),
    [toolbarVersion, editing, boxes, hideTags, selected, beginDrag, adjustItem, resetItem, typeScales, names, renameItem, finishRename, removeItem, lockedSet, toggleLock, duplicateItem],
  )

  // The editor's pill and panel live in the page (LayoutEditorUI), outside this canvas. Publish
  // what they show, and hand them the actions they can trigger.
  const exported = useMemo(() => {
    const out: Record<string, unknown> = {}
    const live = new Set(items.map((i) => i.id))
    for (const [id, p] of Object.entries(overrides)) {
      if (!live.has(id)) continue
      out[id] = { x: round(p.x), z: round(p.z), yawDeg: round(deg(p.yaw), 1), y: round(p.y ?? 0) }
    }
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
  }, [overrides, typeScales, names, items, added, deleted, locked])

  useEffect(() => {
    const pose = selectedItem ? overrides[selectedItem.id] ?? selectedItem.pose : null
    editorStore.setSnapshot({
      panelOpen,
      boxes,
      selected: selectedItem ? names[selectedItem.id] || selectedItem.name : null,
      readout:
        selectedItem && pose
          ? `x ${round(pose.x, 1)} · z ${round(pose.z, 1)} · yaw ${round(deg(pose.yaw), 1)}°\nsize ×${round(typeScales[typeKey(selectedItem)] ?? 1, 2)} (${typeLabel(selectedItem)}) · height ${round(pose.y ?? 0, 2)}`
          : null,
      exported,
      count: Object.keys(overrides).length,
      deleted: deleted.length,
      inventory: inventoryTiles,
    })
  }, [panelOpen, boxes, selectedItem, overrides, typeScales, names, exported, deleted, inventoryTiles])

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
      openToolbars.clear()
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

          {lock && (
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
