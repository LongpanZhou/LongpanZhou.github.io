import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ARXIV_LAYOUT as L, canMove, leftOutOfList, moveOf, turnTo } from './arxivLayout';
import type { ArxivViewState, Movable } from './arxivLayout';

/** A page element that is placed in the 3D scene. */
export interface Css3dPanel {
  id: string; // the element's id
  x: number; // world units to the right of the middle of the papers
  y: number; // world units above it (negative is below)
  yawOffset?: number; // radians, turning the panel about the vertical axis (positive turns it toward the middle)
  scale: number; // world units per CSS pixel
  move: Movable; // which of the user's moves (see ArxivViewState) applies to it
}

// How far in front of the sheets (toward the camera) a panel stands by default, and how much further
// a panel in focus comes. A sheet in focus comes forward by about as much, so it covers the panels.
const PANEL_FRONT = 0.7;
const FOCUS_LIFT = 0.9;

/** The scene objects that are drawn in the second pass (see below) are on this layer. */
export const OVERLAY_LAYER = 1;

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
 *
 * Depth. DOM cannot be hidden by a 3D object, so the canvas is put ABOVE the panels (see the z-index
 * of the canvas in SummonersRift.tsx) and, where a panel should show, a hole is cut in the canvas:
 * an invisible quad at the panel's place that writes transparent pixels (no blending, alpha 0)
 * wherever it passes the depth test. A sheet that is nearer than the panel has already written its
 * depth, so the hole fails there and the sheet's own pixels stay: the panel is hidden behind it.
 * Only the sheets and the holes are in this depth test: they are drawn in a second pass, after the
 * map and models, on a cleared depth buffer, so the map never hides a panel.
 *
 * Because the canvas is on top, it would take the clicks meant for a panel. So the canvas stops
 * taking pointer events while the pointer is over a panel that is not behind a sheet (worked out by
 * ray casting against the panel and the sheets), and the click reaches the panel.
 */
