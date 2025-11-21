import React, { useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Home } from './views/Home';
import { Settings } from './views/Settings';
import { LyricsDetail } from './views/LyricsDetail';

const { HashRouter, Routes, Route, useLocation, useNavigate } = ReactRouterDOM;

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const backListener = CapacitorApp.addListener('backButton', () => {
      if (location.pathname === '/') {
        CapacitorApp.exitApp();
      } else {
        navigate(-1);
      }
    });

    return () => {
      backListener.then(h => h.remove());
    };
  }, [location, navigate]);

  return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/lyrics/:id" element={<LyricsDetail />} />
      </Routes>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;