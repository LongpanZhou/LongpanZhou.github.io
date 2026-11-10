import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { MouseEvent } from 'react';
import { leaveThen } from '../../utils/viewTransition';
import './Nav.css';

interface NavProps {
  transparent?: boolean;
}

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/projects', label: 'Projects' },
  { to: '/blog', label: 'Blog' },
  { to: '/arxiv', label: 'arXiv' },
];

function Nav({ transparent = false }: NavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const { pathname } = useLocation();
  const navigate = useNavigate();
  // A click on a link first fades out what the current view shows, then goes there
  const go = (to: string) => (e: MouseEvent) => {
    setMenuOpen(false);
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    // The link lights up on the click itself, while the old view is still fading out
    if (to !== pathname && leaveThen(() => navigate(to))) setPending(to);
  };
  // The arXiv link stands for the default paper at /arxiv and for any PDF address (/arxiv.org/pdf/...)
  const onArxiv = !['/', '/projects', '/blog', '/welcome', '/profile', '/animalclicks'].includes(pathname) && !pathname.startsWith('/blog/');
  const here = (to: string) =>
    to === '/arxiv' ? onArxiv : to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
  // The link that was just clicked, until the address has caught up with it
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);
  const activeTo = pending ?? navItems.find((item) => here(item.to))?.to ?? null;
  const linkClass = (to: string) => () => `hex-nav__link${to === activeTo ? ' hex-nav__link--active' : ''}`;

  // One underline for the whole menu, which slides from the old link to the new one. It is placed
  // under the active link by measuring it, again whenever the bar's size or the font changes.
  const linksRef = useRef<HTMLUListElement>(null);
  const [mark, setMark] = useState<{ x: number; y: number; w: number } | null>(null);
  const [markMoves, setMarkMoves] = useState(false); // off for the first placement, so it does not slide in from the corner
  useLayoutEffect(() => {
    const list = linksRef.current;
    if (!list) return;
    const place = () => {
      const link = activeTo ? list.querySelector<HTMLElement>(`[data-nav-to="${activeTo}"]`) : null;
      if (!link || link.offsetWidth === 0) {
        setMark(null);
        return;
      }
      const a = link.getBoundingClientRect();
      const b = list.getBoundingClientRect();
      setMark((old) => {
        const next = { x: a.left - b.left, y: a.bottom - b.top - 2, w: a.width };
        return old && old.x === next.x && old.y === next.y && old.w === next.w ? old : next;
      });
    };
    place();
    const watcher = new ResizeObserver(place);
    watcher.observe(list);
    document.fonts?.ready.then(place).catch(() => {});
    return () => watcher.disconnect();
  }, [activeTo]);
  useEffect(() => {
    if (!mark || markMoves) return;
    const frame = requestAnimationFrame(() => setMarkMoves(true));
    return () => cancelAnimationFrame(frame);
  }, [mark, markMoves]);

  return (
    <>
      <nav className={`hex-nav ${transparent ? 'hex-nav--transparent' : 'hex-nav--solid'}`} data-hud-draw="Nav bar">
        <NavLink to="/" className="hex-nav__brand" onClick={go('/')} data-hud-type>
          Longpan Zhou
        </NavLink>

        <ul className="hex-nav__links" data-hud-draw="Menu" ref={linksRef}>
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className={linkClass(item.to)} end={item.to === '/'} onClick={go(item.to)} data-nav-to={item.to}>
                {item.label}
              </NavLink>
            </li>
          ))}
          <li
            className={`hex-nav__mark${mark ? ' hex-nav__mark--on' : ''}${markMoves ? ' hex-nav__mark--moves' : ''}`}
            style={mark ? { width: mark.w, transform: `translate(${mark.x}px, ${mark.y}px)` } : undefined}
            aria-hidden="true"
          />
        </ul>

        <span className="hex-nav__status" aria-hidden="true" data-hud-draw="Status">
          <span className="hex-nav__status-dot" />
          ONLINE
        </span>

        <button
          className={`hex-nav__hamburger${menuOpen ? ' hex-nav__hamburger--open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      {/* Mobile fullscreen overlay */}
      <div className={`hex-nav__overlay${menuOpen ? ' hex-nav__overlay--open' : ''}`}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={linkClass(item.to)}
            end={item.to === '/'}
            onClick={go(item.to)}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </>
  );
}

export default Nav;
