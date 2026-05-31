/* eslint-disable */
import React from 'react';
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  Shield,
  AlertTriangle,
} from 'lucide-react';

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

interface TemplateViewProps {
  template: MappingTemplate;
  onBack: () => void;
  onInstantiate: () => void;
}

export const TemplateView: React.FC<TemplateViewProps> = ({
  template,
  onBack,
  onInstantiate,
}) => {
  // Simple markdown renderer for recipe prose to ensure instant loading
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('# ')) {
        return (
          <h1
            key={idx}
            className="text-xl font-mono uppercase tracking-wide font-semibold text-stone-200 mt-6 mb-3"
          >
            {line.replace('# ', '')}
          </h1>
        );
      }
      if (line.startsWith('## ')) {
        const title = line.replace('## ', '');
        let color = 'text-stone-300';
        if (title.toLowerCase().includes('limitations')) {
          color = 'text-rose-400 flex items-center gap-1.5';
        }
        return (
          <h2
            key={idx}
            className={`text-sm font-mono uppercase tracking-widest font-semibold mt-6 mb-3 ${color}`}
          >
            {title.toLowerCase().includes('limitations') && (
              <AlertTriangle size={14} className="text-rose-400" />
            )}
            {title}
          </h2>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <li
            key={idx}
            className="text-xs text-stone-400 font-mono list-disc list-inside leading-relaxed pl-2 mb-1.5"
          >
            {line.replace('- ', '')}
          </li>
        );
      }
      if (
        line.startsWith('1. ') ||
        line.startsWith('2. ') ||
        line.startsWith('3. ') ||
        line.startsWith('4. ') ||
        line.startsWith('5. ')
      ) {
        return (
          <div
            key={idx}
            className="text-xs text-stone-400 font-mono leading-relaxed pl-2 mb-2 flex gap-2"
          >
            <span className="text-amber-500 font-semibold">
              {line.split('. ')[0]}.
            </span>
            <span>{line.split('. ').slice(1).join('. ')}</span>
          </div>
        );
      }
      if (line.trim() === '') return <div key={idx} className="h-2" />;
      return (
        <p
          key={idx}
          className="text-xs text-stone-400 font-mono leading-relaxed mb-3"
        >
          {line}
        </p>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-stone-900/10">
      {/* Left panel: recipe contents (scrollable) */}
      <div className="flex-1 p-6 overflow-y-auto border-r border-stone-800 scrollbar-thin">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-500 hover:text-stone-300 font-mono text-[10px] uppercase tracking-wider mb-5"
        >
          <ArrowLeft size={12} /> Back to Catalog
        </button>

        <article className="recipe-prose-container max-w-none">
          {renderMarkdown(template.recipe_content)}
        </article>
      </div>

      {/* Right panel: mapping constraints and citations (sticky) */}
      <aside className="w-full md:w-80 p-6 flex flex-col gap-6 bg-stone-950/20 select-none">
        {/* Playback Example */}
        {template.example_audio_path && (
          <div className="border border-stone-800 bg-stone-900/40 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-500 flex items-center gap-1.5">
              <Sparkles size={12} className="text-amber-500" />
              Example Audio Preview
            </span>
            <audio
              controls
              src={template.example_audio_path}
              className="w-full h-8 accent-amber-500"
            />
          </div>
        )}

        {/* Curation Citation */}
        <div className="border border-stone-800 bg-stone-900/40 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
          <span className="text-[10px] font-mono uppercase tracking-widest text-stone-500 flex items-center gap-1.5">
            <BookOpen size={12} className="text-amber-500" />
            Academic Origin
          </span>
          <p className="text-[10px] text-stone-400 font-mono leading-relaxed italic">
            "
            {template.citation ||
              'ICAD community standard sonification mapping.'}
            "
          </p>
        </div>

        {/* Expected Source Schema Schema */}
        <div className="border border-stone-800 bg-stone-900/40 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
          <span className="text-[10px] font-mono uppercase tracking-widest text-stone-500 flex items-center gap-1.5">
            <Shield size={12} className="text-amber-500" />
            Expected Source Columns
          </span>
          <div className="flex flex-wrap gap-1.5">
            {template.source_schema.columns.map((col) => (
              <span
                key={col}
                className="bg-stone-950 px-2 py-0.5 rounded border border-stone-850 text-[10px] font-mono text-stone-400"
              >
                {col}
              </span>
            ))}
          </div>
        </div>

        {/* Calibration Recommendations */}
        {template.calibration_recommendation && (
          <div className="border border-stone-800 bg-stone-900/40 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-500 flex items-center gap-1.5">
              <Shield size={12} className="text-amber-500" />
              Calibration recommendation
            </span>
            <p className="text-[10px] text-stone-400 font-mono leading-relaxed">
              {template.calibration_recommendation}
            </p>
          </div>
        )}

        {/* Action instantiation trigger */}
        <div className="mt-auto">
          <button
            onClick={onInstantiate}
            className="w-full py-2.5 rounded-lg text-xs font-mono uppercase bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold transition-all text-center shadow-lg shadow-amber-500/10"
          >
            Instantiate mapping
          </button>
        </div>
      </aside>
    </div>
  );
};
