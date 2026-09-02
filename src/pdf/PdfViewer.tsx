import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { LANGUAGES, translateSegments } from './translate';
import { extractBlocks, type Block } from './layout';
import './pdf.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Served from a CDN so PDFs that rely on the 14 standard fonts or on CJK
// CMaps still render correctly.
const PDFJS_VERSION = pdfjsLib.version;
const CMAP_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`;
const STANDARD_FONTS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`;

type ViewMode = 'original' | 'translate';

/**
 * Turn the browser path into the URL of a PDF to load.
 *
 *   /arxiv.org/pdf/1706.03762            -> https://arxiv.org/pdf/1706.03762
 *   /https://arxiv.org/pdf/1706.03762    -> https://arxiv.org/pdf/1706.03762
 *   /http://example.com/a.pdf            -> http://example.com/a.pdf
 *
 * Returns null when the path does not look like a host/URL.
 */
function resolveTarget(pathname: string, search: string): string | null {
  let raw = pathname.replace(/^\/+/, '');
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep raw as-is if it is not valid percent-encoding */
  }
  if (!raw) return null;

  // Browsers collapse "https://" in the path to "https:/" — restore it.
  raw = raw.replace(/^(https?):\/+/i, '$1://');

  let url: string;
  if (/^https?:\/\//i.test(raw)) {
    url = raw;
  } else {
    const firstSegment = raw.split('/')[0];
    if (!firstSegment.includes('.') || /\s/.test(firstSegment)) return null;
    url = 'https://' + raw;
  }

  if (search && search.length > 1) url += search;

  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

/** Bare `host/path` form used in the address box and for share links. */
function bareForm(url: string): string {
  return url.replace(/^https?:\/\//i, '');
}

// ---------------------------------------------------------------------------

function TranslatedBlock({
  block,
  scale,
  text,
}: {
  block: Block;
  scale: number;
  text: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const left = block.x0 * scale;
  const top = block.y0 * scale;
  const width = (block.x1 - block.x0) * scale;
  const height = (block.y1 - block.y0) * scale;
  const base = Math.max(6, block.fontH * scale * 0.94);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.overflow = 'hidden';
    let fs = base;
    el.style.fontSize = `${fs}px`;
    let guard = 0;
    while (el.scrollHeight > height + 1.5 && fs > base * 0.6 && guard < 30) {
      fs *= 0.94;
      el.style.fontSize = `${fs}px`;
      guard += 1;
    }
    // If it still doesn't fit, let it spill rather than clip the text away.
    if (el.scrollHeight > height + 1.5) el.style.overflow = 'visible';
  }, [text, base, height]);

  return (
    <div
      ref={ref}
      className="pdfv-tblock"
      style={{ left, top, width, height }}
      title={text}
    >
      {text}
    </div>
  );
}

