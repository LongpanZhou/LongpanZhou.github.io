import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Nav.css';

interface NavProps {
  transparent?: boolean;
}

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/projects', label: 'Projects' },
  { to: '/blog', label: 'Blog' },
];

function Nav({ transparent = false }: NavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `hex-nav__link${isActive ? ' hex-nav__link--active' : ''}`;

  return (
    <>
      <nav className={`hex-nav ${transparent ? 'hex-nav--transparent' : 'hex-nav--solid'}`}>
        <NavLink to="/" className="hex-nav__brand" onClick={() => setMenuOpen(false)}>
          Longpan Zhou
        </NavLink>

        <ul className="hex-nav__links">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className={linkClass} end={item.to === '/'}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

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
            className={linkClass}
            end={item.to === '/'}
            onClick={() => setMenuOpen(false)}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </>
  );
}

export default Nav;
