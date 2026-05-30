/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SessionLogRecord, DatalogMode } from '../schema';
import { DATALOG_SCHEMA_VERSION } from '../schema';

export interface CSVWriteOptions {
  appVersion?: string;
  bridgeVersion?: string;
  mode: DatalogMode;
  rateHz: number;
  startTime: string;
  endTime?: string;
}

/**
 * Escapes a cell value for CSV standards (RFC 4180).
 */
function escapeCSVCell(val: any): string {
  if (val === null || val === undefined) {
    return '';
  }
  let str = '';
  if (typeof val === 'object') {
    str = JSON.stringify(val);
  } else {
    str = String(val);
  }

  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function writeCSV(
  records: readonly SessionLogRecord[],
  opts: CSVWriteOptions,
): string {
  const lines: string[] = [];

  // 1. Preamble Comments (Metadata Header)
  lines.push(`# AnnealMusic Session Datalog — CSV Export`);
  lines.push(`# App Version: ${opts.appVersion ?? '5.3.0'}`);
  lines.push(`# Log Schema Version: ${DATALOG_SCHEMA_VERSION}`);
  lines.push(`# Logging Mode: ${opts.mode}`);
  lines.push(`# Sample Rate: ${opts.rateHz} Hz`);
  lines.push(`# Start Time: ${opts.startTime}`);
  lines.push(`# End Time: ${opts.endTime ?? new Date().toISOString()}`);
  lines.push(`# Total Records: ${records.length}`);

  // 2. Define flat headers (identical to pandas.json_normalize default dot-notation)
  const headers = [
    'timestamp',
    'wallTime',
    'event',
    'params.rootFreq',
    'params.spread',
    'params.density',
    'params.coupling',
    'params.drift',
    'params.brightness',
    'params.space',
    'params.volume',
    'metadata.mode',
    'metadata.engineId',
    'metadata.engineParams',
    'metadata.tuning.system',
    'metadata.tuning.referenceA4Hz',
    'metadata.schemaVersion',
    'metadata.logSchemaVersion',
    'drift.meanDetune',
    'drift.orderParameter',
    'drift.partials',
    'partials.frequencies',
    'partials.amplitudes',
    'features.rms',
    'features.spectralCentroid',
    'features.spectralFlux',
    'features.zcr',
    'features.spectrum',
    'eventData',
  ];

  lines.push(headers.join(','));

  // 3. Map records to CSV rows
  for (const r of records) {
    const row = [
      escapeCSVCell(r.timestamp),
      escapeCSVCell(r.wallTime),
      escapeCSVCell(r.event),
      escapeCSVCell(r.params.rootFreq),
      escapeCSVCell(r.params.spread),
      escapeCSVCell(r.params.density),
      escapeCSVCell(r.params.coupling),
      escapeCSVCell(r.params.drift),
      escapeCSVCell(r.params.brightness),
      escapeCSVCell(r.params.space),
      escapeCSVCell(r.params.volume),
      escapeCSVCell(r.metadata.mode),
      escapeCSVCell(r.metadata.engineId),
      escapeCSVCell(r.metadata.engineParams),
      escapeCSVCell(r.metadata.tuning.system),
      escapeCSVCell(r.metadata.tuning.referenceA4Hz),
      escapeCSVCell(r.metadata.schemaVersion),
      escapeCSVCell(r.metadata.logSchemaVersion),
      escapeCSVCell(r.drift.meanDetune),
      escapeCSVCell(r.drift.orderParameter),
      escapeCSVCell(r.drift.partials),
      escapeCSVCell(r.partials.frequencies),
      escapeCSVCell(r.partials.amplitudes),
      escapeCSVCell(r.features.rms),
      escapeCSVCell(r.features.spectralCentroid),
      escapeCSVCell(r.features.spectralFlux),
      escapeCSVCell(r.features.zcr),
      escapeCSVCell(r.features.spectrum),
      escapeCSVCell(r.eventData),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n') + '\n';
}
export default writeCSV;
