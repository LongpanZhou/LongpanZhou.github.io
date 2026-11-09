// Picking the right clips out of a monster model's animations by their names, and running them. The League
// models carry dozens each: spawn, idle variants, attacks, spells, taunts, deaths, runs, and the small
// transitions between them. A model on the map plays its spawn once when the site has loaded, then settles
// into its idle (or its run while it walks a route). Entities that stand together (a jungle camp, the
// turrets round a nexus) share their moves: the group picks one kind of move and each member plays its own
// version of it at the same time.
import * as THREE from 'three'
import { clone as cloneRig } from 'three/examples/jsm/utils/SkeletonUtils.js'

export interface ClipPlan {
  idle: string | null // loops while it stands
  run: string | null // loops while it walks a route
  spawn: string | null // played once when the model appears
  death: string | null // played once when the entity is deleted, before it goes
  show: string[] // played now and then, one at a time, between stretches of idle
}

// An idle that is the model's plain standing pose: not an aggressive, alert or transitional one
function plainIdle(names: string[]): string | null {
  const plain = (n: string) => /idle/i.test(n) && !/aggro|a2n|n2a|spawn|alert|death|attack|lookat|hold|hidden|transition|\b(in|out)\b|_in\b|_out\b/i.test(n)
  return (
    names.find((n) => /^idle(1)?(_base)?$/i.test(n)) ??
    names.find((n) => /idle.*(normal|1)\b|idle1/i.test(n) && plain(n)) ??
    names.find(plain) ??
    names.find((n) => /idle/i.test(n)) ??
    null
  )
}

// A running (walking) clip, not one for flying, for a prop, or the step into or out of a run
function runClip(names: string[]): string | null {
  const ok = (n: string) => /run/i.test(n) && !/fly|prop|lane|base_?run|^baserun|to(run|ground|flee)|flee|_to/i.test(n)
  return names.find((n) => /^run(_base)?$/i.test(n)) ?? names.find((n) => /(^|_)run\.anm$/i.test(n) && ok(n)) ?? names.find(ok) ?? null
}

// Clips for show: attacks, spells, taunts, dances, howls, an angry idle, looking about, and the other
// numbered idles (the plain one is the standing pose, so it is left out)
const FOR_SHOW = /attack|taunt|dance|spell|howl|angry_idle|laugh|joke|lookat|idle[_a-z]*[2-7]\b|idle[2-7]|idlevar|crab_dash\b/i
// Never for show: ends and hidden poses, the little steps between two states, moves in more than one
// part (the wind-up and the channel are only halves), and clips made for another situation
const NOT_FOR_SHOW =
  /death|dies|hidden|additive|run|flee|windup|channel|transition|_in\b|_out\b|n2a|a2n|n2ag|ag2n|al2|2al|2ag|tohide|torun|toflee|tower|pilot|landing|prop|explore|turn_|hide|burrow|destroy|hold|stun|dash_|_hit|placement|sg_|\bup\b|spawn|toidle|to_idle/i

export function planClips(names: string[], preferredIdle?: string): ClipPlan {
  const idle = preferredIdle && names.includes(preferredIdle) ? preferredIdle : plainIdle(names) ?? names[0] ?? null
  // The spawn: a clip about spawning in, not the one for leaving or for another way of arriving
  const spawn =
    names.find((n) => /spawn|hatch/i.test(n) && !/out|placement|sg_|_nj|nj\b|nspawn|mini_nj|hold/i.test(n)) ??
    names.find((n) => /spawn|hatch/i.test(n) && !/out|placement|sg_|hold/i.test(n)) ??
    null
  // The death: the plain one, the one for a building ("Destroyed"), or the first of its kind
  const death =
    names.find((n) => /^(death(_base|1)?|destroyed)$/i.test(n)) ??
    names.find((n) => /death|dies/i.test(n) && !/2\b|test/i.test(n)) ??
    names.find((n) => /death|dies/i.test(n)) ??
    null
  const show = names.filter((n) => n !== idle && n !== spawn && FOR_SHOW.test(n) && !NOT_FOR_SHOW.test(n))
  return { idle, run: runClip(names), spawn, death, show }
}

