import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject, ReactNode, Ref } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { loadPdfDocument } from '../pdf/pdfSource';
import { ARXIV_LAYOUT as L, canMove, leftOutOfList, moveOf, raise, sheetBase, turnTo } from './arxivLayout';
import { OVERLAY_LAYER } from './Css3dPanels';
import type { ArxivViewState, PaperEntry, PaperInfo } from './arxivLayout';

// The sheets are drawn in a second pass, on their own layer, so that they and the panels of the
// scene can hide each other by depth (see Css3dPanels)
const overlay = (m: THREE.Object3D | null) => {
  m?.layers.set(OVERLAY_LAYER);
};

// Drawing on a focused sheet: the size of the drawing layer, and the pen colours (keys 1 to 4)
const INK_WIDTH = 1100;
const PEN_COLORS = ['#ff3b3b', '#ffd23f', '#35d0ff', '#4cd964'];

interface Stroke {
  color: string;
  points: [number, number][];
}
interface Ink {
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  strokes: Stroke[]; // what is drawn, oldest first
  undone: Stroke[]; // strokes taken back with Ctrl+Z, the latest last
}

function paintStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = s.color;
  ctx.beginPath();
  s.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  // A stroke of one point is still a dot
  if (s.points.length === 1) ctx.lineTo(s.points[0][0] + 0.01, s.points[0][1]);
  ctx.stroke();
}

function repaint(it: Ink) {
  const ctx = it.canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, it.canvas.width, it.canvas.height);
  it.strokes.forEach((s) => paintStroke(ctx, s));
  it.tex.needsUpdate = true;
}

// Width, in pixels, a page is drawn at. Wide enough to stay readable in the close-up comparison.
const RENDER_WIDTH = 1400;

interface PageTextures {
  a: THREE.CanvasTexture; // the page as it is
  aspect: number; // page width / height
  pageNumber: number;
}

interface DocProps {
  id: string; // the paper's id, which is also the id of its sheet
  target: string; // the PDF to show
  page: number; // 1-based page number
  // The camera's overview pose. The sheets stand in front of it, facing it.
  anchor: { position: THREE.Vector3; yaw: number };
  // The comparison and focus the sheets and the camera follow (eased by the camera)
  compare: MutableRefObject<ArxivViewState>;
  onInfo: (id: string, patch: Partial<PaperInfo>) => void; // pages and errors
  onPick: (sheetId: string) => void; // a click on a sheet or its label
}

function makeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------------------------------
// One paper in the scene
// ---------------------------------------------------------------------------------------------

