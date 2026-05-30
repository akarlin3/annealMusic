import { useCallback, useEffect, useState } from 'react';
import {
  archiveClip,
  listClips,
  searchClips,
  uploadClip,
  type ClipMeta,
  type ClipOut,
  type ClipSearchResult,
} from './adminApi';

const LICENSES: ClipMeta['license'][] = [
  'original-by-you',
  'CC0',
  'CC-BY',
  'licensed-third-party',
];

// Admin audio-clip library: list, upload (with required license), search.
export function ClipManager() {
  const [clips, setClips] = useState<ClipOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Upload form state.
  const [file, setFile] = useState<File | null>(null);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [affinity, setAffinity] = useState('');
  const [license, setLicense] =
    useState<ClipMeta['license']>('original-by-you');
  const [attribution, setAttribution] = useState('');

  // Search state.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClipSearchResult[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setClips(await listClips());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clips');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onUpload() {
    if (!file) {
      setError('Choose an audio file to upload.');
      return;
    }
    setBusy(true);
    try {
      const meta: ClipMeta = {
        slug,
        title,
        description,
        track_affinity: affinity
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        concept_tags: tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        license,
        attribution: attribution.trim() || null,
      };
      await uploadClip(meta, file);
      setSlug('');
      setTitle('');
      setDescription('');
      setTags('');
      setAffinity('');
      setAttribution('');
      setFile(null);
      setError(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onArchive(id: string) {
    try {
      await archiveClip(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed');
    }
  }

  async function onSearch() {
    try {
      setResults(await searchClips({ q: query, limit: 5 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  }

  return (
    <section className="admin-section clip-manager">
      <h3 className="admin-h3">Audio clip library ({clips.length})</h3>
      {error && <p className="admin-error">{error}</p>}

      <div className="clip-upload-form">
        <h4 className="admin-h4">Upload a clip</h4>
        <input
          className="admin-input"
          placeholder="slug (lowercase-hyphenated)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <input
          className="admin-input"
          placeholder="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="admin-input"
          placeholder="one-line description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="admin-input"
          placeholder="concept tags (comma-separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <input
          className="admin-input"
          placeholder="track affinity (comma-separated slugs)"
          value={affinity}
          onChange={(e) => setAffinity(e.target.value)}
        />
        <select
          className="admin-input"
          value={license}
          onChange={(e) => setLicense(e.target.value as ClipMeta['license'])}
        >
          {LICENSES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        {license !== 'original-by-you' && (
          <input
            className="admin-input"
            placeholder="attribution (required for this license)"
            value={attribution}
            onChange={(e) => setAttribution(e.target.value)}
          />
        )}
        <input
          className="admin-input"
          type="file"
          accept="audio/*,.wav,.opus,.ogg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          className="learn-primary-btn"
          onClick={() => void onUpload()}
          disabled={busy}
        >
          {busy ? 'Uploading…' : 'Upload clip'}
        </button>
      </div>

      <div className="clip-search">
        <h4 className="admin-h4">Test retrieval</h4>
        <div className="admin-row">
          <input
            className="admin-input"
            placeholder='e.g. "physical modeling string"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onSearch();
            }}
          />
          <button
            className="learn-secondary-btn admin-btn-sm"
            onClick={() => void onSearch()}
          >
            Search
          </button>
        </div>
        {results && (
          <ol className="clip-results">
            {results.map((r) => (
              <li key={r.slug}>
                <strong>{r.title}</strong>{' '}
                <span className="clip-score">({r.score.toFixed(3)})</span> —{' '}
                {r.slug}
              </li>
            ))}
          </ol>
        )}
      </div>

      <ul className="clip-list">
        {clips.map((c) => (
          <li key={c.id} className="clip-row">
            <div>
              <strong>{c.title}</strong>{' '}
              <span className="audio-clip-license-badge">{c.license}</span>
              <div className="clip-meta">
                {c.slug} · {Math.round(c.duration_ms / 1000)}s ·{' '}
                {c.concept_tags.join(', ')}
              </div>
            </div>
            <div className="clip-row-actions">
              {c.audio_url && (
                <audio src={c.audio_url} controls preload="none" />
              )}
              <button
                className="learn-secondary-btn admin-btn-sm"
                onClick={() => void onArchive(c.id)}
              >
                Archive
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
