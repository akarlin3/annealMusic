import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'AnnealMusic Research',
  description:
    'Complete API reference, recipe book, and academic integration guide for the AnnealMusic research sandbox.',
  base: '/research/',
  cleanUrls: true,
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'Guides', link: '/guides/getting-started' },
      { text: 'API Reference', link: '/reference/json-rpc' },
      { text: 'Recipe Book', link: '/recipes/' },
      { text: 'Main App', link: 'https://anneal.averykarlin.org' },
    ],
    sidebar: [
      {
        text: 'Research Guides',
        items: [
          { text: 'Getting Started', link: '/guides/getting-started' },
          { text: 'Academic Citation Guide', link: '/guides/citation' },
          {
            text: 'Version Pinning & Reproducibility',
            link: '/guides/version-pinning',
          },
          { text: 'API Stability Commitments', link: '/guides/stability' },
          { text: 'Security & Consent Protocols', link: '/guides/security' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'JSON-RPC Bridge', link: '/reference/json-rpc' },
          { text: 'OSC Address Namespace', link: '/reference/osc' },
          { text: 'Command Line Interface (CLI)', link: '/reference/cli' },
          { text: 'Python `anneal` Module', link: '/reference/python' },
          { text: 'Session Datalogger Schema', link: '/reference/datalogger' },
          {
            text: 'Perceptual Experiment Runner',
            link: '/reference/experiment',
          },
        ],
      },
      {
        text: 'Recipe Book',
        items: [
          { text: 'Overview', link: '/recipes/' },
          { text: 'Composer / Artist Recipes', link: '/recipes/composer' },
          { text: 'Music Technologist Recipes', link: '/recipes/technologist' },
          { text: 'Cognition Researcher Recipes', link: '/recipes/cognition' },
          { text: 'MIR & Machine Learning', link: '/recipes/mir-ml' },
          {
            text: 'Computational Science Adjacent',
            link: '/recipes/comp-science',
          },
          { text: 'Advanced Biofeedback', link: '/recipes/advanced' },
        ],
      },
    ],
    search: {
      provider: 'local',
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/akarlin3/annealMusic' },
    ],
    footer: {
      message: 'Released under the AGPL-3.0 License.',
      copyright: 'Copyright © 2026 Avery Karlin',
    },
  },
});