/** One paper: the page, with a label above it. There is no frame around it. */
function Paper({
  label,
  map,
  width,
  height,
  matRef,
  onPick,
  sheetId,
  page,
  pageCount,
  view,
  yaw,
  children,
}: {
  label: string;
  map: THREE.Texture | null;
  width: number;
  height: number;
  matRef: Ref<THREE.MeshBasicMaterial>;
  onPick: () => void;
  page: number; // the page shown, which the drawing on the sheet belongs to
  pageCount: number; // pages in the paper, 0 until it has loaded
  sheetId: string; // the sheet's id, which is also the key of its move (see ArxivViewState)
  view: MutableRefObject<ArxivViewState>;
  yaw: number; // the overview's heading, which says which way is right
  children?: ReactNode; // anything else that belongs to this paper (the loading bar)
}) {
  const { camera } = useThree();
  // A drag in progress: where the pointer first hit (on a plane facing the camera) and where the
  // paper had been put
  const drag = useRef<{ plane: THREE.Plane; start: THREE.Vector3; x: number; y: number; cx: number; cy: number } | null>(null);
  const hit = useRef(new THREE.Vector3());

  // The drawing on each page of this sheet, kept while the page is turned away from and back to. It is
  // kept as strokes, so the last one can be taken back (Ctrl+Z) and put back (Ctrl+Y).
  const ink = useRef(new Map<number, Ink>());
  const [, setInkVersion] = useState(0);
  const stroke = useRef<Stroke | null>(null); // the stroke being drawn
  const pen = useRef(0);
  const inkNow = ink.current.get(page);
  useEffect(() => {
    const store = ink.current;
    return () => store.forEach((i) => i.tex.dispose());
  }, []);
  const strokeTo = (uv: THREE.Vector2) => {
    let it = ink.current.get(page);
    if (!it) {
      const canvas = document.createElement('canvas');
      canvas.width = INK_WIDTH;
      canvas.height = Math.round((INK_WIDTH * height) / width);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      it = { canvas, tex, strokes: [], undone: [] };
      ink.current.set(page, it);
      setInkVersion((v) => v + 1);
    }
    const x = uv.x * it.canvas.width;
    const y = (1 - uv.y) * it.canvas.height;
    if (!stroke.current) {
      stroke.current = { color: PEN_COLORS[pen.current], points: [] };
      it.strokes.push(stroke.current);
      it.undone = []; // drawing something new ends the redo
    }
    const points = stroke.current.points;
    const from = points[points.length - 1] ?? [x, y];
    points.push([x, y]);
    const ctx = it.canvas.getContext('2d');
    if (!ctx) return;
    paintStroke(ctx, { color: stroke.current.color, points: [from, [x + 0.01, y]] }); // only the new bit
    it.tex.needsUpdate = true;
  };
  // While this sheet is in focus: Ctrl+Z takes the last stroke back, Ctrl+Y (or Ctrl+Shift+Z) puts it
  // back, X wipes the page's drawing, and 1 to 4 pick the pen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = view.current;
      if (v.focusId !== sheetId || v.focusTarget === 0 || (v.lifts[sheetId] ?? 0) < 0.5) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      const it = ink.current.get(page);
      if (e.ctrlKey || e.metaKey) {
        if (!it) return;
        if (k === 'z' && !e.shiftKey) {
          const last = it.strokes.pop();
          if (last) it.undone.push(last);
        } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
          const back = it.undone.pop();
          if (back) it.strokes.push(back);
        } else return;
        e.preventDefault();
        repaint(it);
        return;
      }
      if (k === 'x') {
        if (it) {
          it.strokes = [];
          it.undone = [];
          repaint(it);
        }
      } else if (k >= '1' && k <= String(PEN_COLORS.length)) {
        pen.current = Number(k) - 1;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, sheetId, page]);

  // The page number under the sheet shows while it is in focus
  const pageControls = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const el = pageControls.current;
    if (!el) return;
    const v = view.current;
    el.style.opacity = String(v.focusId === sheetId && v.focusTarget !== 0 ? (v.lifts[sheetId] ?? 0) : 0);
  });

  return (
    <group>
      <mesh
        ref={(m) => {
          overlay(m);
          if (m) view.current.meshes[sheetId] = m;
          else delete view.current.meshes[sheetId];
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || leftOutOfList(view.current, sheetId)) return;
          const v = view.current;
          raise(v, sheetId); // touching a sheet brings it to the front
          // On a sheet in focus a drag draws (and the camera is left alone)
          if (v.focusTarget !== 0 && v.focusId === sheetId && (v.lifts[sheetId] ?? 0) > 0.9) {
            e.stopPropagation();
            (e.target as unknown as Element).setPointerCapture(e.pointerId);
            v.dragging = true;
            stroke.current = null;
            if (e.uv) strokeTo(e.uv);
            return;
          }
          if (!canMove(v)) return;
          e.stopPropagation();
          (e.target as unknown as Element).setPointerCapture(e.pointerId);
          const mv = moveOf(view.current, sheetId);
          const normal = camera.getWorldDirection(new THREE.Vector3());
          drag.current = {
            plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, e.point),
            start: e.point.clone(),
            x: mv.x,
            y: mv.y,
            cx: e.nativeEvent.clientX,
            cy: e.nativeEvent.clientY,
          };
        }}
        onPointerMove={(e) => {
          if (stroke.current) {
            if (e.uv) strokeTo(e.uv);
            return;
          }
          const d = drag.current;
          if (!d) return;
          // A press that has not moved yet is still a click
          if (!view.current.dragging && Math.hypot(e.nativeEvent.clientX - d.cx, e.nativeEvent.clientY - d.cy) < 5) return;
          view.current.dragging = true;
          if (!e.ray.intersectPlane(d.plane, hit.current)) return;
          hit.current.sub(d.start);
          const mv = moveOf(view.current, sheetId);
          mv.x = d.x + hit.current.x * Math.cos(yaw) - hit.current.z * Math.sin(yaw); // along the overview's right
          mv.y = d.y + hit.current.y;
        }}
        onPointerUp={(e) => {
          if (stroke.current) {
            stroke.current = null;
            view.current.dragging = false;
            (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
            return;
          }
          if (!drag.current) return;
          drag.current = null;
          view.current.dragging = false;
          (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
        }}
        onClick={(e) => {
          if (leftOutOfList(view.current, sheetId)) return;
          e.stopPropagation();
          // The click that ends a drag does not focus the paper
          if (e.delta > 4) return;
          onPick();
        }}
      >
        <planeGeometry args={[width, height]} />
        {/* Unlit and not tone-mapped, so the page is shown in its own colours. Keyed on the
            texture, because a material has to be rebuilt when it gains a map. */}
        <meshBasicMaterial
          key={map ? 'page' : 'blank'}
          ref={matRef}
          map={map}
          color={map ? '#ffffff' : '#0d1626'}
          toneMapped={false}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      {inkNow && (
        <mesh position={[0, 0, 0.012]} renderOrder={2} raycast={() => null} ref={overlay}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={inkNow.tex} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* The page number, under the sheet while it is in focus (the mouse wheel turns the page) */}
      <Html position={[0, -height / 2 - 1.1, 0]} center zIndexRange={[990, 900]} style={{ pointerEvents: 'none' }}>
        <div ref={pageControls} className="arxiv-pagectl" style={{ opacity: 0 }}>
          <div className="arxiv-pagectl__n">
            {page} / {pageCount || '–'}
          </div>
        </div>
      </Html>
      {/* The grip above the paper: dragging it sideways turns the paper */}
      <Html position={[0, height / 2 + 2.7, 0]} center zIndexRange={[990, 900]} style={{ pointerEvents: 'none' }}>
        <div
          className="css3d-grip css3d-grip--paper"
          data-rotate
          style={{ pointerEvents: 'auto' }}
          onPointerDown={(e) => {
            if (e.button !== 0 || !canMove(view.current)) return;
            e.preventDefault();
            const mv = moveOf(view.current, sheetId);
            const startYaw = mv.yaw;
            const downX = e.clientX;
            const onTurn = (ev: PointerEvent) => {
              view.current.dragging = true;
              mv.yaw = turnTo(startYaw, ev.clientX - downX);
            };
            const onEnd = () => {
              window.removeEventListener('pointermove', onTurn);
              window.removeEventListener('pointerup', onEnd);
              window.removeEventListener('pointercancel', onEnd);
              view.current.dragging = false;
            };
            window.addEventListener('pointermove', onTurn);
            window.addEventListener('pointerup', onEnd);
            window.addEventListener('pointercancel', onEnd);
          }}
        />
      </Html>
      {/* Below the HUD boxes (z-index 1000), so a label never covers one */}
      <Html position={[0, height / 2 + 1.1, 0]} center zIndexRange={[990, 900]} style={{ pointerEvents: 'none' }}>
        <div className="arxiv-label" onClick={onPick}>
          {label}
        </div>
      </Html>
      {children}
    </group>
  );
}

const shortName = (target: string) => target.replace(/^https?:\/\//i, '').split('/').pop() || target;

/**
 * One paper of the list: a sheet showing one page. Sheets stand in a row in front of the camera and can
 * be moved, turned, drawn on, focused and compared (see CameraController and sheetBase).
 */
function PaperDoc({ id, target, page, anchor, compare, onInfo, onPick }: DocProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [tex, setTex] = useState<PageTextures | null>(null);

  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const fade = useRef(0);
  const leave = useRef(0); // 0..1, how far the sheet has faded for a change of view (see viewTransition.ts)
  // Where the sheet's place in the row is drawn from: eased, so the row glides when the order changes
  const shown = useRef(Number.NaN);

  // Forget the sheet's place when the paper goes
  useEffect(
    () => () => {
      const v = compare.current;
      delete v.moves[id];
      delete v.widths[id];
      delete v.meshes[id];
      v.stack = v.stack.filter((x) => x !== id);
      delete v.lifts[id];
      delete v.ranks[id];
    },
    [compare, id],
  );

  // Load the document
  useEffect(() => {
    onInfo(id, { pages: 0, error: null });
    let cancelled = false;
    setDoc(null);
    const task = loadPdfDocument(target);
    task.promise
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        onInfo(id, { pages: d.numPages });
      })
      .catch((err: unknown) => {
        if (!cancelled) onInfo(id, { error: err instanceof Error ? err.message : 'The paper could not be loaded.' });
      });
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [id, target, onInfo]);

  // Draw the page and turn it into a texture
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    const n = Math.min(Math.max(page, 1), doc.numPages);
    doc
      .getPage(n)
      .then((p) => {
        if (cancelled) return undefined;
        const base = p.getViewport({ scale: 1 });
        const viewport = p.getViewport({ scale: RENDER_WIDTH / base.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;
        renderTask = p.render({ canvasContext: ctx, viewport });
        return renderTask.promise.then(() => {
          if (cancelled) return;
          setTex({ a: makeTexture(canvas), aspect: canvas.width / canvas.height, pageNumber: n });
          fade.current = 0;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, page]);

  // Free a texture once it is no longer on screen: after the next one has replaced it (this cleanup
  // runs after that commit), or when the view goes away
  const texA = tex?.a;
  useEffect(() => () => texA?.dispose(), [texA]);

  const aspect = tex?.aspect ?? 8.5 / 11;
  const height = L.paperHeight;
  const width = height * aspect;
  const { position, yaw } = anchor;

  useFrame((_, dt) => {
    const view = compare.current;
    view.widths[id] = width;
    const t = view.t;
    const toeBase = THREE.MathUtils.degToRad(L.toeDeg);
    // The camera looks along (-sin yaw, 0, -cos yaw); its right is (cos yaw, 0, -sin yaw)
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const cx = position.x - sin * L.distance;
    const cz = position.z - cos * L.distance;
    // A new page fades in, and everything fades out when the view is about to change
    fade.current = Math.min(1, fade.current + dt * 1.6);
    const leaving = document.documentElement.classList.contains('view-leaving') ? 1 : 0;
    leave.current += (leaving - leave.current) * (1 - Math.exp(-12 * Math.min(dt, 0.1)));

    const g = group.current;
    if (!g) return;
    // The spread-out place, or in the list (t, eased by the camera, is how far the list is) the place in
    // the long row. A sheet glides there when the order or the number of sheets changes.
    const base = sheetBase(view, id);
    const listed = view.listOrder.includes(id);
    const baseX = listed ? THREE.MathUtils.lerp(base.x, sheetBase(view, id, L.listGap, view.listOrder).x, t) : base.x;
    shown.current = Number.isNaN(shown.current) ? baseX : shown.current + (baseX - shown.current) * (1 - Math.exp(-8 * Math.min(dt, 0.1)));
    const mv = moveOf(view, id);
    const focusMine = view.lifts[id] ?? 0; // eased per sheet, so a switch of focus does not jump
    const keep = 1 - t; // where the user put the sheet counts fully until the list takes the sheets
    const x = shown.current + mv.sx * keep;
    // A sheet in focus comes forward, and the ones touched last stand in front
    const lift = 0.9 * focusMine + 0.04 * (view.ranks[id] ?? 0);
    g.visible = listed || t < 0.98;
    g.position.set(cx + cos * x + sin * lift, position.y + mv.sy * keep, cz - sin * x + cos * lift);
    // In the list the sheets are flat to the camera, side by side
    g.rotation.y = yaw + toeBase * base.k * (1 - Math.max(t, focusMine)) + mv.syaw * keep;
    if (mat.current) {
      // The other sheets dim while one is focused
      let dimFocus = 0;
      for (const o of view.order) if (o !== id) dimFocus = Math.max(dimFocus, view.lifts[o] ?? 0);
      // A sheet that was not chosen for the list fades away as the list comes
      mat.current.opacity = fade.current * (1 - 0.6 * dimFocus) * (listed ? 1 : 1 - t) * (1 - leave.current);
    }
  });

  return (
    <group ref={group}>
      <Paper
        label={shortName(target)}
        map={tex?.a ?? null}
        width={width}
        height={height}
        matRef={mat}
        onPick={() => onPick(id)}
        sheetId={id}
        page={tex?.pageNumber ?? page}
        pageCount={doc?.numPages ?? 0}
        view={compare}
        yaw={yaw}
      />
    </group>
  );
}

/**
 * The arXiv view's papers, built inside the 3D scene: every paper of the list is a sheet in a row in
 * front of the camera. Each sheet can be dragged, turned, drawn on when focused, and compared with
 * another.
 */
export default function ArxivPapers({
  papers,
  anchor,
  compare,
  onInfo,
  onPick,
}: {
  papers: PaperEntry[];
  anchor: { position: THREE.Vector3; yaw: number };
  compare: MutableRefObject<ArxivViewState>;
  onInfo: (id: string, patch: Partial<PaperInfo>) => void;
  onPick: (sheetId: string) => void;
}) {
  return (
    <>
      {papers.map((p) => (
        <PaperDoc key={p.id} id={p.id} target={p.target} page={p.page} anchor={anchor} compare={compare} onInfo={onInfo} onPick={onPick} />
      ))}
    </>
  );
}
