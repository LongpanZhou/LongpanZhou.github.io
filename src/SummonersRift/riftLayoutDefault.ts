import type { AddedEntry, Pose } from './riftEdit'
import saved from './defaultLayout.json'

// The default layout of the rift, exported from the layout editor ("copy layout"). It is used
// when the browser has no saved layout of its own, and "reset to default" in the editor brings it
// back. Every entry is a model from the local models folder (served by the dev server only).
//
// Each row is [id suffix, file, x, z, yaw in degrees, height above the ground]. The id is
// `added-<suffix>-file:<file>`. x and z are world units.
const ROWS: [string, string, number, number, number, number][] = [
  ['mw62qc5s', 'nexus.glb', -132.24, 132.6, 44.3, -6.9],
  ['mw62r8mh', 'turrets.glb', -125.56, 130.68, 122, -3.9],
  ['mw62rhfk', 'turrets.glb', -130.33, 126.09, 148.9, -4],
  ['mw62vlkj', 'turrets.glb', -111.01, 111.96, 145.7, -4.2],
  ['mw62vkfg', 'turrets.glb', -136.09, 105.24, 166.3, -4.1],
  ['mw62vosq', 'turrets.glb', -104.62, 136.35, 89.6, -3.8],
  ['mw637uw9', 'nexus_16.glb', -115.8, 116.74, 133.1, -5.3],
  ['mw63ap35', 'nexus_16.glb', -112.47, 136.47, 133.1, -5.3],
  ['mw63asca', 'nexus_16.glb', -136.12, 113.19, 133.1, -5.3],
  ['mw63gtq2', 'turrets.glb', -133.43, 82.14, 166.3, -4.3],
  ['mw63hatw', 'turrets.glb', -138.6, 44.91, 166.3, -4.3],
  ['mw63i3kd', 'turrets.glb', -97.8, 101.12, 130.7, -4.4],
  ['mw63iki7', 'turrets.glb', -89.6, 85.13, 130.7, -4.4],
  ['mw63jk7k', 'turrets.glb', -79.14, 133.88, 89.6, -4.2],
  ['mw63jzr8', 'turrets.glb', -42.79, 139.02, 89.6, -4.3],
  ['mw63l8x2', 'nexus_1.glb', -15.77, 16.58, -44.1, -7.9],
  ['mw63oyv0', 'nexus_17.glb', -31.91, 32.45, -50.7, -5.6],
  ['mw63pkso', 'nexus_17.glb', -34.69, 12.22, -50.7, -5.6],
  ['mw63pohm', 'nexus_17.glb', -11.62, 35.95, -50.7, -5.6],
  ['mw63rky2', 'turret_1.glb', -17.11, 22.35, -26.6, -3.5],
  ['mw63tz1s', 'turret_1.glb', -21.66, 17.75, -56.6, -3.5],
  ['mw63vx0x', 'turret_1.glb', -36.34, 36.94, -41.6, -3.5],
  ['mw63wir2', 'turret_1.glb', -11.46, 42.59, 3.4, -3.5],
  ['mw63wrn3', 'turret_1.glb', -42.69, 12.43, -86.6, -3.5],
  ['mw63yo23', 'turret_1.glb', -69.04, 14.78, -86.6, -4],
  ['mw63yv3m', 'turret_1.glb', -105.22, 10.31, -86.6, -4],
  ['mw63zvy1', 'turret_1.glb', -50.46, 48.23, -41.6, -4],
  ['mw640lc9', 'turret_1.glb', -58.3, 63.76, -41.6, -4],
  ['mw641pde', 'turret_1.glb', -14.97, 66.79, 3.4, -4],
  ['mw642u8u', 'turret_1.glb', -9.86, 103.81, 3.4, -4],
  ['mw644fsa', 'murk_wolf.glb', -109.97, 84.2, 312.1, -0.5],
  ['mw644i2b', 'murk_wolf_small.glb', -108.26, 84.59, 310.4, -0.6],
  ['mw646qn6', 'murk_wolf_small.glb', -110.66, 82.55, 310.4, -0.6],
  ['mw6471yn', 'blue_sentinel.glb', -109.41, 69.82, 227.1, -0.4],
  ['mw64859b', 'gromp.glb', -126.29, 64.13, 91.3, -0.6],
  ['mw649kq0', 'blue_sentinel.glb', -38.38, 79.01, 422.1, -0.4],
  ['mw64a7gt', 'gromp.glb', -21.49, 84.7, 288.3, -0.6],
  ['mw64b6ad', 'murk_wolf.glb', -37.81, 64.63, 477.1, -0.5],
  ['mw64c9x7', 'murk_wolf_small.glb', -37.12, 66.29, 490.4, -0.6],
  ['mw64duhx', 'murk_wolf_small.glb', -39.52, 64.25, 490.4, -0.6],
  ['mw64epqo', 'red_brambleback.glb', -71.34, 109.11, -44.7, -0.3],
  ['mw64g7ry', 'red_brambleback.glb', -76.44, 39.73, 120.3, -0.3],
  ['mw64hfx3', 'krug_small.glb', -82.73, 26.52, 166.8, -0.5],
  ['mw64hdrc', 'krug.glb', -84.8, 27.05, 183.6, -0.5],
  ['mw64ihps', 'krug_small.glb', -65.05, 122.32, 361.8, -0.5],
  ['mw64jcha', 'krug.glb', -62.98, 121.78, 363.6, -0.5],
  ['mw64kof6', 'raptor.glb', -79.34, 93.82, 403.9, -0.5],
  ['mw64km0f', 'raptor_small.glb', -77.73, 93.11, 353.6, -0.5],
  ['mw64o6n6', 'raptor_small.glb', -76.86, 94.53, 293.6, -0.5],
  ['mw64o83y', 'raptor_small.glb', -79.91, 96.59, 368.6, -0.5],
  ['mw64o8n9', 'raptor_small.glb', -77.13, 96.82, 338.6, -0.5],
  ['mw64o98p', 'raptor_small.glb', -78.61, 95.66, 398.6, -0.5],
  ['mw64q7ra', 'raptor_small.glb', -70.05, 55.72, 518.6, -0.5],
  ['mw64qkaa', 'raptor.glb', -68.44, 55.01, 583.9, -0.5],
  ['mw64r8eo', 'raptor_small.glb', -70.92, 54.3, 503.6, -0.5],
  ['mw64r8sz', 'raptor_small.glb', -69.17, 53.18, 593.6, -0.5],
  ['mw64r9bd', 'raptor_small.glb', -70.65, 52.02, 518.6, -0.5],
  ['mw64r9vk', 'raptor_small.glb', -67.88, 52.24, 563.6, -0.5],
]

