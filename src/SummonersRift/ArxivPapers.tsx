import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject, ReactNode, Ref } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { loadPdfDocument } from '../pdf/pdfSource';
import { extractBlocks, type Block } from '../pdf/layout';
import { translateSegments } from '../pdf/translate';
import { recordPageTime } from '../pdf/pageTimes';
import { ARXIV_LAYOUT as L } from './arxivLayout';
import { idleTranslation } from './arxivLayout';
import type { ArxivCommands, ArxivTranslation, ArxivViewState } from './arxivLayout';

// Width, in pixels, a page is drawn at. Wide enough to stay readable in the close-up comparison.
const RENDER_WIDTH = 1400;

interface PageTextures {
  a: THREE.CanvasTexture; // the left paper: the page as it is
  b: THREE.CanvasTexture; // the right paper: empty until the page has been translated
  aspect: number; // page width / height
  orig: HTMLCanvasElement; // the page as drawn, kept so the translation can be put on a fresh copy
  scale: number; // the pixel scale the page was drawn at (blocks are in scale-1 units)
  pageNumber: number;
  translated: boolean; // `b` shows a translation (otherwise it is empty)
}

interface Props {
  target: string | null; // the PDF to show
  page: number; // 1-based page number
  // The camera's overview pose. The papers stand in front of it, facing it.
  anchor: { position: THREE.Vector3; yaw: number };
  // The comparison and focus the papers and the camera follow (eased by the camera)
  compare: MutableRefObject<ArxivViewState>;
  onPages: (n: number) => void;
  onError: (message: string | null) => void; // why the paper could not be shown, or null
  onPick: (side: 'left' | 'right') => void; // a click on a paper or its label
  // The controls ask for translations through `commands`; progress is reported back
  commands: MutableRefObject<ArxivCommands>;
  onTranslation: (t: ArxivTranslation) => void;
}

// ---------------------------------------------------------------------------------------------
// Putting a translation on a page
// ---------------------------------------------------------------------------------------------

const FONT = (px: number) => `${px}px Georgia, "Times New Roman", serif`;

// Breaks text into lines no wider than maxW. A word wider than a line (Chinese has no spaces) is
// broken between characters.
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxW) {
      line = test;
      continue;
    }
    if (line) {
      lines.push(line);
      line = '';
    }
    if (ctx.measureText(word).width <= maxW) {
      line = word;
      continue;
    }
    for (const ch of Array.from(word)) {
      const t = line + ch;
      if (!line || ctx.measureText(t).width <= maxW) line = t;
      else {
        lines.push(line);
        line = ch;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Covers one text block of the page with a white box and writes its translation in, shrinking the
// text until it fits the box (the same rule the old DOM viewer used).
function drawBlock(ctx: CanvasRenderingContext2D, b: Block, text: string, scale: number) {
  const x = b.x0 * scale;
  const y = b.y0 * scale;
  const w = (b.x1 - b.x0) * scale;
  const h = (b.y1 - b.y0) * scale;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  const base = Math.max(6, b.fontH * scale * 0.94);
  let fs = base;
  ctx.font = FONT(fs);
  let lines = wrapLines(ctx, text, w);
  for (let guard = 0; lines.length * fs * 1.16 > h + 1.5 && fs > base * 0.6 && guard < 30; guard++) {
    fs *= 0.94;
    ctx.font = FONT(fs);
    lines = wrapLines(ctx, text, w);
  }
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * fs * 1.16));
}

// The page for the right paper: empty until its translation exists, then the page with the
// translation on it (text that is not translated, like equations, keeps its own pixels)
function composePage(orig: HTMLCanvasElement, scale: number, blocks?: Block[], texts?: string[]): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = orig.width;
  out.height = orig.height;
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  if (!blocks || !texts) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    return out;
  }
  ctx.drawImage(orig, 0, 0);
  blocks.forEach((b, i) => texts[i] && drawBlock(ctx, b, texts[i], scale));
  return out;
}

function makeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const noCommands: ArxivCommands = { translate: () => undefined, stop: () => undefined, reset: () => undefined };

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
  children,
}: {
  label: string;
  map: THREE.Texture | null;
  width: number;
  height: number;
  matRef: Ref<THREE.MeshBasicMaterial>;
  onPick: () => void;
  children?: ReactNode; // anything else that belongs to this paper (the loading bar)
}) {
  return (
    <group>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
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
      {/* Below the HUD boxes (z-index 1000), so a label never covers one */}
      <Html position={[0, height / 2 + 1.1, 0]} center zIndexRange={[900, 0]} style={{ pointerEvents: 'none' }}>
        <div className="arxiv-label" onClick={onPick}>
          {label}
        </div>
      </Html>
      {children}
    </group>
  );
}

/**
 * The translation's loading bar, in the scene under the right paper: a track, a bar that fills as
 * pages are translated, and a label. It is only there while a translation is running.
 */
