/**
 * The embed player — deliberately tiny and React-free (the whole bundle must
 * stay < 50 KB gzipped, a CI gate). It only *streams the v0.8 preview audio*:
 * no engine, no sculpt UI, no orchestrator. A single-row player with play/pause,
 * a scrub bar, the patch title + creator, and an AnnealMusic wordmark link.
 *
 * Stateless: no login, no anon id, no localStorage. Polite guest behavior.
 */
import { paletteFor, resolveTheme, type EmbedTheme } from '@/embed/theme';

interface PatchMeta {
  title: string | null;
  visibility: string;
}

export interface EmbedConfig {
  slug: string;
  theme: EmbedTheme;
  apiBase: string;
  origin: string;
  fetchImpl?: typeof fetch;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00';
  const t = Math.max(0, Math.floor(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * Mount the embed player into `root`. Returns a teardown function. Injectable
 * `fetchImpl` keeps it testable in jsdom.
 */
export async function mountEmbed(
  root: HTMLElement,
  config: EmbedConfig,
): Promise<() => void> {
  const pal = paletteFor(config.theme);
  const doFetch = config.fetchImpl ?? fetch;

  root.style.cssText = '';
  Object.assign(root.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxSizing: 'border-box',
    width: '100%',
    minWidth: '320px',
    height: '80px',
    padding: '0 14px',
    background: pal.bg,
    color: pal.fg,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });

  let meta: PatchMeta | null = null;
  try {
    const res = await doFetch(
      `${config.apiBase}/api/v1/patches/${encodeURIComponent(config.slug)}`,
    );
    if (res.ok) meta = (await res.json()) as PatchMeta;
  } catch {
    meta = null;
  }

  if (!meta || meta.visibility !== 'public') {
    renderGated(root, pal, config);
    return () => {
      root.innerHTML = '';
    };
  }

  const audio = new Audio(
    `${config.apiBase}/api/v1/patches/${encodeURIComponent(config.slug)}/preview`,
  );
  audio.preload = 'none';

  const playBtn = el('button', {
    flex: '0 0 auto',
    width: '40px',
    height: '40px',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    background: pal.accent,
    color: pal.bg,
    fontSize: '15px',
  });
  playBtn.textContent = '▶';
  playBtn.setAttribute('aria-label', 'Play');

  const mid = el('div', { flex: '1 1 auto', minWidth: '0' });
  const title = el(
    'div',
    {
      fontSize: '13px',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    meta.title || 'Untitled',
  );
  const sub = el(
    'div',
    { fontSize: '11px', color: pal.muted, marginTop: '2px' },
    'Anonymous',
  );
  const progress = el('input', {
    width: '100%',
    marginTop: '6px',
    accentColor: pal.accent,
  }) as HTMLInputElement;
  progress.type = 'range';
  progress.min = '0';
  progress.max = '100';
  progress.value = '0';
  progress.setAttribute('aria-label', 'Seek');
  mid.append(title, sub, progress);

  const time = el(
    'div',
    {
      flex: '0 0 auto',
      fontSize: '11px',
      color: pal.muted,
      fontVariantNumeric: 'tabular-nums',
    },
    '0:00',
  );

  const mark = el('a', {
    flex: '0 0 auto',
    fontSize: '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: pal.muted,
    textDecoration: 'none',
  }) as HTMLAnchorElement;
  mark.textContent = 'AnnealMusic';
  mark.href = `${config.origin}/p/${config.slug}`;
  mark.target = '_blank';
  mark.rel = 'noopener';

  root.innerHTML = '';
  root.append(playBtn, mid, time, mark);

  let seeking = false;
  const toggle = (): void => {
    if (audio.paused) void audio.play();
    else audio.pause();
  };
  playBtn.addEventListener('click', toggle);
  audio.addEventListener('play', () => {
    playBtn.textContent = '❚❚';
    playBtn.setAttribute('aria-label', 'Pause');
  });
  audio.addEventListener('pause', () => {
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Play');
  });
  audio.addEventListener('timeupdate', () => {
    if (seeking || !audio.duration) return;
    progress.value = String((audio.currentTime / audio.duration) * 100);
    time.textContent = fmtTime(audio.currentTime);
  });
  progress.addEventListener('input', () => {
    seeking = true;
  });
  progress.addEventListener('change', () => {
    if (audio.duration)
      audio.currentTime = (Number(progress.value) / 100) * audio.duration;
    seeking = false;
  });

  return () => {
    audio.pause();
    audio.src = '';
    root.innerHTML = '';
  };
}

function renderGated(
  root: HTMLElement,
  pal: ReturnType<typeof paletteFor>,
  config: EmbedConfig,
): void {
  root.innerHTML = '';
  const msg = el(
    'div',
    { flex: '1 1 auto', fontSize: '12px', color: pal.muted },
    'This patch is not public.',
  );
  const mark = el('a', {
    fontSize: '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: pal.muted,
    textDecoration: 'none',
  }) as HTMLAnchorElement;
  mark.textContent = 'AnnealMusic';
  mark.href = config.origin;
  mark.target = '_blank';
  mark.rel = 'noopener';
  root.append(msg, mark);
}

/** Parse the embed config from the current location (path slug + ?theme). */
export function configFromLocation(
  loc: Location,
  apiBase: string,
): EmbedConfig {
  const match = loc.pathname.match(/\/embed\/([^/?#]+)/);
  const slug = match ? decodeURIComponent(match[1] ?? '') : '';
  const theme = resolveTheme(new URLSearchParams(loc.search).get('theme'));
  return { slug, theme, apiBase, origin: loc.origin };
}