// The big four spawn in again every so often, not only when the page loads
export const isEpicModel = (url: string) => /dragon|baron|herald|scuttle|crab/i.test(url)

// ---------------------------------------------------------------------------------------------
// The kinds of move a group can share. A group picks a kind, and each member plays a clip of that kind.

export type MoveKind = 'attack' | 'aggro' | 'look' | 'flair' | 'idle'
const KINDS: [MoveKind, RegExp][] = [
  ['attack', /attack/i],
  ['aggro', /aggro|alert|angry/i],
  ['look', /lookat/i],
  ['flair', /taunt|dance|howl|laugh|joke|spell|dash/i],
  ['idle', /idle[_a-z]*[2-7]\b|idle[2-7]|idlevar/i],
]
const KIND_WEIGHT: Record<MoveKind, number> = { attack: 3, aggro: 2, flair: 2, idle: 2, look: 1 }

export function showOfKind(show: string[], kind: MoveKind): string[] {
  const re = KINDS.find(([k]) => k === kind)![1]
  return show.filter((n) => re.test(n))
}
export function kindsOf(show: string[]): MoveKind[] {
  return KINDS.map(([k]) => k).filter((k) => showOfKind(show, k).length > 0)
}

// One-shot clips (the spawn, a move, the death) are made to last 2.8 to 8 seconds: the quick ones are slowed
// down (a turret's attack is over before it can be seen) and the very long ones sped up (a tower's rebuild
// takes 15 s). A death is held to 6 seconds, since the entity goes when it ends.
const SHORTEST = 2.8
const LONGEST = 8
export function timeScaleFor(seconds: number, longest = LONGEST): number {
  if (seconds <= 0) return 1
  if (seconds < SHORTEST) return Math.max(0.3, seconds / SHORTEST)
  return seconds > longest ? seconds / longest : 1
}

/** Two clips that are the same animation under different names (a tower's "Respawn" and "Destroyed" are). */
export function sameClip(a: THREE.AnimationClip, b: THREE.AnimationClip): boolean {
  if (Math.abs(a.duration - b.duration) > 1e-3 || a.tracks.length !== b.tracks.length) return false
  for (let i = 0; i < a.tracks.length; i++) {
    const x = a.tracks[i].values
    const y = b.tracks[i].values
    if (a.tracks[i].name !== b.tracks[i].name || x.length !== y.length) return false
    for (const k of [0, Math.floor(x.length / 3), Math.floor(x.length / 2), x.length - 1]) if (Math.abs(x[k] - y[k]) > 1e-4) return false
  }
  return true
}

// ---------------------------------------------------------------------------------------------
// The states of a building. The tower and nexus models hold all of their states as separate meshes that
// lie on top of each other: the intact tower (Base, and Stage1 to Stage3, its upgrades), its rubble and
// broken pieces; the nexus and its destroyed self. The game shows one state at a time. Drawn all together
// they are copies of one another that the animation pulls apart, so only the standing state is shown while
// the entity stands.
//
// And the clips do not move the standing meshes: a tower's Respawn moves its broken pieces back together,
// and a nexus's Death moves its destroyed mesh. So while a clip plays, the meshes that it moves are shown
// (found by trying the clip out, see movedParts), and the standing ones again when it is over.

const DESTROYED_PART = /destroyed|rubble|broken/i
const UPGRADE_PART = /^stage\d/i

function materialName(mesh: THREE.Mesh): string {
  const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  return m?.name ?? ''
}
function meshesOf(root: THREE.Object3D): THREE.Mesh[] {
  const list: THREE.Mesh[] = []
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) list.push(o as THREE.Mesh)
  })
  return list
}

/** The model has states: some of its meshes are for when it is destroyed. */
export const hasStates = (root: THREE.Object3D) => meshesOf(root).some((m) => DESTROYED_PART.test(materialName(m)))

