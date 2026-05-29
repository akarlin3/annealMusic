import { describe, expect, it } from 'vitest';
import { ZipBuilder, crc32 } from './ZipBuilder';

describe('ZipBuilder', () => {
  it('computes CRC-32 checksums correctly', () => {
    const data = new TextEncoder().encode('Hello World');
    const checksum = crc32(data);
    // Standard CRC-32 of 'Hello World' is 0x4a17b156
    expect(checksum).toBe(0x4a17b156);
  });

  it('compiles a valid uncompressed ZIP archive', async () => {
    const zip = new ZipBuilder();
    zip.addFile('test.txt', 'Hello, AnnealMusic');
    zip.addFile('sub/data.bin', new Uint8Array([1, 2, 3, 4]));

    const blob = zip.build();
    expect(blob).toBeDefined();
    expect(blob.type).toBe('application/zip');
    expect(blob.size).toBeGreaterThan(0);

    // Read the compiled ZIP bytes using FileReader for Node compatibility
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsArrayBuffer(blob);
    });
    const view = new DataView(arrayBuffer);

    // Assert first local file header signature 'PK\x03\x04' (0x04034b50)
    expect(view.getUint32(0, true)).toBe(0x04034b50);

    // Assert compression method is 0 (Store)
    expect(view.getUint16(8, true)).toBe(0);

    // Assert correct uncompressed size (length of 'Hello, AnnealMusic' is 18)
    expect(view.getUint32(22, true)).toBe(18);

    // Assert filename 'test.txt'
    const nameLength = view.getUint16(26, true);
    expect(nameLength).toBe(8);
    const nameBytes = new Uint8Array(arrayBuffer, 30, 8);
    const name = new TextDecoder().decode(nameBytes);
    expect(name).toBe('test.txt');
  });
});
