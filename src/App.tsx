import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Nav from './components/Nav/Nav';
import './App.css';

// Eager load the main 3D page
import SummonersRift from './SummonersRift/SummonersRift';

// Lazy load other pages
const Welcome = lazy(() => import('./welcome/welcome'));
const Profile = lazy(() => import('./profile/profile'));
const Clicks = lazy(() => import('./animalclicks/clicks'));
const Projects = lazy(() => import('./projects/Projects'));
const Blog = lazy(() => import('./blog/Blog'));
const BlogPost = lazy(() => import('./blog/BlogPost'));

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
