import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ARXIV_LAYOUT as L } from './arxivLayout';

/** A page element that is placed in the 3D scene. */
export interface Css3dPanel {
  id: string; // the element's id
  x: number; // world units to the right of the middle of the papers
  y: number; // world units above it (negative is below)
  yawOffset?: number; // radians, turning the panel about the vertical axis (positive turns it toward the middle)
  scale: number; // world units per CSS pixel
}

/**
 * Puts ordinary page elements (the music player, the arXiv controls) into the 3D scene. They stay
 * real, clickable DOM, but each frame this gives them a CSS 3D transform worked out from the
 * camera and from where the panel stands in the world, the way the papers do. So they have
 * perspective, they come closer when the camera does, and they move with it. Nothing is
 * re-created: the music keeps playing.
 *
 * The elements must be `position: fixed; left: 0; top: 0; transform-origin: 0 0` (the
 * `.css3d-panel` class in SummonersRift.css does that). The transform maps a point of the element,
 * in CSS pixels from its top-left corner, to a point on the screen, through a full 4x4
 * projection, so no wrapper elements are needed.
 */
export default function Css3dPanels({
  anchor,
  panels,
}: {
  anchor: { position: THREE.Vector3; yaw: number }; // the camera's overview pose, which the panels are placed against
  panels: Css3dPanel[];
}) {
  const { camera, size } = useThree();
  const tmp = useMemo(
    () => ({
      world: new THREE.Matrix4(),
      local: new THREE.Matrix4(),
      screen: new THREE.Matrix4(),
      all: new THREE.Matrix4(),
      inverse: new THREE.Matrix4(),
      quat: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      pos: new THREE.Vector3(),
      centre: new THREE.Vector3(),
      one: new THREE.Vector3(1, 1, 1),
    }),
    [],
  );

  // Runs after the camera has moved this frame (it is registered after the camera controller)
  useFrame(() => {
    camera.updateMatrixWorld();
    tmp.inverse.copy(camera.matrixWorld).invert();
    // The focal length in pixels
    const focal = (camera as THREE.PerspectiveCamera).projectionMatrix.elements[5] * (size.height / 2);
    const sin = Math.sin(anchor.yaw);
    const cos = Math.cos(anchor.yaw);

    for (const p of panels) {
      const el = document.getElementById(p.id);
      if (!el) continue;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w === 0 || h === 0) continue;

      // The panel's centre: in front of the overview camera, level with the papers, then shifted
      // right and up. Its right is (cos, 0, -sin) and the camera looks along (-sin, 0, -cos).
      tmp.pos.set(
        anchor.position.x - sin * L.distance + cos * p.x,
        anchor.position.y + p.y,
        anchor.position.z - cos * L.distance - sin * p.x,
      );
      tmp.quat.setFromEuler(tmp.euler.set(0, anchor.yaw + (p.yawOffset ?? 0), 0));
      tmp.world.compose(tmp.pos, tmp.quat, tmp.one);

      // Pixels of the element (from its top-left, y down) to the panel's own units (centred, y up)
      const s = p.scale;
      tmp.local.set(s, 0, 0, (-w / 2) * s, 0, -s, 0, (h / 2) * s, 0, 0, s, 0, 0, 0, 0, 1);

      // Camera space to the screen: x = w/2 - f*X/Z, y = h/2 + f*Y/Z, written as a homogeneous
      // matrix whose last row is the depth, so the browser does the divide
      tmp.screen.set(
        focal, 0, -size.width / 2, 0,
        0, -focal, -size.height / 2, 0,
        0, 0, 0, 1,
        0, 0, -1, 0,
      );

      tmp.all.copy(tmp.screen).multiply(tmp.inverse).multiply(tmp.world).multiply(tmp.local);
      el.style.transform = `matrix3d(${tmp.all.elements.join(',')})`;

      // A panel behind the camera would be drawn mirrored
      tmp.centre.copy(tmp.pos).applyMatrix4(tmp.inverse);
      el.style.visibility = tmp.centre.z < -0.5 ? 'visible' : 'hidden';
    }
  });

  // Back to normal when the panels leave the scene
  useEffect(
    () => () => {
      for (const p of panels) {
        const el = document.getElementById(p.id);
        if (el) {
          el.style.transform = '';
          el.style.visibility = '';
        }
      }
    },
    [panels],
  );

  return null;
}
