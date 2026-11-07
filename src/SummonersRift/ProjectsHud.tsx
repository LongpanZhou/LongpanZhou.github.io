import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import ProjectCard from '../projects/ProjectCard';
import type { Project } from '../data/projects';
import PanelChrome from './PanelChrome';
import '../projects/projects.css';
import './projectsHud.css';

const GH_USER = 'LongpanZhou';
// The profile README lives in the repo named after the user: github.com/LongpanZhou/LongpanZhou
const PROFILE_REPO = GH_USER;
const TTL_MS = 10 * 60 * 1000;
const NAV_HEIGHT = 84;
const NO_README = '<p><em>This repository has no README.</em></p>';

const rawBase = (repo: string) => `https://raw.githubusercontent.com/${GH_USER}/${repo}/HEAD/`;
const blobBase = (repo: string) => `https://github.com/${GH_USER}/${repo}/blob/HEAD/`;

// ---------------------------------------------------------------------------------------------
// README fetching: GitHub's own rendered HTML, cleaned, cached for ten minutes
// ---------------------------------------------------------------------------------------------

interface ReadmeState {
  html: string | null; // null if it could not be loaded
  loading: boolean;
}

const cacheKey = (repo: string) => `gh-readme-html-v2:${repo}`;

function readCache(repo: string): string | null {
  try {
    const raw = localStorage.getItem(cacheKey(repo));
    if (raw) {
      const cached = JSON.parse(raw) as { at: number; html: string };
      if (Date.now() - cached.at < TTL_MS) return cached.html;
    }
  } catch {
    /* storage blocked or corrupt: fetch instead */
  }
  return null;
}

/** A repository's README (`LongpanZhou/<repo>`), fetched live. Reads the cache synchronously. */
export function useRepoReadme(repo: string, enabled = true): ReadmeState {
  const [state, setState] = useState<ReadmeState>(() => {
    const cached = enabled ? readCache(repo) : null;
    return cached !== null ? { html: cached, loading: false } : { html: null, loading: true };
  });

  useEffect(() => {
    if (!enabled) return;
    const cached = readCache(repo);
    if (cached !== null) {
      setState({ html: cached, loading: false });
      return;
    }
    const controller = new AbortController();
    fetch(`https://api.github.com/repos/${GH_USER}/${repo}/readme`, {
      signal: controller.signal,
      // GitHub's rendered HTML, so the README looks the way it does on github.com
      headers: { Accept: 'application/vnd.github.html+json' },
    })
      .then(async (res) => {
        if (res.status === 404) return NO_README; // a repository without a README
        if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
        return cleanReadme(await res.text(), repo);
      })
      .then((html) => {
        try {
          localStorage.setItem(cacheKey(repo), JSON.stringify({ at: Date.now(), html }));
        } catch {
          /* non-fatal */
        }
        setState({ html, loading: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ html: null, loading: false });
      });
    return () => controller.abort();
  }, [repo, enabled]);

  return state;
}

/** The profile README, used to have it ready before the Projects view opens. */
export function useReadme(enabled: boolean): ReadmeState {
  return useRepoReadme(PROFILE_REPO, enabled);
}

const isAbsolute = (url: string) => /^(https?:|data:|mailto:|#|\/\/)/i.test(url);
const repoPath = (url: string) => url.replace(/^\.?\//, '');

/**
 * Makes GitHub's rendered README safe and self-contained: scripts, styles, frames and event
 * handlers are removed, relative image and link paths point at the repo, and links open in a new
 * tab. GitHub already sanitises this HTML; this is a second pass.
 */
function cleanReadme(html: string, repo: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, form, link, meta').forEach((el) => el.remove());
  doc.querySelectorAll<HTMLElement>('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name) || /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
    }
  });
  doc.querySelectorAll<HTMLElement>('[src], [srcset]').forEach((el) => {
    const src = el.getAttribute('src');
    if (src && !isAbsolute(src)) el.setAttribute('src', rawBase(repo) + repoPath(src));
    const srcset = el.getAttribute('srcset');
    if (srcset) {
      el.setAttribute(
        'srcset',
        srcset
          .split(',')
          .map((part) => {
            const [url, ...rest] = part.trim().split(/\s+/);
            return [isAbsolute(url) ? url : rawBase(repo) + repoPath(url), ...rest].join(' ');
          })
          .join(', '),
      );
    }
  });
  doc.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('#')) {
      // In-page anchors have nowhere to scroll to in this panel
      a.removeAttribute('href');
      return;
    }
    if (!isAbsolute(href)) a.setAttribute('href', blobBase(repo) + repoPath(href));
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  // The panel is always dark, so a <picture> that offers a dark variant uses it (the browser
  // would otherwise pick by the system theme and show a light image on a dark panel)
  doc.querySelectorAll('picture').forEach((picture) => {
    const dark = picture.querySelector<HTMLSourceElement>('source[media*="dark"]');
    const img = picture.querySelector('img');
    const darkSrc = dark?.getAttribute('srcset')?.split(',')[0].trim().split(/\s+/)[0];
    if (img && darkSrc) img.setAttribute('src', darkSrc);
    picture.querySelectorAll('source').forEach((source) => source.remove());
  });
  // The heading anchor icons GitHub puts next to every heading are not useful here
  doc.querySelectorAll('a.anchor').forEach((el) => el.remove());
  return doc.body.innerHTML;
}

