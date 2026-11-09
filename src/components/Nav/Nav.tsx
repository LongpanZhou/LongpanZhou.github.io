import { useState } from 'react';
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
    if (to !== pathname) leaveThen(() => navigate(to));
  };
  // The arXiv link stands for the default paper at /arxiv and for any PDF address (/arxiv.org/pdf/...)
  const onArxiv = !['/', '/projects', '/blog', '/welcome', '/profile', '/animalclicks'].includes(pathname) && !pathname.startsWith('/blog/');
  const linkClass = (to: string) => ({ isActive }: { isActive: boolean }) =>
    `hex-nav__link${(to === '/arxiv' ? onArxiv : isActive) ? ' hex-nav__link--active' : ''}`;

  return (
    <>
      <nav className={`hex-nav ${transparent ? 'hex-nav--transparent' : 'hex-nav--solid'}`} data-hud-draw="Nav bar">
        <NavLink to="/" className="hex-nav__brand" onClick={go('/')} data-hud-type>
          Longpan Zhou
        </NavLink>

        <ul className="hex-nav__links" data-hud-draw="Menu">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className={linkClass(item.to)} end={item.to === '/'} onClick={go(item.to)}>
                {item.label}
              </NavLink>
            </li>
          ))}
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
