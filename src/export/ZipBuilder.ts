/* eslint-disable @typescript-eslint/no-explicit-any */
const CRC_TABLE = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

/**
 * Computes standard CRC-32 checksum of a binary buffer.
 */
export function crc32(buf: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i] as number;
    crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ b) & 0xff] as number);
  }
  return (crc ^ -1) >>> 0;
}

export interface ZipFile {
  name: string;
  data: Uint8Array;
}

/**
 * Zero-dependency, uncompressed client-side ZIP builder.
 * Uses the standard "Store" compression method, yielding blazing-fast exports
 * by bypassing slow compression on heavy audio byte streams.
 */
export class ZipBuilder {
  private files: ZipFile[] = [];

  /**
   * Append a file to the ZIP accumulator.
   */
  addFile(name: string, data: ArrayBuffer | Uint8Array | string): void {
    let bytes: Uint8Array;
    if (typeof data === 'string') {
      bytes = new TextEncoder().encode(data);
    } else {
      bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    }
    // Normalize path separators to forward slash for ZIP standard compatibility
    const normalizedName = name.replace(/\\/g, '/');
    this.files.push({ name: normalizedName, data: bytes });
  }

  /**
   * Compiles the uncompressed ZIP archive into a single download-ready Blob.
   */
  build(): Blob {
    const parts: any[] = [];
    const localHeaderOffsets: number[] = [];
    let currentOffset = 0;

    // 1. Write Local File Headers + File Data
    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i]!;
      const nameBytes = new TextEncoder().encode(file.name);
      const crc = crc32(file.data);

      const header = new ArrayBuffer(30 + nameBytes.length);
      const view = new DataView(header);

      view.setUint32(0, 0x04034b50, true); // Signature
      view.setUint16(4, 20, true); // Version needed to extract (2.0)
      view.setUint16(6, 0, true); // General purpose bit flag
      view.setUint16(8, 0, true); // Compression method (0 = Store)
      view.setUint16(10, 0, true); // Last mod file time
      view.setUint16(12, 0, true); // Last mod file date
      view.setUint32(14, crc, true); // CRC-32
      view.setUint32(18, file.data.length, true); // Compressed size
      view.setUint32(22, file.data.length, true); // Uncompressed size
      view.setUint16(26, nameBytes.length, true); // File name length
      view.setUint16(28, 0, true); // Extra field length

      // Write file name bytes
      new Uint8Array(header, 30, nameBytes.length).set(nameBytes);

      localHeaderOffsets.push(currentOffset);

      const headerBytes = new Uint8Array(header);
      parts.push(headerBytes);
      parts.push(file.data);

      currentOffset += headerBytes.length + file.data.length;
    }

    const centralDirectoryStart = currentOffset;
    let centralDirectorySize = 0;

    // 2. Write Central Directory Headers
    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i]!;
      const nameBytes = new TextEncoder().encode(file.name);
      const crc = crc32(file.data);
      const offset = localHeaderOffsets[i]!;

      const header = new ArrayBuffer(46 + nameBytes.length);
      const view = new DataView(header);

      view.setUint32(0, 0x02014b50, true); // Signature
      view.setUint16(4, 20, true); // Version made by (2.0)
      view.setUint16(6, 20, true); // Version needed to extract (2.0)
      view.setUint16(8, 0, true); // General purpose bit flag
      view.setUint16(10, 0, true); // Compression method (Store)
      view.setUint16(12, 0, true); // Last mod file time
      view.setUint16(14, 0, true); // Last mod file date
      view.setUint32(16, crc, true); // CRC-32
      view.setUint32(20, file.data.length, true); // Compressed size
      view.setUint32(24, file.data.length, true); // Uncompressed size
      view.setUint16(28, nameBytes.length, true); // File name length
      view.setUint16(30, 0, true); // Extra field length
      view.setUint16(32, 0, true); // File comment length
      view.setUint16(34, 0, true); // Disk number start
      view.setUint16(36, 0, true); // Internal file attributes
      view.setUint32(38, 32, true); // External file attributes (32 = DOS Archive attribute)
      view.setUint32(42, offset, true); // Local header offset

      new Uint8Array(header, 46, nameBytes.length).set(nameBytes);

      const headerBytes = new Uint8Array(header);
      parts.push(headerBytes);

      centralDirectorySize += headerBytes.length;
      currentOffset += headerBytes.length;
    }

    // 3. Write End of Central Directory Record
    const eocd = new ArrayBuffer(22);
    const view = new DataView(eocd);

    view.setUint32(0, 0x06054b50, true); // Signature
    view.setUint16(4, 0, true); // Number of this disk
    view.setUint16(6, 0, true); // Disk where central directory starts
    view.setUint16(8, this.files.length, true); // Number of central directory records on this disk
    view.setUint16(10, this.files.length, true); // Total central directory records
    view.setUint32(12, centralDirectorySize, true); // Size of central directory
    view.setUint32(16, centralDirectoryStart, true); // Offset of central directory
    view.setUint16(20, 0, true); // Comment length

    parts.push(new Uint8Array(eocd));

    return new Blob(parts, { type: 'application/zip' });
  }
}