export default function Css3dPanels({
  anchor,
  panels,
  view,
}: {
  anchor: { position: THREE.Vector3; yaw: number }; // the camera's overview pose, which the panels are placed against
  panels: Css3dPanel[];
  view: MutableRefObject<ArxivViewState>; // holds the moves, and is told when one is being dragged
}) {
  const { camera, size, gl, raycaster } = useThree();
  // The pointer test below lives in an effect that must not be rebuilt on every render, so it reads these
  const latest = useRef({ camera, size });
  latest.current = { camera, size };
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
      plane: new THREE.Plane(),
      ray: new THREE.Raycaster(),
      hit: new THREE.Vector3(),
      start: new THREE.Vector3(),
      dir: new THREE.Vector3(),
    }),
    [],
  );
  // The hole of each panel, and where each panel stands this frame (for the pointer test)
  const holes = useRef<Record<string, THREE.Mesh>>({});
  const quads = useRef<Record<string, { inv: THREE.Matrix4; hw: number; hh: number; visible: boolean }>>({});

  // Where a panel's middle is: in front of the overview camera, level with the sheets, shifted right
  // and up by its place and the user's move, and toward the camera by its depth. The overview's right is
  // (cos, 0, -sin) and the camera looks along (-sin, 0, -cos).
  const panelPosition = (p: Css3dPanel, out: THREE.Vector3) => {
    const sin = Math.sin(anchor.yaw);
    const cos = Math.cos(anchor.yaw);
    const mv = moveOf(view.current, p.move);
    const px = p.x + mv.sx;
    const lift = PANEL_FRONT + FOCUS_LIFT * (view.current.lifts[p.move] ?? 0);
    return out.set(
      anchor.position.x - sin * L.distance + cos * px + sin * lift,
      anchor.position.y + p.y + mv.sy,
      anchor.position.z - cos * L.distance - sin * px + cos * lift,
    );
  };

  // Runs after the camera has moved this frame (it is registered after the camera controller)
  useFrame((_, dt) => {
    // The moves glide to where they were put. While one is dragged it follows the pointer closely.
    const ease = view.current.dragging ? 1 : 1 - Math.exp(-10 * Math.min(dt, 0.1));
    for (const m of Object.values(view.current.moves)) {
      m.sx = Math.abs(m.x - m.sx) < 0.0005 ? m.x : m.sx + (m.x - m.sx) * ease;
      m.sy = Math.abs(m.y - m.sy) < 0.0005 ? m.y : m.sy + (m.y - m.sy) * ease;
      m.syaw = Math.abs(m.yaw - m.syaw) < 0.0005 ? m.yaw : m.syaw + (m.yaw - m.syaw) * ease;
    }
    // The boxes come forward for the focus, and settle in their depth order, at the camera's own pace
    const v = view.current;
    const rate = 1 - Math.exp(-3.5 * Math.min(dt, 0.1));
    for (const id of new Set([...Object.keys(v.lifts), ...v.order, 'bar', 'music'])) {
      const target = (v.focusTarget !== 0 && v.focusId === id) || v.panelFocus === id ? 1 : 0;
      const cur = v.lifts[id] ?? 0;
      v.lifts[id] = Math.abs(target - cur) < 0.0005 ? target : cur + (target - cur) * rate;
    }
    for (const id of v.order) {
      const idx = Math.max(0, v.stack.indexOf(id));
      const cur = v.ranks[id] ?? idx;
      v.ranks[id] = Math.abs(idx - cur) < 0.001 ? idx : cur + (idx - cur) * ease;
    }
    camera.updateMatrixWorld();
    tmp.inverse.copy(camera.matrixWorld).invert();
    // The focal length in pixels
    const focal = (camera as THREE.PerspectiveCamera).projectionMatrix.elements[5] * (size.height / 2);

    for (const p of panels) {
      const el = document.getElementById(p.id);
      const hole = holes.current[p.id];
      if (!el) {
        if (hole) hole.visible = false;
        continue;
      }
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w === 0 || h === 0) {
        if (hole) hole.visible = false;
        continue;
      }

      const mv = moveOf(view.current, p.move);
      panelPosition(p, tmp.pos);
      tmp.quat.setFromEuler(tmp.euler.set(0, anchor.yaw + (p.yawOffset ?? 0) + mv.syaw, 0));
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
      const visible = tmp.centre.z < -0.5;
      el.style.visibility = visible ? 'visible' : 'hidden';

      // Its hole in the canvas, a hair larger than the panel so no edge of the scene shows round it
      if (hole) {
        hole.visible = visible;
        hole.position.copy(tmp.pos);
        hole.quaternion.copy(tmp.quat);
        hole.scale.set(w * s * 1.01, h * s * 1.01, 1);
      }
      const q = (quads.current[p.id] ??= { inv: new THREE.Matrix4(), hw: 0, hh: 0, visible: false });
      q.inv.copy(tmp.world).invert();
      q.hw = (w * s) / 2;
      q.hh = (h * s) / 2;
      q.visible = visible;
    }
  });

  // The picture is drawn in two passes, so the sheets (and the panels' holes) are tested against
  // each other for depth only, and not against the map. Pass one: the map and the models. Pass two:
  // on a cleared depth buffer, the overlay layer, which is the sheets and the holes. The scene's
  // background colour would clear the first pass again (three clears for a colour background even when
  // auto clear is off), so it is taken away for the second pass. While this component exists it draws
  // the frame (a render subscriber with a priority switches the automatic render off).
  useFrame(({ gl: renderer, scene, camera: cam }) => {
    const autoClear = renderer.autoClear;
    const shadows = renderer.shadowMap.autoUpdate;
    const background = scene.background;

    renderer.autoClear = true;
    cam.layers.set(0);
    renderer.render(scene, cam);

    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false; // the shadows were drawn in the first pass
    scene.background = null;
    renderer.clearDepth();
    cam.layers.set(OVERLAY_LAYER);
    renderer.render(scene, cam);

    cam.layers.set(0);
    scene.background = background;
    renderer.shadowMap.autoUpdate = shadows;
    renderer.autoClear = autoClear;
  }, 1);

  // The scene's pointer events see the overlay layer too (the raycaster looks at layer 0 only)
  useEffect(() => {
    raycaster.layers.enable(OVERLAY_LAYER);
    return () => raycaster.layers.disable(OVERLAY_LAYER);
  }, [raycaster]);

  // The canvas lets pointer events through while the pointer is over a panel that nothing is in front of
  useEffect(() => {
    let wrapper: HTMLElement | null = gl.domElement.parentElement;
    while (wrapper && getComputedStyle(wrapper).position !== 'fixed') wrapper = wrapper.parentElement;
    if (!wrapper) return;
    const target = wrapper;
    tmp.ray.layers.enable(OVERLAY_LAYER);
    const ndc = new THREE.Vector2();
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const onMove = (e: PointerEvent) => {
      // A press that is going on keeps going to where it started
      if (e.buttons !== 0 || view.current.dragging) return;
      const { camera: cam, size: sz } = latest.current;
      ndc.set((e.clientX / sz.width) * 2 - 1, -(e.clientY / sz.height) * 2 + 1);
      tmp.ray.setFromCamera(ndc, cam);
      let panelDistance = Infinity;
      for (const q of Object.values(quads.current)) {
        if (!q.visible) continue;
        origin.copy(tmp.ray.ray.origin).applyMatrix4(q.inv);
        direction.copy(tmp.ray.ray.direction).transformDirection(q.inv);
        if (Math.abs(direction.z) < 1e-6) continue;
        const t = -origin.z / direction.z;
        if (t <= 0) continue;
        if (Math.abs(origin.x + direction.x * t) <= q.hw && Math.abs(origin.y + direction.y * t) <= q.hh) {
          panelDistance = Math.min(panelDistance, t);
        }
      }
      let sheetDistance = Infinity;
      if (panelDistance < Infinity) {
        const v = view.current;
        const hits = tmp.ray.intersectObjects(
          Object.entries(v.meshes).filter(([id]) => !leftOutOfList(v, id)).map(([, m]) => m),
          false,
        );
        if (hits.length) sheetDistance = hits[0].distance;
      }
      target.style.pointerEvents = panelDistance < sheetDistance ? 'none' : 'auto';
    };
    window.addEventListener('pointermove', onMove, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      target.style.pointerEvents = 'auto';
    };
  }, [gl, tmp, view]);

  // Dragging a panel: press anywhere on it that is not a control and move. The pointer is turned into
  // a distance in the plane the panel stands in (facing the camera), so it follows the pointer.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !canMove(view.current)) return;
      const target = e.target as Element | null;
      const el = target?.closest('.css3d-panel');
      const panel = panels.find((p) => p.id === el?.id);
      // The grip on top of a panel turns it instead of moving it
      if (el && panel && target?.closest('[data-rotate]')) {
        const mvr = moveOf(view.current, panel.move);
        const startYaw = mvr.yaw;
        const downX = e.clientX;
        let turned = false;
        const onTurn = (ev: PointerEvent) => {
          if (!turned && Math.abs(ev.clientX - downX) < 3) return;
          turned = true;
          view.current.dragging = true;
          mvr.yaw = turnTo(startYaw, ev.clientX - downX);
        };
        const onTurnEnd = () => {
          window.removeEventListener('pointermove', onTurn);
          window.removeEventListener('pointerup', onTurnEnd);
          window.removeEventListener('pointercancel', onTurnEnd);
          view.current.dragging = false;
          if (turned) {
            const stop = (ce: Event) => ce.stopPropagation();
            window.addEventListener('click', stop, { capture: true, once: true });
            window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 100);
          }
        };
        window.addEventListener('pointermove', onTurn);
        window.addEventListener('pointerup', onTurnEnd);
        window.addEventListener('pointercancel', onTurnEnd);
        return;
      }
      if (!el || !panel || target?.closest('button, input, select, textarea, a, label, audio, [data-nodrag]')) return;

      const mv = moveOf(view.current, panel.move);
      const world = (cx: number, cy: number, out: THREE.Vector3) => {
        tmp.ray.setFromCamera(new THREE.Vector2((cx / size.width) * 2 - 1, -(cy / size.height) * 2 + 1), camera);
        return tmp.ray.ray.intersectPlane(tmp.plane, out);
      };
      // The plane through the panel's middle, facing the camera
      const sin = Math.sin(anchor.yaw);
      const cos = Math.cos(anchor.yaw);
      panelPosition(panel, tmp.pos);
      camera.getWorldDirection(tmp.dir);
      tmp.plane.setFromNormalAndCoplanarPoint(tmp.dir, tmp.pos);
      if (!world(e.clientX, e.clientY, tmp.start)) return;
      const startX = mv.x;
      const startY = mv.y;
      const down = { x: e.clientX, y: e.clientY };
      let moved = false;

      const onMove = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 5) return;
        moved = true;
        view.current.dragging = true;
        if (!world(ev.clientX, ev.clientY, tmp.hit)) return;
        tmp.hit.sub(tmp.start);
        mv.x = startX + tmp.hit.x * cos - tmp.hit.z * sin; // along the overview's right, (cos, 0, -sin)
        mv.y = startY + tmp.hit.y;
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        view.current.dragging = false;
        if (moved) {
          // The click that follows a drag must not focus the panel
          const stop = (ce: Event) => ce.stopPropagation();
          window.addEventListener('click', stop, { capture: true, once: true });
          window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 100);
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panels, anchor, camera, size, tmp, view]);

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

  // The holes: invisible quads on the overlay layer. No blending, so what they write replaces the
  // canvas pixel, and alpha 0 makes that pixel transparent. Their transforms are set every frame above.
  return (
    <>
      {panels.map((p) => (
        <mesh
          key={p.id}
          ref={(m) => {
            if (m) {
              m.visible = false;
              m.layers.set(OVERLAY_LAYER);
              holes.current[p.id] = m;
            } else {
              delete holes.current[p.id];
            }
          }}
          renderOrder={1}
          raycast={() => null}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color="#000000"
            opacity={0}
            blending={THREE.NoBlending}
            side={THREE.DoubleSide}
            toneMapped={false}
            fog={false}
          />
        </mesh>
      ))}
    </>
  );
}
