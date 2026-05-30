/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SessionLogRecord, DatalogMode } from '../schema';
import { DATALOG_SCHEMA_VERSION } from '../schema';

export interface JSONLWriteOptions {
  appVersion?: string;
  bridgeVersion?: string;
  mode: DatalogMode;
  rateHz: number;
  startTime: string;
  endTime?: string;
}

export function writeJSONL(
  records: readonly SessionLogRecord[],
  opts: JSONLWriteOptions,
): string {
  const lines: string[] = [];

  // 1. Preamble Header
  const header = {
    type: 'header',
    appVersion: opts.appVersion ?? '5.3.0',
    bridgeVersion: opts.bridgeVersion ?? '1.0',
    logSchemaVersion: DATALOG_SCHEMA_VERSION,
    mode: opts.mode,
    rateHz: opts.rateHz,
    startTime: opts.startTime,
    columns: [
      'timestamp',
      'wallTime',
      'params',
      'metadata',
      'drift',
      'partials',
      'features',
      'event',
      'eventData',
    ],
  };
  lines.push(JSON.stringify(header));

  // 2. Ticks (records)
  for (const record of records) {
    lines.push(JSON.stringify(record));
  }

  // 3. Footer
  const footer = {
    type: 'footer',
    endTime: opts.endTime ?? new Date().toISOString(),
    totalRecords: records.length,
    errors: [],
  };
  lines.push(JSON.stringify(footer));

  return lines.join('\n') + '\n';
}

export function parseJSONL(jsonl: string): {
  header: any;
  records: SessionLogRecord[];
  footer: any;
} {
  const lines = jsonl.split('\n').filter((l) => l.trim().length > 0);
  let header: any = null;
  let footer: any = null;
  const records: SessionLogRecord[] = [];

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'header') {
        header = obj;
      } else if (obj.type === 'footer') {
        footer = obj;
      } else {
        records.push(obj as SessionLogRecord);
      }
    } catch (err) {
      console.warn('[jsonl] Failed to parse line:', line, err);
    }
  }

  return { header, records, footer };
}