function PdfPageView({
  pdf,
  pageNumber,
  scale,
  mode,
  blocks,
  translated,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  mode: ViewMode;
  blocks: Block[] | undefined;
  translated: string[] | undefined;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | null = null;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      setDims({ w: viewport.width, h: viewport.height });

      task = page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      try {
        await task.promise;
      } catch {
        /* render cancelled on unmount / scale change */
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, scale]);

  const showOverlay = mode === 'translate' && !!blocks && !!translated;

  return (
    <div
      className="pdfv-page"
      style={dims ? { width: dims.w, height: dims.h } : { width: 480, height: 620 }}
    >
      {!dims && <div className="pdfv-page__placeholder">Rendering page {pageNumber}…</div>}
      <canvas
        ref={canvasRef}
        className="pdfv-page__canvas"
        style={dims ? { width: dims.w, height: dims.h } : { display: 'none' }}
      />
      {showOverlay && dims && (
        <div className="pdfv-overlay" style={{ width: dims.w, height: dims.h }}>
          {blocks!.map((b, i) =>
            translated![i] ? (
              <TranslatedBlock key={i} block={b} scale={scale} text={translated![i]} />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

type TransState = 'idle' | 'running' | 'done' | 'error';

function PdfViewer() {
  const location = useLocation();
  const navigate = useNavigate();
  const target = resolveTarget(location.pathname, location.search);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageBlocks, setPageBlocks] = useState<Block[][]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.3);

  const [addr, setAddr] = useState(target ? bareForm(target) : '');
  const [copied, setCopied] = useState(false);

  const [lang, setLang] = useState('zh-CN');
  const [customLang, setCustomLang] = useState('');
  const [translations, setTranslations] = useState<Record<number, string[]>>({});
  const [transState, setTransState] = useState<TransState>('idle');
  const [transProgress, setTransProgress] = useState(0);
  const [transError, setTransError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('original');
  const abortRef = useRef<AbortController | null>(null);

  const effectiveLang = (customLang.trim() || lang).trim();

  useEffect(() => {
    setAddr(target ? bareForm(target) : '');
  }, [target]);

  // Changing the target language invalidates any existing translation.
  useEffect(() => {
    abortRef.current?.abort();
    setTranslations({});
    setTransState('idle');
    setTransProgress(0);
    setTransError(null);
    setViewMode('original');
  }, [lang, customLang]);

  // Load the document + reassemble each page's text into blocks.
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setPdf(null);
    setNumPages(0);
    setPageBlocks([]);
    setLoadError(null);
    setTranslations({});
    setTransState('idle');

    const task = pdfjsLib.getDocument({
      url: target,
      cMapUrl: CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: STANDARD_FONTS_URL,
    });
    task.promise
      .then(async (doc) => {
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
        document.title = `PDF · ${bareForm(target)}`;

        const all: Block[][] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          all.push(await extractBlocks(page));
        }
        if (!cancelled) setPageBlocks(all);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [target]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const openAddr = useCallback(() => {
    const v = addr.trim().replace(/^\/+/, '').replace(/^https?:\/\//i, '');
    if (v) navigate('/' + v);
  }, [addr, navigate]);

  const copyLink = useCallback(() => {
    const v = addr.trim().replace(/^\/+/, '').replace(/^https?:\/\//i, '');
    const link = `${window.location.origin}/${v}`;
    void navigator.clipboard?.writeText(link).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  }, [addr]);

  const runTranslation = useCallback(async () => {
    if (!pageBlocks.length || !effectiveLang) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setTransState('running');
    setTransError(null);
    setTransProgress(0);
    setTranslations({});
    setViewMode('translate');

    try {
      for (let i = 0; i < pageBlocks.length; i++) {
        if (controller.signal.aborted) return;
        const blocks = pageBlocks[i];
        // Only translate prose blocks; leave equations / tables / figure
        // pixels as they are. Scatter results back to full-block indices.
        const idxs = blocks
          .map((b, k) => (b.translatable ? k : -1))
          .filter((k) => k >= 0);
        const parts = idxs.length
          ? await translateSegments(
              idxs.map((k) => blocks[k].text),
              effectiveLang,
              'auto',
              controller.signal,
            )
          : [];
        const full = blocks.map(() => '');
        idxs.forEach((k, j) => {
          full[k] = parts[j] ?? '';
        });
        setTranslations((prev) => ({ ...prev, [i + 1]: full }));
        setTransProgress(i + 1);
      }
      setTransState('done');
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setTransError(err instanceof Error ? err.message : String(err));
      setTransState('error');
    }
  }, [pageBlocks, effectiveLang]);

  const blocksReady = pageBlocks.length > 0 && pageBlocks.length === numPages;
  const hasTranslation = Object.keys(translations).length > 0;

  const pageList = useMemo(
    () => Array.from({ length: numPages }, (_, i) => i + 1),
    [numPages],
  );

  if (!target) {
    return (
      <div className="pdfv">
        <div className="pdfv__status">
          <h2>Not a PDF link</h2>
          <p className="pdfv__label">
            Append a PDF URL to the site, e.g.{' '}
            <code>longpanzhou.github.io/arxiv.org/pdf/1706.03762</code>
          </p>
          <Link className="pdfv__link" to="/">
            ← Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pdfv">
      <div className="pdfv__toolbar">
        <form
          className="pdfv__addr"
          onSubmit={(e) => {
            e.preventDefault();
            openAddr();
          }}
        >
          <input
            className="pdfv__addr-input"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            spellCheck={false}
            placeholder="arxiv.org/pdf/1706.03762"
            aria-label="PDF URL"
          />
          <button type="submit" className="pdfv__btn">
            Open
          </button>
          <button type="button" className="pdfv__btn" onClick={copyLink}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </form>

        <div className="pdfv__toolbar-group">
          <button
            className="pdfv__btn"
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))}
            disabled={!pdf}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="pdfv__label">{Math.round(scale * 100)}%</span>
          <button
            className="pdfv__btn"
            onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(2)))}
            disabled={!pdf}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>

        <div className="pdfv__toolbar-group">
          <label className="pdfv__label" htmlFor="pdfv-lang">
            To
          </label>
          <select
            id="pdfv-lang"
            className="pdfv__select"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={transState === 'running'}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <input
            className="pdfv__input"
            placeholder="or code"
            value={customLang}
            onChange={(e) => setCustomLang(e.target.value)}
            disabled={transState === 'running'}
            aria-label="Custom language code"
          />
        </div>

        <div className="pdfv__toolbar-group pdfv__modes">
          <button
            className={
              'pdfv__btn' + (viewMode === 'original' ? ' pdfv__btn--active' : '')
            }
            onClick={() => setViewMode('original')}
          >
            Original
          </button>
          <button
            className={
              'pdfv__btn' + (viewMode === 'translate' ? ' pdfv__btn--active' : '')
            }
            onClick={() => {
              if (transState === 'running') return;
              if (hasTranslation) setViewMode('translate');
              else runTranslation();
            }}
            disabled={!blocksReady}
          >
            {transState === 'running'
              ? `Translating ${transProgress}/${numPages}…`
              : 'Translate'}
          </button>
          {transState === 'running' && (
            <button
              className="pdfv__btn"
              onClick={() => {
                abortRef.current?.abort();
                setTransState('idle');
              }}
            >
              Stop
            </button>
          )}
        </div>

        <a
          className="pdfv__link"
          href={target}
          target="_blank"
          rel="noopener noreferrer"
        >
          Original file ↗
        </a>
      </div>

      {transError && (
        <div className="pdfv__status">
          <p className="pdfv__error">Translation failed: {transError}</p>
        </div>
      )}

      {loadError ? (
        <div className="pdfv__status">
          <h2>Could not load this PDF</h2>
          <p className="pdfv__error">{loadError}</p>
          <p className="pdfv__label">
            The file may be missing, or the host may block cross-origin
            requests. You can still{' '}
            <a
              className="pdfv__link"
              href={target}
              target="_blank"
              rel="noopener noreferrer"
            >
              open it directly
            </a>
            .
          </p>
        </div>
      ) : !pdf ? (
        <div className="pdfv__status">
          <div className="pdfv__spinner" />
          <p className="pdfv__label">Loading PDF…</p>
        </div>
      ) : (
        <div className="pdfv__pages">
          {viewMode === 'translate' && (
            <p className="pdfv__note">
              In-place layout is approximate: body paragraphs are replaced where
              they sit; equations, tables and reference lists may come out garbled.
            </p>
          )}
          {pageList.map((pageNumber) => (
            <div className="pdfv__row" key={pageNumber}>
              <PdfPageView
                pdf={pdf}
                pageNumber={pageNumber}
                scale={scale}
                mode="original"
                blocks={undefined}
                translated={undefined}
              />
              {viewMode === 'translate' && (
                <PdfPageView
                  pdf={pdf}
                  pageNumber={pageNumber}
                  scale={scale}
                  mode="translate"
                  blocks={pageBlocks[pageNumber - 1]}
                  translated={translations[pageNumber]}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PdfViewer;
