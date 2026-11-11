import * as THREE from 'three'

// The map is shown before its textures have arrived at full size. The file the scene loads
// (rift-lite.glb) holds every texture as a small picture, so it is a quarter of the size and the map
// can be seen that much sooner. The full pictures (public/rift-tex/<n>.webp, about 15 MB together) are
// loaded here once the map is up, and each one takes the place of its small copy as it arrives. They
// are the same files the map had inside it before, so the map ends up looking exactly as it did.
// scripts/split-map.mjs makes both from the one original file.
const TEX_DIR = '/rift-tex/'
const AT_ONCE = 10 // downloads running side by side

// What the loader hands back for the map: only the parts used here
interface LoadedMap {
  scene: THREE.Object3D
  parser: {
    json: { textures?: { source?: number; extensions?: Record<string, { source?: number }> }[] }
    associations: Map<unknown, { textures?: number } | undefined>
    textureLoader: { loadAsync: (url: string) => Promise<unknown> }
  }
}

let done = false
const listeners = new Set<() => void>()
/** Whether every full texture is in (or has failed, and keeps its small copy). */
export const mapTexturesDone = () => done
export function onMapTexturesDone(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// The renderer that draws the map now, if there is one. A texture that arrives is sent to the graphics
// card through it at once, on a frame of its own, and not on whichever later frame first looks at it.
let renderer: THREE.WebGLRenderer | null = null
const started = new WeakSet<object>()

/** Starts loading the map's full textures (once per map), and returns what to call when the scene goes away. */
export function sharpenMap(map: LoadedMap, gl: THREE.WebGLRenderer) {
  renderer = gl
  const release = () => {
    if (renderer === gl) renderer = null
  }
  if (started.has(map.scene)) return release
  started.add(map.scene)

  // Which picture each texture shows, and how much of the map wears it (in triangle corners)
  const groups = new Map<number, { textures: Set<THREE.Texture>; size: number }>()
  const defs = map.parser.json.textures ?? []
  map.scene.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const size = mesh.geometry.index?.count ?? mesh.geometry.attributes.position?.count ?? 0
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material as unknown as Record<string, unknown>)) {
        const texture = value as THREE.Texture | null
        if (!texture?.isTexture) continue
        const def = defs[map.parser.associations.get(texture)?.textures ?? -1]
        const image = def?.extensions?.EXT_texture_webp?.source ?? def?.source
        if (image === undefined) continue
        const group = groups.get(image) ?? { textures: new Set(), size: 0 }
        if (!group.textures.has(texture)) group.size += size
        group.textures.add(texture)
        groups.set(image, group)
      }
    }
  })

  // The largest surfaces first: the ground, then the cliffs and walls, down to the small props
  const waiting = [...groups].sort((a, b) => b[1].size - a[1].size)
  const arrived: { textures: Set<THREE.Texture>; image: unknown }[] = []
  let left = waiting.length
  let frame = 0

  const finish = () => {
    if (left > 0 || arrived.length > 0 || done) return
    done = true
    listeners.forEach((listener) => listener())
  }

  // One texture per frame (two if they pile up): sending a 2048 x 2048 picture to the graphics card
  // takes a few milliseconds, and all of them in one frame would be a stall of most of a second
  const place = () => {
    frame = 0
    for (let n = arrived.length > 8 ? 2 : 1; n > 0 && arrived.length > 0; n--) {
      const { textures, image } = arrived.shift()!
      const old = new Set<unknown>()
      for (const texture of textures) {
        old.add(texture.image)
        texture.dispose() // its storage on the card has the small picture's size: it is made again
        texture.image = image
        texture.needsUpdate = true
        renderer?.initTexture(texture)
      }
      old.forEach((small) => (small as Partial<ImageBitmap> | null)?.close?.())
    }
    if (arrived.length > 0) frame = requestAnimationFrame(place)
    else finish()
  }

  const next = () => {
    const entry = waiting.shift()
    if (!entry) return
    const [image, group] = entry
    map.parser.textureLoader
      .loadAsync(`${TEX_DIR}${image}.webp`)
      .then((loaded) => {
        // The loader gives a bitmap, or in browsers without them a texture that holds an <img>
        const picture = (loaded as THREE.Texture).isTexture ? (loaded as THREE.Texture).image : loaded
        arrived.push({ textures: group.textures, image: picture })
        if (!frame) frame = requestAnimationFrame(place)
      })
      .catch(() => {
        // It keeps its small picture
      })
      .finally(() => {
        left--
        finish()
        next()
      })
  }
  if (left === 0) finish()
  for (let i = 0; i < AT_ONCE; i++) next()
  return release
}
