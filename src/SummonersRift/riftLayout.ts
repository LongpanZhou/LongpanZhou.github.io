import * as THREE from 'three'

// Single source of truth for where things sit on the Summoner's Rift model.
// Used by RiftUnits (3D) and anything 2D that mirrors the map (minimap, HUD).

// Playable footprint in world units. Measured from the map's vertices (scripts/rift-opt.glb) after
// its root rotation and the 0.01 scale on <primitive>: local x -> world x * 0.01,
// local y -> world z * 0.01, and up is -local z.
export const MAP_MIN_X = -159
export const MAP_MAX_X = 10
export const MAP_MIN_Z = -4
export const MAP_MAX_Z = 156
export const GROUND_Y = 1

// Which corner the blue base sits in. The GLB doesn't say, so this is a guess.
// If the bases look swapped in your build, set it to false.
export const BLUE_AT_ORIGIN = true

export const BLUE = '#0AC8FF'
export const RED = '#FF4D4D'
export const GOLD = '#C8AA6E'
export const CREAM = '#F0E6D2'
export const STONE = '#1b2a40'

export type Team = 'blue' | 'red'
export type Fraction = [number, number]

// Everything below is written as fractions of the map in the blue frame, where the
// blue base is at (0, 0). Red is the point reflection (1 - u, 1 - v), so each lane
// gets towers from both teams, the same as the real map.
export const TOWER_SPOTS: Fraction[] = [
  [0.08, 0.28], [0.08, 0.5], // top lane, blue side
  [0.25, 0.25], [0.36, 0.36], // mid lane
  [0.28, 0.08], [0.5, 0.08], // bottom lane, blue side
]
export const NEXUS_AT: Fraction = [0.05, 0.05]
export const CHAMPIONS: Record<Team, { name: string; at: Fraction }[]> = {
  blue: [
    { name: 'Ahri', at: [0.12, 0.1] },
    { name: 'Lux', at: [0.1, 0.13] },
    { name: 'Jinx', at: [0.15, 0.14] },
    { name: 'Ashe', at: [0.13, 0.17] },
    { name: 'Garen', at: [0.17, 0.11] },
  ],
  red: [
    { name: 'Zed', at: [0.12, 0.1] },
    { name: 'Yasuo', at: [0.1, 0.13] },
    { name: 'Katarina', at: [0.15, 0.14] },
    { name: 'Draven', at: [0.13, 0.17] },
    { name: 'Darius', at: [0.17, 0.11] },
  ],
}
// Blue-frame lane paths, from the blue nexus to the red nexus
export const LANES: Fraction[][] = [
  [[0.05, 0.06], [0.08, 0.28], [0.08, 0.5], [0.1, 0.88], [0.5, 0.92], [0.72, 0.92], [0.94, 0.94]], // top
  [[0.05, 0.05], [0.25, 0.25], [0.36, 0.36], [0.5, 0.5], [0.64, 0.64], [0.75, 0.75], [0.95, 0.95]], // mid
  [[0.06, 0.05], [0.28, 0.08], [0.5, 0.08], [0.9, 0.1], [0.92, 0.5], [0.92, 0.72], [0.94, 0.94]], // bottom
]
export const PITS: { at: Fraction; color: string; crystalY: number; radius: number }[] = [
  { at: [0.5, 0.5], color: '#B066FF', crystalY: 3.4, radius: 5 }, // Baron-style center pit
  { at: [0.66, 0.3], color: '#FF8A3D', crystalY: 2.6, radius: 3.8 }, // Dragon-style pit
]

// Inhibitor spots sit just behind each lane's inner tower, one per lane.
export const INHIBITOR_SPOTS: Fraction[] = [
  [0.07, 0.17], // top lane
  [0.16, 0.16], // mid lane
  [0.17, 0.07], // bottom lane
]
// Two turrets guarding each nexus, placed just outside the nexus footprint.
export const NEXUS_TURRET_SPOTS: Fraction[] = [
  [0.088, 0.04],
  [0.04, 0.088],
]

// Map a blue-frame or red-frame fraction to a world position on the ground.
export function place(team: Team, [u, v]: Fraction): THREE.Vector3 {
  let a = team === 'red' ? 1 - u : u
  let b = team === 'red' ? 1 - v : v
  if (!BLUE_AT_ORIGIN) {
    a = 1 - a
    b = 1 - b
  }
  return new THREE.Vector3(
    MAP_MIN_X + a * (MAP_MAX_X - MAP_MIN_X),
    GROUND_Y,
    MAP_MIN_Z + b * (MAP_MAX_Z - MAP_MIN_Z),
  )
}

// Inverse for 2D views: world x/z -> fraction in the (unreflected) map frame, 0..1.
export function worldToFraction(x: number, z: number): Fraction {
  let u = (x - MAP_MIN_X) / (MAP_MAX_X - MAP_MIN_X)
  let v = (z - MAP_MIN_Z) / (MAP_MAX_Z - MAP_MIN_Z)
  if (!BLUE_AT_ORIGIN) {
    u = 1 - u
    v = 1 - v
  }
  return [u, v]
}