// ---------------------------------------------------------------------------------------------
// Dragging a repository out of the Projects box opens its README
// ---------------------------------------------------------------------------------------------

const CHIP_W = 220;
const CHIP_H = 56;

// The small card that is carried while a repository is dragged. It is added to <body>, so it can
// be moved over the whole page, outside the Projects box.
function makeChip(project: Project): HTMLDivElement {
  const chip = document.createElement('div');
  chip.className = 'rift-chip';
  const name = document.createElement('span');
  name.className = 'rift-chip__name';
  name.textContent = project.name;
  const hint = document.createElement('span');
  hint.className = 'rift-chip__hint';
  hint.textContent = 'README.md';
  chip.append(name, hint);
  return chip;
}

// An agent-style cursor, used when the first README is carried out of the Projects box by itself
function makeAgentCursor(label: string): HTMLDivElement {
  const cursor = document.createElement('div');
  cursor.className = 'rift-agent';
  cursor.innerHTML =
    '<svg width="18" height="22" viewBox="0 0 18 22"><path d="M1 1 L1 17 L5.2 13.2 L8 19.6 L10.6 18.5 L7.9 12.2 L13.6 12.2 Z" fill="#0AC8FF" stroke="#010a13" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  const tag = document.createElement('span');
  tag.className = 'rift-agent__tag';
  tag.textContent = label;
  cursor.appendChild(tag);
  return cursor;
}

// The README's HTML. It is written into the element once per change of the HTML, by hand and
// not through React's dangerouslySetInnerHTML, and the component is memoised. The map page
// re-renders about ten times a second (the camera readout), and rewriting the HTML on any of those
// renders restarts the animated SVG at its first frame.
const ReadmeBody = memo(function ReadmeBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== html) el.innerHTML = html;
  }, [html]);
  return <div ref={ref} className="rift-doc__scroll markdown-body" data-nodrag />;
});

interface OpenReadme {
  id: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  from?: DOMRect; // where the card was when it was dropped: the panel expands out of it
}

const clampTo = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

// The README panel a card turns into when it is dropped at (x, y), the centre of the chip. Both a
// drag by the user and the automatic profile README go through this, so they are identical: same
// title, same size, and the panel expands out of the chip's rectangle.
function dropSpec(x: number, y: number): Omit<OpenReadme, 'id' | 'name' | 'z'> {
  const w = Math.min(window.innerWidth * 0.4, 560);
  const h = Math.min(window.innerHeight - NAV_HEIGHT - 24, 640);
  return {
    x: clampTo(x - CHIP_W / 2, 12, window.innerWidth - w - 12),
    y: clampTo(y - CHIP_H / 2, NAV_HEIGHT, window.innerHeight - h - 12),
    w,
    h,
    from: new DOMRect(x - CHIP_W / 2, y - CHIP_H / 2, CHIP_W, CHIP_H),
  };
}

