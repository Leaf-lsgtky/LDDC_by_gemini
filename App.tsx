import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Home } from './views/Home';
import { Settings } from './views/Settings';
import { LyricsDetail } from './views/LyricsDetail';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/lyrics/:id" element={<LyricsDetail />} />
      </Routes>
    </HashRouter>
  );
};

export default App;