import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// A model the camera cannot see is put to sleep: its animation stops where it is, and its bones are
// left out of the scene's matrix update. Every model on the map is a rigged one, with 50 to 130 bones,
// and there are about sixty of them. Animating all of them and recomputing every bone's matrix on
// every frame was the largest cost of a frame, although most are out of view at any moment.
//
// A sleeping model keeps the pose it had, and carries on from there when it comes back into view. One
// that is waiting to play its spawn clip plays it when it is first seen.
//
// A model that is in view but far away is only a few pixels tall. It is animated thirty times a second
// instead of on every frame, with the time it skipped handed to it in one step, so it moves at the same
// speed.
const FAR = 70 // world units from the camera
const FAR_STEP = 1 / 30 // seconds between a far model's updates

// The camera's view, worked out once per frame and shared by every model
const frustum = new THREE.Frustum()
const viewProjection = new THREE.Matrix4()
const viewInverse = new THREE.Matrix4()
const sphere = new THREE.Sphere()
let frustumFrame = -1

// `root` is the group that holds the model. Its parent places it on the map and is always kept up to
// date, so the model's position is read from there. `height` is the model's height in the parent's
// units. Returns two refs: whether the model is awake this frame, and how much time its animation
// should advance by if it is.
export function useModelSleep(root: { current: THREE.Object3D | null }, height: number) {
  const awake = useRef(true)
  const step = useRef(0)
  const waited = useRef(0)

  useEffect(() => {
    const object = root.current
    if (!object) return
    // three.js walks the whole scene and recomputes every matrix on each frame. This one group, and
    // everything under it, is skipped while the model sleeps.
    object.updateMatrixWorld = function (this: THREE.Object3D, force?: boolean) {
      if (awake.current) THREE.Object3D.prototype.updateMatrixWorld.call(this, force)
    }
    return () => {
      delete (object as Partial<THREE.Object3D>).updateMatrixWorld
    }
  }, [root])

  useFrame(({ camera, gl }, delta) => {
    const parent = root.current?.parent
    if (!parent) return
    const frame = gl.info.render.frame
    if (frame !== frustumFrame) {
      frustumFrame = frame
      camera.updateMatrixWorld()
      viewProjection.multiplyMatrices(camera.projectionMatrix, viewInverse.copy(camera.matrixWorld).invert())
      frustum.setFromProjectionMatrix(viewProjection)
    }
    // A generous sphere round the model: an animation reaches well outside the standing pose (a
    // dragon's wings, Baron rising), and the camera may have moved a little since the view was read
    const scale = parent.matrixWorld.getMaxScaleOnAxis()
    sphere.center.setFromMatrixPosition(parent.matrixWorld)
    sphere.center.y += (height * scale) / 2
    sphere.radius = (height * 2.5 + 4) * scale
    if (!frustum.intersectsSphere(sphere)) {
      awake.current = false
      waited.current = 0
      return
    }
    waited.current += delta
    if (waited.current < FAR_STEP && sphere.center.distanceToSquared(camera.position) > FAR * FAR) {
      awake.current = false
      return
    }
    awake.current = true
    step.current = waited.current
    waited.current = 0
  })

  return { awake, step }
}

// drei's useAnimations, with one difference: the mixer only runs while the model is awake.
export function useSleepyAnimations(
  clips: THREE.AnimationClip[],
  root: { current: THREE.Object3D | null },
  awake: { current: boolean },
  step: { current: number },
) {
  const [mixer] = useState(() => new THREE.AnimationMixer(undefined as unknown as THREE.Object3D))
  useLayoutEffect(() => {
    ;(mixer as unknown as { _root: THREE.Object3D | null })._root = root.current
  })
  const lazyActions = useRef<Record<string, THREE.AnimationAction>>({})
  const actions = useMemo(() => {
    const made: Record<string, THREE.AnimationAction | null> = {}
    clips.forEach((clip) =>
      Object.defineProperty(made, clip.name, {
        enumerable: true,
        configurable: true,
        get() {
          if (!root.current) return null
          return lazyActions.current[clip.name] || (lazyActions.current[clip.name] = mixer.clipAction(clip, root.current))
        },
      }),
    )
    return made
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips])

  useFrame(() => {
    if (awake.current) mixer.update(step.current)
  })

  useEffect(() => {
    const currentRoot = root.current
    return () => {
      // Only when the clips change: the actions made so far are dropped and their clips uncached
      const used = Object.values(lazyActions.current)
      lazyActions.current = {}
      mixer.stopAllAction()
      if (currentRoot) used.forEach((action) => mixer.uncacheAction(action.getClip(), currentRoot))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips])

  return { actions, mixer }
}