function TranslationBar({ progress, width, height }: { progress: ArxivTranslation; width: number; height: number }) {
  const fill = useRef<THREE.Mesh>(null);
  const shown = useRef(0); // the fill, eased so it grows smoothly instead of jumping a page at a time
  const ratio = progress.total ? progress.done / progress.total : 0;
  const running = progress.state === 'running';

  useFrame((_, dt) => {
    if (!running) shown.current = 0;
    else shown.current += (ratio - shown.current) * Math.min(1, dt * 5);
    const f = fill.current;
    if (!f) return;
    const s = Math.max(shown.current, 0.002);
    f.scale.x = s;
    f.position.x = -width / 2 + (width * s) / 2;
  });

  if (!running) return null;
  return (
    // Inside the page's bottom margin, so it stays clear of the controls standing under the papers
    <group position={[0, -height / 2 + 0.7, 0.03]}>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[width + 0.16, 0.66]} />
        <meshBasicMaterial color="#c8aa6e" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <planeGeometry args={[width, 0.5]} />
        <meshBasicMaterial color="#060e1c" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={fill} position={[0, 0, 0.01]}>
        <planeGeometry args={[width, 0.38]} />
        <meshBasicMaterial color="#0ac8ff" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[width * 0.22, -1.7, 0]} center zIndexRange={[900, 0]} style={{ pointerEvents: 'none' }}>
        <div className="arxiv-label">
          TRANSLATING {progress.done} / {progress.total}
        </div>
      </Html>
    </group>
  );
}

/**
 * The arXiv view's two papers, built inside the 3D scene: the original on the left and the
 * translation on the right, which is an empty page until its translation exists. In the
 * overview they stand a little apart, turned slightly toward each other, in front of the camera;
 * the comparison pulls them edge to edge, flat to the camera, while the camera moves in (see
 * CameraController). Clicking one focuses the camera on it.
 */
