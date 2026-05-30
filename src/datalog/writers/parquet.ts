/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * parquet.ts - Parquet format stub.
 * Columnar Parquet generation is handled inside the CLI batch renderer and conversion tools
 * to keep the browser bundle size light and avoid heavy WASM binary loading.
 */
import type { SessionLogRecord, DatalogMode } from '../schema';

export function isParquetSupported(): boolean {
  return false;
}

export async function writeParquet(
  _records: readonly SessionLogRecord[],
  _opts: { mode: DatalogMode; rateHz: number; startTime: string },
): Promise<ArrayBuffer> {
  throw new Error(
    'Parquet writing is not supported directly in the browser to keep bundle size optimized. ' +
      'Please download the log as JSONL and use the CLI utility: "annealmusic convert <file> -f parquet" to generate Parquet.',
  );
}
