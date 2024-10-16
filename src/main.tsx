import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import Clicks from './animalclicks/clicks.tsx';
import './metaball.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Router>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/animalclicks" element={<Clicks />} />
    </Routes>
  </Router>
);