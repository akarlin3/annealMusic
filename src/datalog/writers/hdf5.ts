/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * hdf5.ts - HDF5 format stub.
 * HDF5 generation is handled inside the CLI batch renderer and conversion tools
 * to keep the browser bundle size light and avoid heavy WASM binary loading.
 */
import type { SessionLogRecord, DatalogMode } from '../schema';

export function isHDF5Supported(): boolean {
  return false;
}

export async function writeHDF5(
  _records: readonly SessionLogRecord[],
  _opts: { mode: DatalogMode; rateHz: number; startTime: string },
): Promise<ArrayBuffer> {
  throw new Error(
    'HDF5 writing is not supported directly in the browser to keep bundle size optimized. ' +
      'Please download the log as JSONL and use the CLI utility: "annealmusic convert <file> -f hdf5" to generate HDF5.',
  );
}
