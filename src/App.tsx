import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

const SummonersRift = React.lazy(() => import('./SummonersRift/SummonersRift'));
const Welcome = React.lazy(() => import('./welcome/welcome'));
const Profile = React.lazy(() => import('./profile/profile'));
const Clicks = React.lazy(() => import('./animalclicks/clicks'));

const App: React.FC = () => {
  return (
    <Router>
      <Suspense fallback={<div style={{ width: '100vw', height: '100vh', background: '#010a13' }} />}>
        <Routes>
          <Route path="/" element={<SummonersRift />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/animalclicks" element={<Clicks />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