export default function ArxivPapers({
  target,
  page,
  anchor,
  compare,
  onPages,
  onError,
  onPick,
  commands,
  onTranslation,
}: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [tex, setTex] = useState<PageTextures | null>(null);
  const [transVersion, setTransVersion] = useState(0); // bumped whenever the translations change
  const [progress, setProgress] = useState<ArxivTranslation>(idleTranslation); // what the loading bar shows

  const pageRef = useRef(page);
  pageRef.current = page;

  // The translation work: what has been translated, the text blocks of each page, and the request
  // in flight. All of it belongs to one document and one language.
  const work = useRef<{
    texts: Record<number, string[]>;
    blocks: Record<number, Block[]>;
    pending: Record<number, Promise<Block[]>>;
    abort: AbortController | null;
  }>({ texts: {}, blocks: {}, pending: {}, abort: null });

  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const matLeft = useRef<THREE.MeshBasicMaterial>(null);
  const matRight = useRef<THREE.MeshBasicMaterial>(null);
  const fade = useRef(0);

  // Load the document
  useEffect(() => {
    onPages(0);
    onError(null);
    if (!target) {
      setDoc(null);
      onError('That address is not a PDF link.');
      return;
    }
    let cancelled = false;
    setDoc(null);
    const task = loadPdfDocument(target);
    task.promise
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        onPages(d.numPages);
      })
      .catch((err: unknown) => {
        if (!cancelled) onError(err instanceof Error ? err.message : 'The paper could not be loaded.');
      });
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [target, onPages, onError]);

  // The translation commands. A new document starts with nothing translated.
  useEffect(() => {
    const w = work.current;
    const report = (t: ArxivTranslation) => {
      setProgress(t);
      onTranslation(t);
    };
    w.abort?.abort();
    w.texts = {};
    w.blocks = {};
    w.pending = {};
    w.abort = null;
    setTransVersion((v) => v + 1);
    report({ state: 'idle', done: 0, total: doc?.numPages ?? 0, error: null, lang: '' });
    if (!doc) {
      commands.current = noCommands;
      return;
    }

    // The text blocks of a page, found once
    const blocksFor = (n: number): Promise<Block[]> => {
      w.pending[n] ??= doc.getPage(n).then(async (p) => {
        const found = await extractBlocks(p);
        w.blocks[n] = found;
        return found;
      });
      return w.pending[n];
    };

    const stop = () => {
      w.abort?.abort();
      w.abort = null;
    };

    const translate = async (lang: string) => {
      stop();
      w.texts = {};
      setTransVersion((v) => v + 1);
      const controller = new AbortController();
      w.abort = controller;
      const total = doc.numPages;
      let done = 0;
      report({ state: 'running', done, total, error: null, lang });
      // The page being looked at first, then the ones after it, then the ones before it
      const start = Math.min(Math.max(pageRef.current, 1), total);
      const order = Array.from({ length: total }, (_, i) => ((start - 1 + i) % total) + 1);
      try {
        for (const n of order) {
          if (controller.signal.aborted) return;
          const blocks = await blocksFor(n);
          // Only prose is translated: equations, tables and figures keep their own pixels
          const idxs = blocks.map((b, k) => (b.translatable ? k : -1)).filter((k) => k >= 0);
          const started = performance.now();
          const parts = await translateSegments(
            idxs.map((k) => blocks[k].text),
            lang,
            'auto',
            controller.signal,
          );
          if (idxs.length) recordPageTime((performance.now() - started) / 1000);
          const full = blocks.map(() => '');
          idxs.forEach((k, j) => {
            full[k] = parts[j] ?? '';
          });
          w.texts[n] = full;
          done += 1;
          report({ state: 'running', done, total, error: null, lang });
          setTransVersion((v) => v + 1);
        }
        report({ state: 'done', done, total, error: null, lang });
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        report({
          state: 'error',
          done,
          total,
          error: err instanceof Error ? err.message : String(err),
          lang,
        });
      }
    };

    commands.current = {
      translate: (lang) => void translate(lang),
      stop,
      reset: () => {
        stop();
        w.texts = {};
        setTransVersion((v) => v + 1);
        report({ state: 'idle', done: 0, total: doc.numPages, error: null, lang: '' });
      },
    };
    return () => {
      stop();
      commands.current = noCommands;
    };
  }, [doc, commands, onTranslation]);

  // Draw the page and turn it into the two textures
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
        const scale = RENDER_WIDTH / base.width;
        const viewport = p.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;
        renderTask = p.render({ canvasContext: ctx, viewport });
        return renderTask.promise.then(() => {
          if (cancelled) return;
          const texts = work.current.texts[n];
          const blocks = work.current.blocks[n];
          const hasTranslation = !!texts && !!blocks;
          setTex({
            a: makeTexture(canvas),
            b: makeTexture(composePage(canvas, scale, hasTranslation ? blocks : undefined, texts)),
            aspect: canvas.width / canvas.height,
            orig: canvas,
            scale,
            pageNumber: n,
            translated: hasTranslation,
          });
          fade.current = 0;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, page]);

  // When the translations change, the right paper is drawn again from the page as it was
  useEffect(() => {
    if (!tex) return;
    const texts = work.current.texts[tex.pageNumber];
    const blocks = work.current.blocks[tex.pageNumber];
    const hasTranslation = !!texts && !!blocks;
    if (!hasTranslation && !tex.translated) return;
    setTex({
      ...tex,
      b: makeTexture(composePage(tex.orig, tex.scale, hasTranslation ? blocks : undefined, texts)),
      translated: hasTranslation,
    });
    // Only a change of the translations redraws the paper; the page itself is drawn above
  }, [transVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Free a texture once it is no longer on screen: after the next one has replaced it (these
  // cleanups run after that commit), or when the view goes away
  const texA = tex?.a;
  const texB = tex?.b;
  useEffect(() => () => texA?.dispose(), [texA]);
  useEffect(() => () => texB?.dispose(), [texB]);

  const aspect = tex?.aspect ?? 8.5 / 11;
  const height = L.paperHeight;
  const width = height * aspect;
  const { position, yaw } = anchor;

  useFrame((_, dt) => {
    const view = compare.current;
    view.paperWidth = width; // the camera centres on a paper by this
    const t = view.t;
    const gap = THREE.MathUtils.lerp(L.gap, L.compareGap, t);
    // A paper that is being focused (or compared) turns flat to the camera; the other keeps its angle
    const focusLeft = view.fa * Math.max(-view.f, 0);
    const focusRight = view.fa * Math.max(view.f, 0);
    const toeBase = THREE.MathUtils.degToRad(L.toeDeg);
    const toeLeft = toeBase * (1 - Math.max(t, focusLeft));
    const toeRight = toeBase * (1 - Math.max(t, focusRight));
    // The camera looks along (-sin yaw, 0, -cos yaw); its right is (cos yaw, 0, -sin yaw)
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const cx = position.x - sin * L.distance;
    const cz = position.z - cos * L.distance;
    const off = (width + gap) / 2;
    if (left.current) {
      left.current.position.set(cx - cos * off, position.y, cz + sin * off);
      left.current.rotation.y = yaw + toeLeft;
    }
    if (right.current) {
      right.current.position.set(cx + cos * off, position.y, cz - sin * off);
      right.current.rotation.y = yaw - toeRight;
    }
    // A new page fades in
    fade.current = Math.min(1, fade.current + dt * 1.6);
    // The paper that is not being focused dims
    if (matLeft.current) matLeft.current.opacity = fade.current * (1 - 0.6 * focusRight);
    if (matRight.current) matRight.current.opacity = fade.current * (1 - 0.6 * focusLeft);
  });

  return (
    <>
      <group ref={left}>
        <Paper
          label="ORIGINAL"
          map={tex?.a ?? null}
          width={width}
          height={height}
          matRef={matLeft}
          onPick={() => onPick('left')}
        />
      </group>
      <group ref={right}>
        <Paper
          label="TRANSLATED"
          map={tex?.b ?? null}
          width={width}
          height={height}
          matRef={matRight}
          onPick={() => onPick('right')}
        >
          <TranslationBar progress={progress} width={width} height={height} />
        </Paper>
      </group>
    </>
  );
}
