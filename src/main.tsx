import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Initialize theme from localStorage or system preference
const saved = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const isDark = saved ? saved === 'dark' : prefersDark;
document.documentElement.classList.toggle('dark', isDark);

const root = createRoot(document.getElementById('root')!);

// DEV PREVIEW — do not merge
if (window.location.pathname === '/v1-preview') {
  import('./v1-prototypes/PreviewAll.jsx').then(({ default: PreviewAll }) => {
    root.render(<StrictMode><PreviewAll /></StrictMode>);
  });
} else {
  root.render(<StrictMode><App /></StrictMode>);
}
