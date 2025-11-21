import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("index.tsx execution started");

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }
  console.log("Root element found, creating root...");

  const root = ReactDOM.createRoot(rootElement);
  
  console.log("Rendering React App...");
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("React App rendered triggered");
} catch (e) {
  console.error("React Mount Error: " + e);
}
