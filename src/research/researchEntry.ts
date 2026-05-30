import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ResearchApp } from './ResearchApp';
import '@/styles/index.css';

const rootEl = document.getElementById('research-root');
if (!rootEl) {
  throw new Error('Research root element #research-root not found');
}

createRoot(rootEl).render(
  createElement(StrictMode, null, createElement(ResearchApp)),
);