/** Shows the standing state (moved = null), or the meshes a clip moves when those are the destroyed ones.
 *  Models without states are left as they are. */
export function showParts(root: THREE.Object3D, moved: Set<string> | null) {
  const meshes = meshesOf(root)
  if (!meshes.some((m) => DESTROYED_PART.test(materialName(m)))) return
  // Only a clip that moves the destroyed state's meshes (broken, rubble, destroyed) brings them in; one that
  // moves the standing ones (an attack, say) leaves the standing state showing
  const useMoved = !!moved && [...moved].some((n) => DESTROYED_PART.test(n))
  for (const mesh of meshes) {
    const name = materialName(mesh)
    mesh.visible = useMoved ? moved!.has(name) : !DESTROYED_PART.test(name) && !UPGRADE_PART.test(name)
  }
}

// Which meshes (by material name) a clip moves. Found by trying it out on a fresh copy of the model at rest:
// the clip is set to a few moments of its length, and a mesh counts as moved if some of its vertices end
// up a noticeable way from where they are at rest. Worked out once for each model and clip.
const movedCache = new Map<string, Set<string>>()
export function movedParts(source: THREE.Object3D, clip: THREE.AnimationClip, key: string): Set<string> {
  const cached = movedCache.get(key)
  if (cached) return cached
  const moved = new Set<string>()
  const probe = cloneRig(source)
  const holder = new THREE.Group()
  holder.add(probe)
  holder.updateMatrixWorld(true)
  const skinned: THREE.SkinnedMesh[] = []
  probe.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh)
  })
  const sample = (mesh: THREE.SkinnedMesh) => {
    const index = mesh.geometry.index?.array
    const count = mesh.geometry.attributes.position.count
    const ids = index ? [...new Set(Array.from(index as ArrayLike<number>))] : Array.from({ length: count }, (_, i) => i)
    const step = Math.max(1, Math.floor(ids.length / 160))
    const out: THREE.Vector3[] = []
    for (let i = 0; i < ids.length; i += step) out.push(mesh.getVertexPosition(ids[i], new THREE.Vector3()))
    return out
  }
  const rest = new Map(skinned.map((m) => [m, sample(m)]))
  const mixer = new THREE.AnimationMixer(holder)
  const action = mixer.clipAction(clip)
  action.play()
  for (const f of [0, 0.3, 0.6, 0.95]) {
    mixer.setTime(f * clip.duration)
    holder.updateMatrixWorld(true)
    for (const mesh of skinned) {
      mesh.skeleton.update()
      mesh.geometry.computeBoundingSphere()
      const limit = (mesh.geometry.boundingSphere?.radius ?? 1) * 0.02
      const now = sample(mesh)
      const before = rest.get(mesh)!
      if (now.some((v, i) => v.distanceTo(before[i]) > limit)) moved.add(materialName(mesh))
    }
  }
  mixer.stopAllAction()
  mixer.uncacheRoot(holder)
  movedCache.set(key, moved)
  return moved
}

// ---------------------------------------------------------------------------------------------
// When the site has loaded. Spawns wait for it, so they are seen: the models are ready while the loading
// screen is still up.

let revealed = typeof document === 'undefined'
const revealListeners = new Set<() => void>()
export const isRevealed = () => revealed
export function onRevealed(fn: () => void) {
  if (revealed) {
    fn()
    return () => {}
  }
  revealListeners.add(fn)
  return () => {
    revealListeners.delete(fn)
  }
}
if (typeof document !== 'undefined') {
  let quiet = 0
  const poll = window.setInterval(() => {
    // Two quiet looks in a row: no loading screen, no boot sequence
    quiet = document.querySelector('.loading-overlay, .boot') ? 0 : quiet + 1
    if (quiet >= 2) {
      window.clearInterval(poll)
      window.setTimeout(() => {
        revealed = true
        revealListeners.forEach((fn) => fn())
        revealListeners.clear()
      }, 400)
    }
  }, 250)
}