const idOf = (suffix: string, file: string) => `added-${suffix}-file:${file}`
const rad = (degrees: number) => (degrees * Math.PI) / 180

const SEED_ADDED: AddedEntry[] = ROWS.map(([suffix, file, x, z, yawDeg]) => ({
  id: idOf(suffix, file),
  key: `file:${file}`,
  x,
  z,
  yaw: rad(yawDeg),
}))

// Where each of them ended up (the same as where it was added, plus its height)
const SEED_OVERRIDES: Record<string, Pose> = Object.fromEntries(
  ROWS.map(([suffix, file, x, z, yawDeg, y]) => [idOf(suffix, file), { x, z, yaw: rad(yawDeg), y }]),
)

// Sizes shared by every entity of a type: base height times this. The built-in nexus, the lane
// towers and the monsters are keyed by their kind or name; the other models by `file:<path>`.
const SEED_TYPE_SCALES: Record<string, number> = {
  tower: 1.629,
  nexus: 1.276,
  'Blue sentinel': 1.276,
  'Red brambleback': 1.551,
  'file:nexus_16.glb': 0.952,
  'file:nexus_1.glb': 1.477,
  'file:turret_1.glb': 1.477,
  'file:murk_wolf_small.glb': 0.585,
  'file:raptor_small.glb': 0.458,
  'file:raptor.glb': 0.823,
  Dragon: 3.225,
  'Baron Nashor': 1.407,
  'Rift Herald': 1.34,
}

const NAMES: [string, string, string][] = [
  ['mw62r8mh', 'turrets.glb', 'nexus_turret_left'],
  ['mw62rhfk', 'turrets.glb', 'nexus_turret_right'],
  ['mw63ap35', 'nexus_16.glb', 'top_inhibitor'],
  ['mw637uw9', 'nexus_16.glb', 'mid_inhibitor'],
  ['mw63asca', 'nexus_16.glb', 'bot_inhibitor'],
  ['mw62vkfg', 'turrets.glb', 'tier3_bot'],
  ['mw62vlkj', 'turrets.glb', 'tier3_mid'],
  ['mw62vosq', 'turrets.glb', 'tier3_top'],
  ['mw63gtq2', 'turrets.glb', 'tier2_bot'],
  ['mw63hatw', 'turrets.glb', 'tier1_bot'],
  ['mw63i3kd', 'turrets.glb', 'tier2_mid'],
  ['mw63iki7', 'turrets.glb', 'tier1_mid'],
  ['mw63jk7k', 'turrets.glb', 'tier2_top'],
  ['mw63jzr8', 'turrets.glb', 'tier1_top'],
  ['mw63l8x2', 'nexus_1.glb', 'nexus'],
  ['mw63pkso', 'nexus_17.glb', 'bot_inhibitor'],
  ['mw63oyv0', 'nexus_17.glb', 'mid_inhibitor'],
  ['mw63pohm', 'nexus_17.glb', 'top_inhibitor'],
  ['mw63tz1s', 'turret_1.glb', 'nexus_left_turret'],
  ['mw63rky2', 'turret_1.glb', 'nexus_right_turret'],
  ['mw63vx0x', 'turret_1.glb', 'tier3_mid'],
  ['mw63wir2', 'turret_1.glb', 'tier3_top'],
  ['mw63wrn3', 'turret_1.glb', 'tier3_bot'],
  ['mw63yo23', 'turret_1.glb', 'tier2_bot'],
  ['mw63yv3m', 'turret_1.glb', 'tier1_bot'],
  ['mw63zvy1', 'turret_1.glb', 'tier2_mid'],
  ['mw640lc9', 'turret_1.glb', 'tier1_mid'],
  ['mw641pde', 'turret_1.glb', 'tier2_top'],
  ['mw642u8u', 'turret_1.glb', 'tier1_top'],
]
const SEED_NAMES: Record<string, string> = Object.fromEntries(
  NAMES.map(([suffix, file, name]) => [idOf(suffix, file), name]),
)

