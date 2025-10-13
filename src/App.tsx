import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SummonersRift from './SummonersRift/SummonersRift';
import Welcome from './welcome/welcome';
import Profile from './profile/profile';
import Clicks from './animalclicks/clicks';
import './App.css';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SummonersRift />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/animalclicks" element={<Clicks />} />
      </Routes>
    </Router>
  );
};

export default App;