import ReactDOM from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import Clicks from './animalclicks/clicks.tsx';
import SummonersRiftTest from './test/SummonersRiftTest.tsx';
import React from 'react';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/animalclicks" element={<Clicks/>} />
        <Route path="/test" element={<SummonersRiftTest/>} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);