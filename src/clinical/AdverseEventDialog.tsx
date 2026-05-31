import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface AdverseEventDialogProps {
  onClose: () => void;
  onSubmit: (text: string) => void;
}

export function AdverseEventDialog({
  onClose,
  onSubmit,
}: AdverseEventDialogProps) {
  const [description, setDescription] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('hearing strain');

  const tags = [
    'hearing strain',
    'tinnitus/ringing',
    'anxiety/distress',
    'headache',
    'dizziness',
    'other',
  ];

  const handleSubmit = () => {
    const finalDetail = description.trim()
      ? `[${selectedTag}] ${description.trim()}`
      : selectedTag;
    onSubmit(finalDetail);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-md font-mono text-xs text-stone-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm border border-stone-850 bg-stone-900 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-600 hover:text-stone-300 transition-all p-1"
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-2 border-b border-stone-800 pb-2.5">
          <AlertTriangle size={16} className="text-red-500 animate-pulse" />
          <span className="font-bold text-stone-100 uppercase tracking-wider">
            Report Adverse Event
          </span>
        </div>

        <p className="text-[10px] text-stone-500 leading-relaxed">
          Auditory stimulus has been automatically paused. Please categorize and
          describe any distress, ringing, or discomfort. Your report will be
          logged immediately with timing offsets.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 font-bold uppercase text-[9px] tracking-wider">
            Event Category:
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                  selectedTag === tag
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 font-bold'
                    : 'bg-stone-950/30 border-stone-800 text-stone-400 hover:bg-stone-950/50'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 font-bold uppercase text-[9px] tracking-wider">
            Describe Discomfort (optional):
          </label>
          <textarea
            placeholder="Provide additional details regarding symptom onset or severity..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-20 bg-stone-950 border border-stone-800 rounded-lg p-2.5 text-stone-200 outline-none placeholder:text-stone-700 resize-none focus:border-stone-700 transition-all"
            maxLength={1000}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-800 pt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-stone-800 rounded hover:bg-stone-950/40 text-stone-400 transition-all font-semibold"
          >
            Resume Stimulus
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-red-500 text-stone-950 rounded hover:bg-red-450 transition-all font-bold"
          >
            Submit Incident Report
          </button>
        </div>
      </div>
    </div>
  );
}