// A README panel. It has the same drag and minimize controls as the other boxes, plus a close
// button, and expands out of the card it was opened from.
function RepoReadme({
  item,
  onClose,
  onFocus,
}: {
  item: OpenReadme;
  onClose: (id: number) => void;
  onFocus: (id: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { html, loading } = useRepoReadme(item.name);

  // Expand from the card's rectangle to the panel's own. Measured with any running animation
  // cleared first, because getBoundingClientRect includes transforms.
  useLayoutEffect(() => {
    const el = ref.current;
    const from = item.from;
    if (!el || !from) return;
    gsap.killTweensOf(el);
    gsap.set(el, { clearProps: 'transform,opacity' });
    const to = el.getBoundingClientRect();
    if (to.width === 0 || to.height === 0) return;
    gsap.fromTo(
      el,
      {
        x: from.left - to.left,
        y: from.top - to.top,
        scaleX: from.width / to.width,
        scaleY: from.height / to.height,
        opacity: 0.4,
        transformOrigin: '0 0',
      },
      { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, duration: 0.55, ease: 'power3.out', clearProps: 'transform,opacity' },
    );
    return () => {
      gsap.killTweensOf(el);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={ref}
      className="hud-box rift-doc rift-doc--float"
      style={{ left: item.x, top: item.y, width: item.w, height: item.h, zIndex: 1010 + item.z }}
      onPointerDownCapture={() => onFocus(item.id)}
    >
      {/* Not remembered between visits: a README opens where it was dropped */}
      <PanelChrome
        id={`tmp:readme:${item.id}`}
        label={item.name}
        onClose={() => onClose(item.id)}
        resizable
        fit={false}
        minWidth={320}
        minHeight={200}
      />
      <div className="rift-doc__head">
        <h2 className="rift-doc__title">
          {item.name}
          <span className="rift-doc__file">/README.md</span>
        </h2>
      </div>
      <ReadmeBody
        html={
          loading
            ? '<p>Loading README…</p>'
            : html ?? "<p>Couldn't load this README from GitHub right now.</p>"
        }
      />
    </div>
  );
}

/**
 * What the Projects view shows over the map: the Projects box (every repo, drawn by the HUD
 * agents) and the README panels opened from it. Every repo card can be dragged out of the box;
 * dropping it anywhere outside opens that repository's README there. The profile README is opened
 * automatically, carried out of the box to the left side.
 */
export default function ProjectsHud({ projects }: { projects: Project[] }) {
  const [open, setOpen] = useState<OpenReadme[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const zRef = useRef(0);
  const idRef = useRef(1);

  const openReadme = useCallback((name: string, spec: Omit<OpenReadme, 'id' | 'name' | 'z'>) => {
    zRef.current += 1;
    const z = zRef.current;
    setOpen((list) => {
      const existing = list.find((o) => o.name === name);
      // Already open: just bring it to the front
      if (existing) return list.map((o) => (o === existing ? { ...o, z } : o));
      return [...list, { id: idRef.current++, name, z, ...spec }];
    });
  }, []);

  const close = useCallback((id: number) => setOpen((list) => list.filter((o) => o.id !== id)), []);

  const focus = useCallback((id: number) => {
    setOpen((list) => {
      const top = Math.max(...list.map((o) => o.z));
      const item = list.find((o) => o.id === id);
      if (!item || item.z === top) return list;
      zRef.current += 1;
      const z = zRef.current;
      return list.map((o) => (o.id === id ? { ...o, z } : o));
    });
  }, []);

  // The profile README: a chip of its card is carried out of the Projects box by an agent cursor,
  // dropped on the left side, and the README expands out of it.
  useEffect(() => {
    if (!projects.some((p) => p.name === PROFILE_REPO)) return;
    let cancelled = false;
    const cleanup: Array<() => void> = [];

    const begin = () => {
      if (cancelled) return;
      // Dropped near the top of the left side, as a user dropping it there would
      const end = new DOMPoint(24 + 16 + CHIP_W / 2, NAV_HEIGHT + 16 + CHIP_H / 2);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        openReadme(PROFILE_REPO, { ...dropSpec(end.x, end.y), from: undefined });
        return;
      }

      // Start on the repo's own card when it is on screen, otherwise on the box itself
      const card = document.querySelector<HTMLElement>(`[data-repo="${PROFILE_REPO}"]`);
      card?.scrollIntoView({ block: 'nearest' });
      const box = boxRef.current?.getBoundingClientRect();
      const cardRect = card?.getBoundingClientRect();
      const start =
        cardRect && cardRect.width > 0
          ? new DOMPoint(cardRect.left + cardRect.width / 2, cardRect.top + cardRect.height / 2)
          : new DOMPoint((box?.left ?? window.innerWidth * 0.6) + 120, (box?.top ?? 160) + 80);

      const chip = makeChip(projects.find((p) => p.name === PROFILE_REPO) as Project);
      const cursor = makeAgentCursor(`agent.grid → ${PROFILE_REPO}/README.md`);
      document.body.append(chip, cursor);
      gsap.set(chip, { x: start.x - CHIP_W / 2, y: start.y - CHIP_H / 2, opacity: 0, scale: 0.9 });
      gsap.set(cursor, { x: start.x, y: start.y, opacity: 0 });
      const tl = gsap.timeline({
        onComplete: () => {
          chip.remove();
          cursor.remove();
          if (!cancelled) openReadme(PROFILE_REPO, dropSpec(end.x, end.y));
        },
      });
      tl.to([chip, cursor], { opacity: 1, scale: 1, duration: 0.25, ease: 'power1.out' })
        .to(chip, { x: end.x - CHIP_W / 2, y: end.y - CHIP_H / 2, duration: 0.8, ease: 'power2.inOut' }, '+=0.1')
        .to(cursor, { x: end.x - CHIP_W / 2 + 40, y: end.y - CHIP_H / 2 + 14, duration: 0.8, ease: 'power2.inOut' }, '<');
      cleanup.push(() => {
        tl.kill();
        chip.remove();
        cursor.remove();
      });
    };

    // Wait until the Projects box is drawn and the last card has started typing (the typing then
    // finishes while the README is on its way), then a short beat, then carry the README out. The
    // check starts after the HUD has picked the box up, and gives up waiting after eight seconds.
    const started = performance.now();
    let timer = 0;
    const check = () => {
      if (cancelled) return;
      const box = boxRef.current;
      const rendered = !!box && !box.classList.contains('hud-hold') && !box.querySelector('.hud-pending');
      if (rendered || performance.now() - started > 8000) {
        timer = window.setTimeout(begin, 300);
        return;
      }
      timer = window.setTimeout(check, 120);
    };
    timer = window.setTimeout(check, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cleanup.forEach((fn) => fn());
    };
  }, [projects, openReadme]);

  // Pressing on a card and moving carries a chip with the pointer. Releasing outside the Projects
  // box opens that repository's README at the drop point; releasing inside cancels. Links in the
  // card keep working because a press on them never starts a drag.
  const startDrag = (e: React.PointerEvent<HTMLElement>, project: Project) => {
    if (e.button !== 0 || (e.target as Element).closest('a, button')) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let chip: HTMLDivElement | null = null;

    const place = (x: number, y: number) => {
      if (chip) chip.style.transform = `translate(${x - CHIP_W / 2}px, ${y - CHIP_H / 2}px)`;
    };
    const move = (ev: PointerEvent) => {
      if (!chip) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
        chip = makeChip(project);
        document.body.appendChild(chip);
        document.documentElement.classList.add('rift-dragging');
      }
      place(ev.clientX, ev.clientY);
    };
    const stop = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      if (!chip) return;
      chip.remove();
      document.documentElement.classList.remove('rift-dragging');
      if (ev.type === 'pointercancel') return;
      const box = boxRef.current?.getBoundingClientRect();
      const inside =
        box && ev.clientX >= box.left && ev.clientX <= box.right && ev.clientY >= box.top && ev.clientY <= box.bottom;
      if (inside) return;
      openReadme(project.name, dropSpec(ev.clientX, ev.clientY));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };

  return (
    <>
      <div
        ref={boxRef}
        className="hud-box rift-doc rift-doc--projects"
        data-hud-draw="Projects"
        data-hud-always
        data-hud-fixed
      >
        {/* Drag, resize and minimize. No close: this is the view's main box. */}
        <PanelChrome id="projects-box" label="Projects" resizable fit={false} minWidth={320} minHeight={200} />
        <div className="rift-doc__head">
          <h2 className="rift-doc__title" data-hud-type>Projects</h2>
          <span className="rift-doc__pill" data-hud-fade>{projects.length} repositories</span>
        </div>
        <div className="rift-doc__scroll rift-doc__grid" data-nodrag>
          {projects.map((project) => (
            <div
              key={project.name}
              className="rift-card"
              data-hud-group
              data-hud-fade
              data-repo={project.name}
              onPointerDown={(e) => startDrag(e, project)}
            >
              <ProjectCard project={project} />
            </div>
          ))}
        </div>
      </div>

      {open.map((item) => (
        <RepoReadme key={item.id} item={item} onClose={close} onFocus={focus} />
      ))}
    </>
  );
}
