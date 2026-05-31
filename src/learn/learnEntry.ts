import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { LearnApp } from './LearnApp';
import '@/styles/index.css';
import './learn.css';
import { initializeErrorReporter } from '@/observability/errorReporter';
import { ModeProvider } from '@/mode/ModeContext';
import { ModeAesthetic } from '@/design/ModeAesthetic';

// Boot error reporter
initializeErrorReporter();

const rootEl = document.getElementById('learn-root');
if (!rootEl) {
  throw new Error('Root element #learn-root not found');
}

createRoot(rootEl).render(
  createElement(
    ModeProvider,
    null,
    createElement(ModeAesthetic, null, createElement(LearnApp)),
  ),
);