// Every added entity is locked, except one raptor
const SEED_LOCKED: string[] = SEED_ADDED.map((a) => a.id).filter((id) => !id.includes('mw64r8sz'))

// Built-in entities that are hidden: the lane towers, the nexus, the turrets and the monsters that
// the added models replace (the one built-in that stays is red-tower-3)
const SEED_DELETED: string[] = [
  'blue-tower-0',
  'blue-tower-2',
  'camp-Gromp-blue',
  'camp-Blue sentinel-blue',
  'blue-tower-1',
  'camp-Scuttle crab-red',
  'camp-Krug-red',
  'red-tower-5',
  'camp-Red brambleback-red',
  'camp-Void grubs-blue',
  'camp-Murk wolf-blue',
  'blue-tower-4',
  'camp-Red brambleback-blue',
  'camp-Krug-blue',
  'blue-tower-5',
  'camp-Void grubs-red',
  'camp-Scuttle crab-blue',
  'camp-Murk wolf-red',
  'camp-Blue sentinel-red',
  'camp-Gromp-red',
  'red-tower-1',
  'red-tower-2',
  'blue-tower-3',
  'red-tower-0',
  'red-turret-1',
  'red-nexus',
  'red-turret-0',
  'red-tower-4',
  'blue-nexus',
  'blue-turret-1',
  'blue-turret-0',
]

// ---------------------------------------------------------------------------------------------
// The layout previously saved from the editor (defaultLayout.json) replaces the built-in one above.
// It has the shape of the editor's "copy layout" export.
interface SavedLayout {
  __savedAt?: string
  __added?: { id: string; type: string; x: number; z: number; yawDeg: number }[]
  __typeScales?: Record<string, number>
  __names?: Record<string, string>
  __deleted?: string[]
  __locked?: string[]
  __paths?: Record<string, [number, number][]>
  [id: string]: unknown
}
const layout = saved as unknown as SavedLayout
const hasSaved = typeof layout.__savedAt === 'string'

export const DEFAULT_ADDED: AddedEntry[] = hasSaved
  ? (layout.__added ?? []).map((a) => ({ id: a.id, key: a.type, x: a.x, z: a.z, yaw: rad(a.yawDeg) }))
  : SEED_ADDED

export const DEFAULT_OVERRIDES: Record<string, Pose> = hasSaved
  ? Object.fromEntries(
      Object.entries(layout)
        .filter(([id, value]) => !id.startsWith('__') && typeof value === 'object' && value !== null)
        .map(([id, value]) => {
          const v = value as { x: number; z: number; yawDeg: number; y?: number; pitchDeg?: number }
          return [id, { x: v.x, z: v.z, yaw: rad(v.yawDeg), y: v.y ?? 0, ...(v.pitchDeg ? { pitch: rad(v.pitchDeg) } : {}) }]
        }),
    )
  : SEED_OVERRIDES

export const DEFAULT_TYPE_SCALES: Record<string, number> = hasSaved ? (layout.__typeScales ?? {}) : SEED_TYPE_SCALES
export const DEFAULT_NAMES: Record<string, string> = hasSaved ? (layout.__names ?? {}) : SEED_NAMES
export const DEFAULT_LOCKED: string[] = hasSaved ? (layout.__locked ?? []) : SEED_LOCKED
export const DEFAULT_DELETED: string[] = hasSaved ? (layout.__deleted ?? []) : SEED_DELETED

// Routes drawn for the scuttle crab, by entity id: it walks along them (see RiftModels.tsx)
export const DEFAULT_PATHS: Record<string, [number, number][]> = hasSaved ? { ...(layout.__paths ?? {}) } : {}
