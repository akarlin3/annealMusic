import React, { useState } from 'react';
import type { DemographicsDefinition, SubjectDemographics } from '../types';
import { User } from 'lucide-react';

interface DemographicScreenProps {
  definition: DemographicsDefinition;
  onSubmit: (data: SubjectDemographics) => void;
}

export const DemographicScreen: React.FC<DemographicScreenProps> = ({
  definition,
  onSubmit,
}) => {
  const fields = definition.fields || [
    'age',
    'hearing_loss',
    'musical_experience',
  ];
  const [formData, setFormData] = useState<SubjectDemographics>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, val: string) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (fields.includes('age')) {
      const ageVal = Number(formData.age);
      if (!formData.age || isNaN(ageVal) || ageVal < 1 || ageVal > 120) {
        newErrors.age = 'Please enter a valid age between 1 and 120.';
      }
    }

    if (fields.includes('musical_experience')) {
      const expVal = Number(formData.musical_experience);
      if (
        formData.musical_experience === undefined ||
        isNaN(expVal) ||
        expVal < 0 ||
        expVal > 100
      ) {
        newErrors.musical_experience =
          'Please enter musical experience in years (0 or more).';
      }
    }

    if (fields.includes('hearing_loss') && !formData.hearing_loss) {
      newErrors.hearing_loss =
        'Please select a self-reported hearing status option.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
    } else {
      onSubmit(formData);
    }
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className="w-full max-w-md mx-auto p-6 md:p-8 border border-stone-900 bg-stone-900/10 rounded-2xl shadow-xl flex flex-col gap-6 select-none animate-fadeIn"
    >
      <div className="flex items-center gap-3 border-b border-stone-900 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
          <User size={20} strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-base font-mono uppercase tracking-wider font-semibold text-stone-200">
            Intake Survey
          </h1>
          <p className="text-[10px] text-stone-500 font-mono uppercase tracking-widest mt-0.5">
            Subject Demographics
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {fields.includes('age') && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-mono tracking-widest text-stone-400">
              Age (Years)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              placeholder="e.g. 25"
              value={formData.age || ''}
              onChange={(e) => handleInputChange('age', e.target.value)}
              className="w-full py-2.5 px-4 rounded-xl border border-stone-850 bg-stone-900 text-stone-200 font-mono text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            />
            {errors.age && (
              <span className="text-[10px] font-mono text-rose-400 mt-1 uppercase tracking-wide">
                {errors.age}
              </span>
            )}
          </div>
        )}

        {fields.includes('musical_experience') && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-mono tracking-widest text-stone-400">
              Years of Formal Music Training
            </label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 5"
              value={
                formData.musical_experience !== undefined
                  ? (formData.musical_experience as string | number)
                  : ''
              }
              onChange={(e) =>
                handleInputChange('musical_experience', e.target.value)
              }
              className="w-full py-2.5 px-4 rounded-xl border border-stone-850 bg-stone-900 text-stone-200 font-mono text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            />
            {errors.musical_experience && (
              <span className="text-[10px] font-mono text-rose-400 mt-1 uppercase tracking-wide">
                {errors.musical_experience}
              </span>
            )}
          </div>
        )}

        {fields.includes('hearing_loss') && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-mono tracking-widest text-stone-400">
              Self-Reported Hearing Status
            </label>
            <select
              value={formData.hearing_loss || ''}
              onChange={(e) =>
                handleInputChange('hearing_loss', e.target.value)
              }
              className="w-full py-2.5 px-4 rounded-xl border border-stone-850 bg-stone-900 text-stone-300 font-mono text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 cursor-pointer appearance-none"
            >
              <option value="" disabled>
                Select status...
              </option>
              <option value="none">None (normal hearing)</option>
              <option value="mild">Mild (sometimes struggle)</option>
              <option value="severe">
                Moderate to Severe (known impairment)
              </option>
            </select>
            {errors.hearing_loss && (
              <span className="text-[10px] font-mono text-rose-400 mt-1 uppercase tracking-wide">
                {errors.hearing_loss}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        type="submit"
        className="w-full py-3 rounded-xl text-xs font-mono uppercase tracking-wider bg-amber-500 text-stone-950 font-semibold hover:bg-amber-400 shadow-md shadow-amber-500/5 transition-all mt-4"
      >
        Submit and Continue
      </button>
    </form>
  );
};
