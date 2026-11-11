import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

// Thumbnails for the editor's inventory: each model is rendered once, in a three-quarter view,
// by one small separate renderer, and kept as an image. Renders are queued one at a time so the
// page does not stall, and a model that fails to load simply gets an empty preview.

const SIZE = 160
const loader = new GLTFLoader()
loader.setMeshoptDecoder(MeshoptDecoder) // the models that ship with the site are packed with meshopt
let renderer: THREE.WebGLRenderer | null = null
const cache = new Map<string, Promise<string>>()
let queue: Promise<unknown> = Promise.resolve()

async function render(url: string, tint?: string): Promise<string> {
  const gltf = await loader.loadAsync(url)
  const root = gltf.scene
  if (tint) {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const material = (mesh.material as THREE.MeshStandardMaterial).clone()
      material.color.set(tint)
      mesh.material = material
    })
  }

  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  root.position.sub(center)

  const scene = new THREE.Scene()
  scene.add(root)
  scene.add(new THREE.AmbientLight(0xffffff, 1.6))
  const sun = new THREE.DirectionalLight(0xffffff, 1.4)
  sun.position.set(3, 5, 4)
  scene.add(sun)

  const radius = Math.max(size.x, size.y, size.z, 1e-6)
  const camera = new THREE.PerspectiveCamera(35, 1, radius / 100, radius * 30)
  camera.position.set(radius * 1.2, radius * 0.7, radius * 1.7) // from the front (+Z), a little to the side and above
  camera.lookAt(0, 0, 0)

  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setSize(SIZE, SIZE)
    renderer.setClearColor(0x000000, 0)
  }
  renderer.render(scene, camera)
  const image = renderer.domElement.toDataURL('image/png')

  // Free what this preview used
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose()
      material.dispose()
    }
  })
  return image
}

// The preview for a model, as an image URL. Repeat calls for the same model share one render.
export function getPreview(url: string, tint?: string): Promise<string> {
  const key = `${url}|${tint ?? ''}`
  let preview = cache.get(key)
  if (!preview) {
    const run = queue.then(() => render(url, tint))
    queue = run.catch(() => undefined)
    preview = run.catch(() => '')
    cache.set(key, preview)
  }
  return preview
}