// ---------------------------------------------------------------------------------------------
// The groups: entities that stand close together (the six raptors of a camp, the three wolves, the turrets
// round a nexus) play the same kind of move at the same time.

export interface GroupMember {
  x: number
  z: number
  kinds: () => MoveKind[] // the kinds of move it has clips for
  ready: () => boolean // it is standing and could play one
  cue: (kind: MoveKind, seed: number, delayMs: number) => void
}

const members = new Map<string, GroupMember>()
const GROUP_REACH = 7 // world units: entities closer than this (through a chain of neighbours) are one group
const nextMove = new Map<string, number>() // when each group plays next, by the group's first member
let director = 0

function groups(): string[][] {
  const ids = [...members.keys()]
  const parent = new Map(ids.map((id) => [id, id]))
  const find = (id: string): string => {
    let r = id
    while (parent.get(r) !== r) r = parent.get(r)!
    parent.set(id, r)
    return r
  }
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = members.get(ids[i])!
      const b = members.get(ids[j])!
      if (Math.hypot(a.x - b.x, a.z - b.z) < GROUP_REACH) parent.set(find(ids[i]), find(ids[j]))
    }
  }
  const by = new Map<string, string[]>()
  for (const id of ids) {
    const root = find(id)
    by.set(root, [...(by.get(root) ?? []), id])
  }
  return [...by.values()]
}

function tick() {
  if (!revealed) return
  const now = performance.now()
  for (const ids of groups()) {
    const key = [...ids].sort()[0]
    const due = nextMove.get(key)
    if (due === undefined) {
      nextMove.set(key, now + 2500 + Math.random() * 5000)
      continue
    }
    if (now < due) continue
    nextMove.set(key, now + 7000 + Math.random() * 9000)
    const who = ids.map((id) => members.get(id)!).filter((m) => m.ready())
    // Among the kinds of move that someone in the group has, pick one (some count for more)
    const kinds = [...new Set(who.flatMap((m) => m.kinds()))]
    if (kinds.length === 0) continue
    const total = kinds.reduce((n, k) => n + KIND_WEIGHT[k], 0)
    let roll = Math.random() * total
    const kind = kinds.find((k) => (roll -= KIND_WEIGHT[k]) < 0) ?? kinds[0]
    const seed = Math.floor(Math.random() * 1000)
    for (const m of who) m.cue(kind, seed, Math.random() * 160)
  }
}

export function joinGroup(id: string, member: GroupMember) {
  members.set(id, member)
  if (!director) director = window.setInterval(tick, 1000)
}
export function leaveGroup(id: string, member: GroupMember) {
  if (members.get(id) === member) members.delete(id)
  if (members.size === 0 && director) {
    window.clearInterval(director)
    director = 0
  }
}

// ---------------------------------------------------------------------------------------------
// The clips of the models on the map, by entity id, so the editor can list and play them, and a deleted
// entity can play its death first. A model puts itself in when it appears and takes itself out when it goes.

export interface ClipControl {
  names: string[] // every clip of the model
  play: (name: string) => void // plays one once, then the model goes back to what it was doing
  stop: () => void // back to standing (or running, on a route)
  death: () => number | null // plays the death clip and says how long it lasts (ms), or null when there is none
  dead: boolean // the death clip has begun: nothing else plays and a route is no longer walked
}

export const clipControls = new Map<string, ClipControl>()
const clipListeners = new Set<(id: string) => void>()

export function registerClips(id: string, control: ClipControl) {
  clipControls.set(id, control)
  clipListeners.forEach((fn) => fn(id))
}
export function unregisterClips(id: string, control: ClipControl) {
  if (clipControls.get(id) === control) clipControls.delete(id)
  clipListeners.forEach((fn) => fn(id))
}
export function onClipsChange(fn: (id: string) => void) {
  clipListeners.add(fn)
  return () => {
    clipListeners.delete(fn)
  }
}

/** For checking: the size of every group of entities that move together. */
export const debugGroups = () => groups().map((ids) => ids.length).sort((a, b) => b - a)
