// Text-block extraction for the in-place "replace" translation view.
//
// PDF.js gives us a flat list of positioned text fragments. To swap the
// text for a translation while keeping the page's look, we need to
// reassemble those fragments into lines and then into paragraph-ish
// blocks, each with a bounding box. All coordinates are in the pixel
// space of a scale-1 viewport; the renderer multiplies by the live zoom.

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFPageProxy } from 'pdfjs-dist';

export interface Block {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  fontH: number;
  text: string;
  /**
   * Whether this block looks like prose worth translating. Equations,
   * numeric table cells and symbol-heavy fragments are marked false so
   * the renderer leaves the original pixels untouched.
   */
  translatable: boolean;
}

const LETTER_RE = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/g;
const MATH_RE = /[=+\-*/^_<>≤≥≈≠±×÷∑∏∫√∞∝∈∉⊂⊆∪∩∀∃∇∂·•…∥⟨⟩]/g;

/** Content-only guess at "is this a sentence, or an equation/table cell?". */
function isTranslatable(text: string, oneLine: boolean): boolean {
  const t = text.trim();
  const noSpace = t.replace(/\s+/g, '');
  if (noSpace.length < 2) return false;
  const letters = (noSpace.match(LETTER_RE) || []).length;
  const digits = (noSpace.match(/\d/g) || []).length;
  const math = (noSpace.match(MATH_RE) || []).length;
  if (letters / noSpace.length < 0.5) return false; // mostly digits/symbols
  if ((digits + math) / noSpace.length > 0.3) return false; // equation / data row
  // a single line built around "=" with a paren or digit is a display equation
  if (oneLine && /=/.test(t) && /[()\d]/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return true; // clearly prose
  return letters >= 8; // short but enough letters to be a heading
}

interface Frag {
  str: string;
  x0: number;
  x1: number;
  baseline: number;
  fontH: number;
}

interface Line {
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  fontH: number;
  text: string;
}

const median = (nums: number[]): number => {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function makeLine(frags: Frag[]): Line {
  const fontH = median(frags.map((f) => f.fontH)) || 10;
  const text = frags
    .map((f) => f.str)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    x0: Math.min(...frags.map((f) => f.x0)),
    x1: Math.max(...frags.map((f) => f.x1)),
    top: Math.min(...frags.map((f) => f.baseline - f.fontH)),
    bottom: Math.max(...frags.map((f) => f.baseline)),
    fontH,
    text,
  };
}

export async function extractBlocks(page: PDFPageProxy): Promise<Block[]> {
  const viewport = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();

  const frags: Frag[] = [];
  for (const item of tc.items as Array<Record<string, unknown>>) {
    const str = item.str;
    if (typeof str !== 'string' || !str.trim()) continue;
    const tr = pdfjsLib.Util.transform(
      viewport.transform,
      item.transform as number[],
    );
    const fontH = Math.hypot(tr[2], tr[3]) || Math.hypot(tr[0], tr[1]) || 10;
    const x0 = tr[4];
    const baseline = tr[5];
    const width = typeof item.width === 'number' ? item.width : fontH * str.length * 0.5;
    frags.push({ str, x0, x1: x0 + width, baseline, fontH });
  }
  if (!frags.length) return [];

  // 1. group fragments into rows by shared baseline
  frags.sort((a, b) => a.baseline - b.baseline || a.x0 - b.x0);
  const rows: Frag[][] = [];
  for (const f of frags) {
    const row = rows[rows.length - 1];
    const rowBase = row ? median(row.map((r) => r.baseline)) : null;
    const tol = Math.max(f.fontH, row ? median(row.map((r) => r.fontH)) : f.fontH) * 0.4;
    if (row && rowBase !== null && Math.abs(f.baseline - rowBase) <= tol) {
      row.push(f);
    } else {
      rows.push([f]);
    }
  }

  // 2. split each row into lines where there's a big horizontal gap
  //    (separate columns, or figure labels beside a paragraph)
  const lines: Line[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x0 - b.x0);
    const fh = median(row.map((r) => r.fontH)) || 10;
    let group: Frag[] = [];
    for (const f of row) {
      if (group.length && f.x0 - group[group.length - 1].x1 > fh * 4) {
        lines.push(makeLine(group));
        group = [];
      }
      group.push(f);
    }
    if (group.length) lines.push(makeLine(group));
  }

  // 3. merge consecutive lines into blocks: close vertically, overlapping
  //    horizontally, similar font size
  lines.sort((a, b) => a.top - b.top || a.x0 - b.x0);
  interface Acc {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    fontH: number;
    lines: Line[];
  }
  const blocks: Acc[] = [];
  for (const ln of lines) {
    const b = blocks[blocks.length - 1];
    const gap = b ? ln.top - b.y1 : Infinity;
    const overlap = b ? Math.min(ln.x1, b.x1) - Math.max(ln.x0, b.x0) : -1;
    const minWidth = b ? Math.min(ln.x1 - ln.x0, b.x1 - b.x0) : 0;
    const sameFont = b ? Math.abs(ln.fontH - b.fontH) <= b.fontH * 0.3 : false;
    if (b && sameFont && gap <= b.fontH * 0.9 && overlap > minWidth * 0.3) {
      b.x0 = Math.min(b.x0, ln.x0);
      b.x1 = Math.max(b.x1, ln.x1);
      b.y1 = ln.bottom;
      b.lines.push(ln);
    } else {
      blocks.push({
        x0: ln.x0,
        y0: ln.top,
        x1: ln.x1,
        y1: ln.bottom,
        fontH: ln.fontH,
        lines: [ln],
      });
    }
  }

  const pad = (b: Acc): Block => {
    // de-hyphenate line joins, then pad the box a hair so anti-aliased
    // edges of the original glyphs don't peek out around the cover.
    let text = '';
    b.lines.forEach((ln, i) => {
      if (i === 0) {
        text = ln.text;
      } else if (/[A-Za-z]-$/.test(text)) {
        text = text.slice(0, -1) + ln.text;
      } else {
        text += ' ' + ln.text;
      }
    });
    const clean = text.replace(/\s+/g, ' ').trim();
    const m = b.fontH * 0.18;
    return {
      x0: b.x0 - 2,
      y0: b.y0 - m,
      x1: b.x1 + 2,
      y1: b.y1 + m,
      fontH: b.fontH,
      text: clean,
      translatable: isTranslatable(clean, b.lines.length === 1),
    };
  };

  return blocks.map(pad).filter((b) => b.text.length > 0);
}
