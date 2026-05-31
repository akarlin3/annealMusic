import { ZipBuilder } from '@/export/ZipBuilder';
import type {
  ExperimentDefinition,
  TrialResult,
  SubjectDemographics,
} from './types';
import { SCHEMA_VERSION } from '@/share/schema';

/**
 * Compiles the participant's demographics, trial responses, and trial-by-trial
 * audio features into a single uncompressed ZIP archive.
 */
export function exportExperimentData(
  definition: ExperimentDefinition,
  results: TrialResult[],
  demographics: SubjectDemographics,
  subjectId: string,
): Blob {
  const zip = new ZipBuilder();

  // 1. Compile manifest.json
  const manifest = {
    experiment_title: definition.title,
    experiment_description: definition.description,
    subject_id: subjectId,
    timestamp: new Date().toISOString(),
    anneal_music_version: '5.6.0',
    schema_version: 'v' + SCHEMA_VERSION,
    demographics,
    definition,
  };
  zip.addFile('manifest.json', JSON.stringify(manifest, null, 2));

  // 2. Compile responses.csv
  let csv =
    'subject_id,trial_index,stimulus_id,response_type,response_value,rt_ms,timestamp\n';
  for (const r of results) {
    let valEscaped = '';
    if (r.response_value !== null && r.response_value !== undefined) {
      if (typeof r.response_value === 'string') {
        valEscaped = `"${r.response_value.replace(/"/g, '""')}"`;
      } else if (typeof r.response_value === 'object') {
        valEscaped = `"${JSON.stringify(r.response_value).replace(/"/g, '""')}"`;
      } else {
        valEscaped = String(r.response_value);
      }
    }
    csv += `${r.subject_id},${r.trial_index},${r.stimulus_id},${r.response_type},${valEscaped},${r.rt_ms !== null ? r.rt_ms : ''},${r.timestamp}\n`;
  }
  zip.addFile('responses.csv', csv);

  // 3. Compile datalogger.jsonl (engine features during each trial duration)
  let jsonl = '';
  for (const r of results) {
    const ticks = r.datalogger_ticks || [];
    for (const tick of ticks) {
      const record = {
        trial_index: r.trial_index,
        stimulus_id: r.stimulus_id,
        ...tick,
      };
      jsonl += JSON.stringify(record) + '\n';
    }
  }
  zip.addFile('datalogger.jsonl', jsonl);

  return zip.build();
}
