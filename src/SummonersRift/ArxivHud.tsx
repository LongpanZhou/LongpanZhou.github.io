import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { bareForm } from '../pdf/pdfTarget';
import type { PaperEntry, PaperInfo } from './arxivLayout';
import './projectsHud.css';

/** A paper of the list with what it has reported. */
export type PaperRow = PaperEntry & PaperInfo;

interface Props {
  papers: PaperRow[];
  urlError: string | null; // why the paper in the address could not be used
  listLayout: boolean; // the papers stand in one long row, one after the other
  onToggleList: () => void;
  leftOut: string[]; // the papers that are not in the list
  onToggleListed: (id: string) => void; // put a paper in the list or take it out
  onFocusSheet: (sheetId: string) => void;
  onAdd: (address: string) => string | null; // returns why it could not be added, or null
  onRemove: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void; // a row was dragged to a new place in the list
  onReset: () => void; // back to the default set-up: boxes, turns, camera tilt and zoom
  onFocusBox: () => void; // a click on the box (not on a control) focuses the camera on it
}

const shortName = (target: string) => {
  const s = bareForm(target);
  return s.length > 38 ? '…' + s.slice(-37) : s;
};

/**
 * The controls of the arXiv view. The papers themselves are in the 3D scene (see ArxivPapers); this
 * box holds the list of papers (add, remove, drag to reorder) and the button that puts them all in one
 * long row. It stands in the scene under the papers (see Css3dPanels).
 */
export default function ArxivHud({
  papers,
  urlError,
  listLayout,
  onToggleList,
  leftOut,
  onToggleListed,
  onFocusSheet,
  onAdd,
  onRemove,
  onReorder,
  onFocusBox,
  onReset,
}: Props) {
  const [addr, setAddr] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // A row being dragged, and the place in the list it would drop into
  const [drag, setDrag] = useState<{ id: string; to: number } | null>(null);

  const add = () => {
    const why = onAdd(addr);
    setAddError(why);
    if (!why) setAddr('');
  };

  // Dragging a row: press on it (not on its remove button) and move. The place it would drop into is the
  // number of the other rows whose middles are above the pointer.
  const startDrag = (e: ReactPointerEvent, id: string, from: number) => {
    if (e.button !== 0 || (e.target as Element).closest('[data-norow]')) return;
    const startY = e.clientY;
    let active = false;
    let to = from;
    const places = (y: number) => {
      const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('.arxiv-item') ?? [])];
      return rows.filter((row, i) => {
        if (i === from) return false;
        const r = row.getBoundingClientRect();
        return r.top + r.height / 2 < y;
      }).length;
    };
    const move = (ev: PointerEvent) => {
      if (!active && Math.abs(ev.clientY - startY) < 5) return;
      active = true;
      to = places(ev.clientY);
      setDrag({ id, to });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDrag(null);
      if (!active) return;
      if (to !== from) onReorder(id, to);
      // The click that ends a drag must not focus the paper
      const stop = (ce: Event) => ce.stopPropagation();
      window.addEventListener('click', stop, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 100);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const errorText = addError ?? urlError;
  // The rows without the one being dragged, to say where it would land
  const others = drag ? papers.filter((r) => r.id !== drag.id) : papers;

  return (
    // A panel in the 3D scene (see Css3dPanels): no drag handle, no minimize, and no HUD box drawn
    // around it, because its outline would not follow the panel's perspective
    <div
      id="css3d-arxiv-bar"
      className="hud-box rift-doc--arxiv-bar css3d-panel"
      onClick={(e) => {
        if (!(e.target as Element).closest('button, input, select, textarea, a, label')) onFocusBox();
      }}
    >
      <div className="css3d-grip" data-rotate title="Drag sideways to turn" />
      <div className="rift-doc__head">
        <h2 className="rift-doc__title">arXiv</h2>
        <span className="rift-doc__sub">
          {papers.length} paper{papers.length === 1 ? '' : 's'}
        </span>
      </div>
      <form
        className="arxiv-bar__addr"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className="arxiv-bar__input"
          value={addr}
          onChange={(e) => {
            setAddr(e.target.value);
            setAddError(null);
          }}
          spellCheck={false}
          placeholder="Add a paper: arxiv.org/pdf/1706.03762 or just 1706.03762"
          aria-label="PDF address or arXiv id"
        />
        <button type="submit" className="arxiv-bar__btn">Add</button>
        <button
          type="button"
          className={`arxiv-bar__btn arxiv-bar__btn--wide${listLayout ? ' arxiv-bar__btn--on' : ''}`}
          onClick={onToggleList}
          title="Put the ticked papers in one long row, one after the other"
        >
          {listLayout ? 'Spread out' : `List (${papers.length - papers.filter((r) => leftOut.includes(r.id)).length})`}
        </button>
      </form>
      {errorText && <div className="arxiv-bar__error arxiv-bar__error--tight">{errorText}</div>}

      <div className="arxiv-list" ref={listRef} data-nodrag>
        {papers.length === 0 && <div className="arxiv-list__empty">No papers yet. Add one above.</div>}
        {papers.map((r, i) => {
          const isDragged = drag?.id === r.id;
          // The row that the dragged one would land in front of (or after, at the end of the list)
          const idx = others.findIndex((o) => o.id === r.id);
          const before = !!drag && !isDragged && idx === drag.to;
          const after = !!drag && !isDragged && idx === others.length - 1 && drag.to >= others.length;
          return (
            <div
              className={`arxiv-item${isDragged ? ' arxiv-item--drag' : ''}${before ? ' arxiv-item--before' : ''}${after ? ' arxiv-item--after' : ''}`}
              key={r.id}
              onPointerDown={(e) => startDrag(e, r.id, i)}
            >
              <div className="arxiv-item__top">
                <span className="arxiv-item__grip" aria-hidden>⋮⋮</span>
                <input
                  type="checkbox"
                  data-norow
                  checked={!leftOut.includes(r.id)}
                  onChange={() => onToggleListed(r.id)}
                  title="In the list"
                  aria-label="In the list"
                />
                <button type="button" className="arxiv-item__name" onClick={() => onFocusSheet(r.id)} title={bareForm(r.target)}>
                  {shortName(r.target)}
                </button>
                <button
                  type="button"
                  data-norow
                  className="arxiv-bar__btn arxiv-item__x"
                  onClick={() => onRemove(r.id)}
                  aria-label="Remove paper"
                  title="Remove this paper"
                >
                  ✕
                </button>
              </div>
              {r.error && <div className="arxiv-item__status arxiv-item__status--bad">{r.error}</div>}
            </div>
          );
        })}
      </div>

      <div className="arxiv-bar__hint">
        <button type="button" className="arxiv-bar__reset" onClick={onReset}>
          Restore default (R)
        </button>
      </div>
    </div>
  );
}
