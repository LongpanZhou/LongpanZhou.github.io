import * as THREE from 'three'

// Gentle camera shake while the camera is stale, meaning it has not moved for a while.
//
// The shake is a small offset added to both the camera and its orbit target. The view
// direction and the orbit angles stay the same, so OrbitControls and the keyboard
// movement are unaffected. The offset from the previous frame is removed before the next
// one is added, so the shake never drifts.

const STALE_AFTER = 1.5 // seconds without camera movement before the shake starts
const RAMP = 1.5 // seconds to ramp the shake up to full strength
// Shake size as a fraction of the camera's distance to its target, so it reads the same
// on screen (about 4 px of sway) however far the camera is zoomed out.
const AMPLITUDE_RATIO = 0.004
const FALLBACK_DISTANCE = 30
const AXIS_WEIGHT = new THREE.Vector3(1, 0.7, 1)
// Movement smaller than this per frame (world units) counts as still. It absorbs the tail
// of OrbitControls damping and of the go-home lerp, which otherwise never settle exactly.
const MOVED_EPSILON_SQ = 0.002 * 0.002

export interface CameraShake {
  // Call once per frame, before any camera movement in that frame.
  // `target` is the OrbitControls target, or null when there are no controls.
  // `paused` (the spawn screen) holds the camera still: no shake, and the stillness timer is reset.
  update(camera: THREE.Camera, target: THREE.Vector3 | null, nowMs: number, paused?: boolean): void
  // The offset added to the camera this frame. A caller that moves the camera toward a goal every
  // frame must move the unshaken position (subtract this, move, add it back); otherwise its pull
  // toward the goal cancels the shake.
  readonly offset: THREE.Vector3
}

export function createCameraShake(): CameraShake {
  const applied = new THREE.Vector3()
  const lastBase = new THREE.Vector3()
  let hasBase = false
  let lastMovedAt = 0

  return {
    offset: applied,
    update(camera, target, nowMs, paused = false) {
      // Undo last frame's shake so the position and target are the real ones again.
      camera.position.sub(applied)
      target?.sub(applied)

      // Compare without the shake, so the shake itself never counts as movement.
      if (!hasBase || camera.position.distanceToSquared(lastBase) > MOVED_EPSILON_SQ) {
        lastBase.copy(camera.position)
        lastMovedAt = nowMs
      }
      hasBase = true

      if (paused) {
        lastMovedAt = nowMs
        applied.set(0, 0, 0)
        return
      }

      const stillFor = (nowMs - lastMovedAt) / 1000
      const strength = THREE.MathUtils.clamp((stillFor - STALE_AFTER) / RAMP, 0, 1)

      applied.set(0, 0, 0)
      if (strength > 0) {
        const distance = target ? camera.position.distanceTo(target) : FALLBACK_DISTANCE
        // Layered sines at unrelated frequencies, so the motion looks organic rather than
        // like a single bob.
        const t = nowMs / 1000
        applied
          .set(
            Math.sin(t * 1.1) + 0.5 * Math.sin(t * 2.3 + 1.7),
            Math.sin(t * 1.7 + 0.6) + 0.5 * Math.sin(t * 3.1),
            Math.sin(t * 0.9 + 2.2) + 0.5 * Math.sin(t * 2.6 + 0.4),
          )
          .multiply(AXIS_WEIGHT)
          .multiplyScalar((distance * AMPLITUDE_RATIO * strength) / 1.5)
      }

      camera.position.add(applied)
      target?.add(applied)
    },
  }
}
