import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { LearnApp } from './LearnApp';
import '@/styles/index.css';
import './learn.css';

const rootEl = document.getElementById('learn-root');
if (!rootEl) {
  throw new Error('Root element #learn-root not found');
}

createRoot(rootEl).render(createElement(LearnApp));
