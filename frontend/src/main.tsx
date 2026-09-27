import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/poppins/latin-800.css';
import '@fontsource/poppins/latin-900.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/latin-700-italic.css';

import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
