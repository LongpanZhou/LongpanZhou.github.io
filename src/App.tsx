import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Nav from './components/Nav/Nav';
import './App.css';

// Lazy load pages. The 3D Rift pulls in Three.js + a 26 MB model; keeping it
// out of the initial bundle lets the nav render and stay clickable while it
// downloads and parses.
const SummonersRift = lazy(() => import('./SummonersRift/SummonersRift'));
const Welcome = lazy(() => import('./welcome/welcome'));
const Profile = lazy(() => import('./profile/profile'));
const Clicks = lazy(() => import('./animalclicks/clicks'));
const Projects = lazy(() => import('./projects/Projects'));
const Blog = lazy(() => import('./blog/Blog'));
const BlogPost = lazy(() => import('./blog/BlogPost'));
const PdfViewer = lazy(() => import('./pdf/PdfViewer'));

function AppLayout() {
  const location = useLocation();
  const isHome = location.pathname === '/';

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
          <Route path="/projects" element={<Projects />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          {/* Any other path is treated as a PDF URL to proxy-render,
              e.g. /arxiv.org/pdf/1706.03762 */}
          <Route path="*" element={<PdfViewer />} />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;
