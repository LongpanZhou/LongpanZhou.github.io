import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Nav from './components/Nav/Nav';
import Loader from './components/Loader';
import './App.css';
import './components/TargetLock.css';

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
      {/* On the way to the map this is the same screen the map's own loading shows next, bar included,
          so the two follow each other without a cut */}
      <Suspense fallback={isHome ? <Loader label="Loading Summoner's Rift" progress={0} /> : <Loader label="Loading" />}>
        <Routes>
          <Route path="/" element={<SummonersRift />} />
          <Route path="/welcome" element={<div className="page-enter"><Welcome /></div>} />
          <Route path="/profile" element={<div className="page-enter"><Profile /></div>} />
          <Route path="/animalclicks" element={<div className="page-enter"><Clicks /></div>} />
          <Route path="/projects" element={<SummonersRift />} />
          <Route path="/blog" element={<SummonersRift />} />
          <Route path="/blog/:slug" element={<div className="page-enter"><BlogPost /></div>} />
          {/* Any other path is treated as a PDF URL to proxy-render,
              e.g. /arxiv.org/pdf/1706.03762 */}
          <Route path="*" element={<SummonersRift />} />
        </Routes>
      </Suspense>
    </>
  );
}

// Phones and tablets never get here: index.html shows them a notice and main.tsx stops there.
function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;
