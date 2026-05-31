/* eslint-disable */
import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  Search,
  X,
  Layers,
  Activity,
  GitBranch,
  Terminal,
} from 'lucide-react';
import { TemplateView } from './TemplateView';

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
}

interface TemplateBrowserProps {
  onClose: () => void;
  onInstantiate: (template: MappingTemplate) => void;
}

export const TemplateBrowser: React.FC<TemplateBrowserProps> = ({
  onClose,
  onInstantiate,
}) => {
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<MappingTemplate | null>(null);
  const [filterFamily, setFilterFamily] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/mapping-templates')
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        setTemplates(data.items || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const getFamilyIcon = (family: string) => {
    switch (family) {
      case 'time-series':
        return <Activity size={16} className="text-amber-500" />;
      case 'scalar-field':
        return <Layers size={16} className="text-emerald-500" />;
      case 'network':
        return <GitBranch size={16} className="text-sky-500" />;
      case 'structured-event':
        return <Terminal size={16} className="text-rose-500" />;
      default:
        return <BookOpen size={16} />;
    }
  };

  const getFamilyLabel = (family: string) => {
    switch (family) {
      case 'time-series':
        return 'Time Series';
      case 'scalar-field':
        return 'Scalar Fields';
      case 'network':
        return 'Networks & Graphs';
      case 'structured-event':
        return 'Structured Events';
      default:
        return family;
    }
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesFamily =
      filterFamily === 'all' || t.domain_family === filterFamily;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFamily && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="w-full max-w-5xl h-[85vh] bg-stone-900 border border-stone-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-md font-mono uppercase tracking-wider font-semibold text-stone-200">
                Canonical Sonification Templates
              </h2>
              <p className="text-xs text-stone-500 font-mono">
                Curated research mappings & recipes for ICAD investigators
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-850 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
          >
            <X size={16} />
          </button>
        </header>

        {/* Modal Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {selectedTemplate ? (
            <TemplateView
              template={selectedTemplate}
              onBack={() => setSelectedTemplate(null)}
              onInstantiate={() => onInstantiate(selectedTemplate)}
            />
          ) : (
            <>
              {/* Left sidebar filters */}
              <aside className="w-64 border-r border-stone-800/80 p-4 flex flex-col gap-4 bg-stone-950/20 select-none">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-500" />
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg py-1.5 pl-9 pr-4 text-xs text-stone-300 placeholder-stone-600 focus:outline-none focus:border-amber-500/30"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-stone-600 px-3 mb-1">
                    Domain Family
                  </span>
                  {[
                    { id: 'all', label: 'All Families' },
                    { id: 'time-series', label: 'Time Series' },
                    { id: 'scalar-field', label: 'Scalar Fields' },
                    { id: 'network', label: 'Networks & Graphs' },
                    { id: 'structured-event', label: 'Structured Events' },
                  ].map((family) => (
                    <button
                      key={family.id}
                      onClick={() => setFilterFamily(family.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono text-left transition-all ${
                        filterFamily === family.id
                          ? 'bg-amber-500/10 text-amber-400 font-semibold border-l-2 border-amber-500'
                          : 'text-stone-400 hover:bg-stone-850 hover:text-stone-200'
                      }`}
                    >
                      {getFamilyIcon(family.id)}
                      {family.label}
                    </button>
                  ))}
                </div>
              </aside>

              {/* Main template catalog grid */}
              <main className="flex-1 p-6 overflow-y-auto bg-stone-900/40">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="animate-spin h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full mb-3" />
                    <span className="text-xs font-mono text-stone-500">
                      Loading sonification catalog...
                    </span>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-stone-600 font-mono text-xs">
                    NO CANONICAL MAPPINGS MATCHED YOUR FILTERS.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
                    {filteredTemplates.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTemplate(t)}
                        className="group border border-stone-800/80 bg-stone-900/60 rounded-xl p-5 hover:border-amber-500/30 hover:bg-stone-900 transition-all cursor-pointer flex flex-col justify-between gap-4 shadow-md"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-1.5 bg-stone-950 px-2 py-0.5 rounded border border-stone-850 text-[9px] font-mono text-stone-400">
                              {getFamilyIcon(t.domain_family)}
                              {getFamilyLabel(t.domain_family)}
                            </span>
                          </div>
                          <h3 className="text-sm font-mono font-semibold text-stone-200 group-hover:text-amber-400 transition-colors uppercase tracking-wide">
                            {t.title}
                          </h3>
                          <p className="text-[11px] text-stone-500 font-mono leading-relaxed line-clamp-2">
                            {t.description}
                          </p>
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-mono text-stone-500 border-t border-stone-850 pt-3">
                          <span className="truncate max-w-[150px]">
                            {t.citation
                              ? t.citation.split('.')[0]
                              : 'ICAD canonical'}
                          </span>
                          <span className="text-amber-500 group-hover:underline flex items-center gap-1">
                            View Recipe &rarr;
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </main>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
