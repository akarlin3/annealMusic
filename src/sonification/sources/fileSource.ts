import type { SourceDef } from '../types';

/**
 * Parses raw CSV text into an array of objects.
 */
export function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  if (!firstLine) return [];

  const headers = parseCSVLine(firstLine);
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header) {
        const val = values[j] !== undefined ? (values[j] ?? '') : '';
        // Try to parse as number
        const num = Number(val);
        row[header] = isNaN(num) || val.trim() === '' ? val : num;
      }
    }
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char ?? '';
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Find the timestamp column name in a parsed row.
 */
export function findTimeColumn(row: Record<string, unknown>): string | null {
  const keys = Object.keys(row);
  const candidates = [
    'timestamp',
    'time',
    't',
    'sec',
    'seconds',
    'ms',
    'index',
  ];
  for (const c of candidates) {
    const found = keys.find((k) => k.toLowerCase() === c);
    if (found) return found;
  }
  return null;
}

/**
 * Interpolate values from file-based time-series data.
 */
export class FileSourceAdapter {
  def: SourceDef;
  data: Record<string, unknown>[] = [];
  timeColumn: string | null = null;
  timeScale = 1.0; // multiplier to convert timestamps to seconds if needed (e.g. ms -> sec)

  constructor(def: SourceDef) {
    this.def = def;
    this.data = def.data || [];
    if (this.data.length > 0) {
      const firstRow = this.data[0];
      const lastRow = this.data[this.data.length - 1];
      if (firstRow && lastRow) {
        this.timeColumn = findTimeColumn(firstRow);
        if (this.timeColumn) {
          // Detect if timestamp is in milliseconds (e.g., if max timestamp > 100000 and has values > 1000)
          const sampleVal = Number(firstRow[this.timeColumn]);
          const maxVal = Number(lastRow[this.timeColumn]);
          if (!isNaN(maxVal) && maxVal > 10000 && sampleVal > 1000) {
            this.timeScale = 0.001; // Treat as ms
          }
        }
      }
    }
  }

  /**
   * Load raw CSV or JSON text content.
   */
  loadContent(text: string, isJson: boolean) {
    if (isJson) {
      try {
        const parsed = JSON.parse(text);
        this.data = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        console.error('Failed to parse JSON source data', e);
        this.data = [];
      }
    } else {
      this.data = parseCSV(text);
    }

    if (this.data.length > 0) {
      const firstRow = this.data[0];
      if (firstRow) {
        this.timeColumn = findTimeColumn(firstRow);
        this.def.columns = Object.keys(firstRow);
        this.def.data = this.data;
      }
    }
  }

  /**
   * Get the value of a column at elapsed playback time t (seconds).
   */
  getValueAt(column: string, t: number): number {
    if (this.data.length === 0) return 0;

    // If no explicit time column exists, map the index uniformly across an assumed duration
    if (!this.timeColumn) {
      const idxFloat = (t / 10) * (this.data.length - 1); // assume 10s default duration if none
      const idx = Math.max(0, Math.min(this.data.length - 1, idxFloat));
      const idxFloor = Math.floor(idx);
      const idxCeil = Math.ceil(idx);
      const ratio = idx - idxFloor;

      const r1 = this.data[idxFloor];
      const r2 = this.data[idxCeil];
      const v1 = r1 ? Number(r1[column]) || 0 : 0;
      const v2 = r2 ? Number(r2[column]) || 0 : 0;
      return v1 + ratio * (v2 - v1);
    }

    // Get time values
    const getRowTime = (row: Record<string, unknown>): number => {
      const raw = Number(row[this.timeColumn!]);
      return (isNaN(raw) ? 0 : raw) * this.timeScale;
    };

    // Edge cases
    const rFirst = this.data[0];
    const rLast = this.data[this.data.length - 1];
    if (!rFirst || !rLast) return 0;

    const firstTime = getRowTime(rFirst);
    if (t <= firstTime) return Number(rFirst[column]) || 0;

    const lastTime = getRowTime(rLast);
    if (t >= lastTime) return Number(rLast[column]) || 0;

    // Binary search for surrounding rows
    let low = 0;
    let high = this.data.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const rMid = this.data[mid];
      if (!rMid) break;
      const midTime = getRowTime(rMid);
      if (midTime === t) {
        return Number(rMid[column]) || 0;
      } else if (midTime < t) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Interp between index high and low
    const idx1 = Math.max(0, Math.min(this.data.length - 1, high));
    const idx2 = Math.max(0, Math.min(this.data.length - 1, low));
    if (idx1 === idx2) {
      const r = this.data[idx1];
      return r ? Number(r[column]) || 0 : 0;
    }

    const row1 = this.data[idx1];
    const row2 = this.data[idx2];
    if (!row1 || !row2) return 0;

    const t1 = getRowTime(row1);
    const t2 = getRowTime(row2);
    const v1 = Number(row1[column]) || 0;
    const v2 = Number(row2[column]) || 0;

    const ratio = (t - t1) / (t2 - t1 || 1);
    return v1 + ratio * (v2 - v1);
  }
}
