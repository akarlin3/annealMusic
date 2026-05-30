import { describe, expect, it } from 'vitest';

// Whitelist rules matching pyodide-worker.js
const ALLOWED_MODULES = new Set([
  'numpy',
  'scipy',
  'matplotlib',
  'pandas',
  'sklearn',
  'pyarrow',
  'anneal',
  'sys',
  'types',
  'uuid',
  'math',
  'time',
  'io',
  'json',
  'asyncio',
  'itertools',
  'builtins',
  'os',
  'collections',
  'functools',
  're',
  'warnings',
  'datetime',
  'random',
  'copy',
  'abc',
  'traceback',
  'weakref',
  'operator',
  'inspect',
  'typing',
]);

function detectImports(code: string): string[] {
  const imports = new Set<string>();
  const lines = code.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('import ')) {
      const content = line.substring(7);
      const parts = content.split(',');
      for (const p of parts) {
        const word = p.trim().split(/\s+/)[0] || '';
        const root = word.split('.')[0] || '';
        if (root) imports.add(root);
      }
    } else if (line.startsWith('from ')) {
      const match = line.match(/^from\s+([a-zA-Z0-9_]+)/);
      if (match && match[1]) {
        imports.add(match[1]);
      }
    }
  }
  return Array.from(imports);
}

describe('Whitelist Import Parser & Enforcer Guard', () => {
  it('correctly extracts standard import statements', () => {
    const code = `
import numpy as np
import pandas as pd
from scipy.signal import lfilter
import math, sys
    `;
    const imps = detectImports(code);
    expect(imps).toContain('numpy');
    expect(imps).toContain('pandas');
    expect(imps).toContain('scipy');
    expect(imps).toContain('math');
    expect(imps).toContain('sys');
  });

  it('permits whitelisted modules', () => {
    const imps = ['numpy', 'pandas', 'scipy', 'anneal', 'math'];
    for (const imp of imps) {
      expect(ALLOWED_MODULES.has(imp)).toBe(true);
    }
  });

  it('rejects forbidden third-party modules', () => {
    const badImps = [
      'requests',
      'urllib3',
      'socket',
      'django',
      'flask',
      'torch',
    ];
    for (const imp of badImps) {
      expect(ALLOWED_MODULES.has(imp)).toBe(false);
    }
  });
});
