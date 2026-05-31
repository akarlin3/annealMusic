/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Save } from 'lucide-react';
import { Input } from '@/design/components/Input';
import { Select } from '@/design/components/Select';

interface MappingTemplate {
  id: string;
  slug: string;
  title: string;
  description: string;
  domain_family:
    | 'time-series'
    | 'scalar-field'
    | 'network'
    | 'structured-event';
  source_schema: { columns: string[] };
  mapping_spec: any;
  calibration_recommendation?: string;
  citation?: string;
  recipe_content: string;
  example_data_path?: string;
  example_audio_path?: string;
  position: number;
}

export const MappingTemplateEditor: React.FC = () => {
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [selected, setSelected] = useState<MappingTemplate | null>(null);

  // Form fields
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [domainFamily, setDomainFamily] = useState<
    'time-series' | 'scalar-field' | 'network' | 'structured-event'
  >('time-series');
  const [columnsInput, setColumnsInput] = useState('value');
  const [specInput, setSpecInput] = useState(
    '{\n  "sources": [],\n  "rules": []\n}',
  );
  const [calibrationRec, setCalibrationRec] = useState('');
  const [citation, setCitation] = useState('');
  const [recipeContent, setRecipeContent] = useState('');
  const [position, setPosition] = useState(0);

  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const adminKey = localStorage.getItem('am_admin_key') || 'secret'; // fallback for local dev

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = () => {
    fetch('/api/v1/mapping-templates')
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setTemplates(data.items || []))
      .catch(() => {});
  };

  const handleSelect = (t: MappingTemplate) => {
    setSelected(t);
    setSlug(t.slug);
    setTitle(t.title);
    setDescription(t.description);
    setDomainFamily(t.domain_family);
    setColumnsInput(t.source_schema.columns.join(', '));
    setSpecInput(JSON.stringify(t.mapping_spec, null, 2));
    setCalibrationRec(t.calibration_recommendation || '');
    setCitation(t.citation || '');
    setRecipeContent(t.recipe_content);
    setPosition(t.position);
  };

  const handleNew = () => {
    setSelected(null);
    setSlug('');
    setTitle('');
    setDescription('');
    setDomainFamily('time-series');
    setColumnsInput('value');
    setSpecInput('{\n  "sources": [],\n  "rules": []\n}');
    setCalibrationRec('');
    setCitation('');
    setRecipeContent('');
    setPosition(0);
  };

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleSave = () => {
    setLoading(true);
    let parsedSpec = {};
    try {
      parsedSpec = JSON.parse(specInput);
    } catch {
      triggerToast('Error: Mapping Spec must be valid JSON');
      setLoading(false);
      return;
    }

    const payload = {
      slug,
      title,
      description,
      domain_family: domainFamily,
      source_schema: { columns: columnsInput.split(',').map((c) => c.trim()) },
      mapping_spec: parsedSpec,
      calibration_recommendation: calibrationRec || null,
      citation: citation || null,
      recipe_content: recipeContent,
      position,
    };

    const isEdit = !!selected;
    const url = isEdit
      ? `/api/v1/admin/mapping-templates/${selected.id}`
      : '/api/v1/admin/mapping-templates';

    fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Save failed');
        return res.json();
      })
      .then(() => {
        triggerToast('Saved mapping template successfully!');
        fetchTemplates();
        handleNew();
        setLoading(false);
      })
      .catch(() => {
        triggerToast('Error saving template. Check admin key headers.');
        setLoading(false);
      });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?'))
      return;

    fetch(`/api/v1/admin/mapping-templates/${id}`, {
      method: 'DELETE',
      headers: {
        'x-admin-key': adminKey,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Delete failed');
        triggerToast('Deleted mapping template successfully.');
        fetchTemplates();
        handleNew();
      })
      .catch(() => {
        triggerToast('Delete failed.');
      });
  };

  return (
    <div className="flex flex-col gap-6 text-stone-200">
      {toastMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs font-mono text-emerald-400">
          {toastMsg}
        </div>
      )}

      <div className="flex justify-between items-center select-none">
        <div>
          <h2 className="text-lg font-mono uppercase tracking-wider font-semibold text-stone-200">
            Mapping Template Manager
          </h2>
          <p className="text-xs text-stone-500 font-mono">
            Platform editor for canonical mappings & academic recipes
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-850 text-xs font-mono text-stone-400 hover:text-stone-200 transition-colors"
        >
          <Plus size={14} /> New Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        {/* Left Side: Template catalog list */}
        <aside className="border border-stone-800 bg-stone-900/10 rounded-xl p-4 flex flex-col gap-2 overflow-y-auto max-h-[70vh] select-none">
          <span className="text-[10px] uppercase font-mono tracking-widest text-stone-600 mb-1 px-1">
            Active Catalog
          </span>
          {templates.length === 0 ? (
            <span className="text-xs text-stone-600 font-mono text-center py-6">
              No templates available.
            </span>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                onClick={() => handleSelect(t)}
                className={`group p-3 rounded-lg border text-xs font-mono flex justify-between items-center transition-all cursor-pointer ${
                  selected?.id === t.id
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-stone-900 border-stone-900 hover:bg-stone-850 text-stone-400 hover:text-stone-200'
                }`}
              >
                <span className="truncate max-w-[160px]">{t.title}</span>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(t.id);
                    }}
                    className="p-1 text-stone-500 hover:text-rose-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </aside>

        {/* Right Side: Form workspace */}
        <main className="border border-stone-800 bg-stone-900/10 rounded-xl p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Slug ID"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="single-scalar-drift"
            />

            <Input
              label="Title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Single Scalar Drift"
            />
          </div>

          <Input
            label="Short Description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Soothe or inform researchers about this mapping template"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Domain Family"
              value={domainFamily}
              onChange={(e) => setDomainFamily(e.target.value as any)}
            >
              <option value="time-series">Time Series</option>
              <option value="scalar-field">Scalar Field</option>
              <option value="network">Network & Graph</option>
              <option value="structured-event">Structured Event</option>
            </Select>

            <Input
              label="Source Schema Columns"
              type="text"
              value={columnsInput}
              onChange={(e) => setColumnsInput(e.target.value)}
              placeholder="value, threshold"
            />
          </div>

          <Input
            label="Calibration recommendations"
            type="text"
            value={calibrationRec}
            onChange={(e) => setCalibrationRec(e.target.value)}
            placeholder="Outlier percentiles recommendation"
          />

          <Input
            label="Academic Citation"
            type="text"
            value={citation}
            onChange={(e) => setCitation(e.target.value)}
            placeholder="Primary Author, Year, Book/Journal"
          />

          <Input
            label="Default Mapping Spec (JSON)"
            multiline
            rows={6}
            value={specInput}
            onChange={(e) => setSpecInput(e.target.value)}
          />

          <Input
            label="Recipe Markdown Content"
            multiline
            rows={8}
            value={recipeContent}
            onChange={(e) => setRecipeContent(e.target.value)}
          />

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-xs font-mono uppercase bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold transition-all text-center flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/5 select-none"
          >
            <Save size={14} /> Save Template
          </button>
        </main>
      </div>
    </div>
  );
};
