import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Nav from './components/Nav/Nav';
import './App.css';
import './components/TargetLock.css';
import { isMobile } from './utils/isMobile';

// Lazy load pages. The 3D Rift pulls in Three.js + a 26 MB model; keeping it
// out of the initial bundle lets the nav render and stay clickable while it
// downloads and parses.
const SummonersRift = lazy(() => import('./SummonersRift/SummonersRift'));
const Welcome = lazy(() => import('./welcome/welcome'));
const Profile = lazy(() => import('./profile/profile'));
const Clicks = lazy(() => import('./animalclicks/clicks'));
const BlogPost = lazy(() => import('./blog/BlogPost'));

function AppLayout() {
  const location = useLocation();
  // The home map and the Projects view are one scene: the camera moves, the page does not reload
  // Home, Projects, Blog and the PDF viewer (every address the pages below do not claim) are all
  // the same map, seen from different camera poses
  const PAGES = ['/welcome', '/profile', '/animalclicks'];
  const isPdf = !['/', '/projects', '/blog', ...PAGES].includes(location.pathname) && !location.pathname.startsWith('/blog/');
  const isHome = ['/', '/projects', '/blog'].includes(location.pathname) || isPdf;

  // The home page's text cannot be selected. Other pages keep normal selection.
  useEffect(() => {
    if (!isHome) return;
    document.body.classList.add('home-no-select');
    return () => document.body.classList.remove('home-no-select');
  }, [isHome]);

  return (
    <>
      <Nav transparent={isHome} />
      <Suspense fallback={
        <div style={{
          minHeight: '100vh',
          background: '#0A1428',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#C8AA6E',
          fontFamily: '"Beaufort for LOL", "Times New Roman", serif',
          fontSize: '18px',
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          Loading...
        </div>
      }>
        <Routes>
          <Route path="/" element={<SummonersRift />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/animalclicks" element={<Clicks />} />
          <Route path="/projects" element={<SummonersRift />} />
          <Route path="/blog" element={<SummonersRift />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          {/* Any other path is treated as a PDF URL to proxy-render,
              e.g. /arxiv.org/pdf/1706.03762 */}
          <Route path="*" element={<SummonersRift />} />
        </Routes>
      </Suspense>
    </>
  );
}

// The site is built for a desktop browser: the 3D map, HUD panels and layout tools need a
// mouse and a large screen, so phones and tablets get a notice instead.
function MobileNotice() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A1428',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: '24px',
      textAlign: 'center',
      color: '#C8AA6E',
      fontFamily: '"Beaufort for LOL", "Times New Roman", serif',
    }}>
      <h1 style={{ fontSize: '22px', letterSpacing: '3px', textTransform: 'uppercase', margin: 0 }}>
        Desktop only
      </h1>
      <p style={{ color: '#A09B8C', maxWidth: '320px', lineHeight: 1.6, margin: 0 }}>
        This website isn't available on mobile devices. Please visit it from a desktop or laptop browser.
      </p>
    </div>
  );
}

function App() {
  if (isMobile()) return <MobileNotice />;
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;
