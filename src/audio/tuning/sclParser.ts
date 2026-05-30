/**
 * Strictly parses a Scala (.scl) file according to the official Scala tuning format spec.
 * Returns the description, scale size K, and the full scale ratios array (length K+1, prepended with 1.0 unison).
 */
export interface ParsedScl {
  description: string;
  size: number;
  scaleRatios: number[]; // prepended with 1.0 unison, length size + 1
}

export function parseScl(text: string): ParsedScl {
  const lines = text.split(/\r?\n/);
  const parsedPitches: number[] = [];
  let description = '';
  let scaleSize: number | null = null;

  for (const rawLine of lines) {
    // 1. Remove comments and trim whitespace
    let line = rawLine;
    const commentIdx = line.indexOf('!');
    if (commentIdx !== -1) {
      line = line.substring(0, commentIdx);
    }
    line = line.trim();

    // 2. Skip empty lines
    if (line === '') {
      continue;
    }

    // 3. First non-comment line is the description
    if (!description && scaleSize === null) {
      description = line;
      continue;
    }

    // 4. Second non-comment line is the scale size K
    if (scaleSize === null) {
      const parsedSize = parseInt(line, 10);
      if (isNaN(parsedSize) || parsedSize <= 0) {
        throw new Error(
          `Invalid Scala scale size: "${line}". Must be a positive integer.`,
        );
      }
      scaleSize = parsedSize;
      continue;
    }

    // 5. Subsequent lines are the pitch values (cents or ratios)
    if (parsedPitches.length >= scaleSize) {
      // Ignore extra lines beyond scale size, as some SCL files have trailing info
      break;
    }

    // Cents representation contains a decimal point
    if (line.includes('.')) {
      const cents = parseFloat(line);
      if (isNaN(cents) || cents < 0) {
        throw new Error(`Invalid cent value in SCL: "${line}"`);
      }
      const ratio = Math.pow(2, cents / 1200);
      parsedPitches.push(ratio);
    } else {
      // Ratio representation (e.g. "3/2" or "2")
      const slashIdx = line.indexOf('/');
      if (slashIdx !== -1) {
        const numPart = line.substring(0, slashIdx).trim();
        const denPart = line.substring(slashIdx + 1).trim();
        const num = parseInt(numPart, 10);
        const den = parseInt(denPart, 10);
        if (isNaN(num) || isNaN(den) || num <= 0 || den <= 0) {
          throw new Error(`Invalid fraction ratio in SCL: "${line}"`);
        }
        parsedPitches.push(num / den);
      } else {
        const val = parseInt(line, 10);
        if (isNaN(val) || val <= 0) {
          throw new Error(`Invalid integer ratio in SCL: "${line}"`);
        }
        parsedPitches.push(val);
      }
    }
  }

  if (scaleSize === null) {
    throw new Error('Incomplete Scala file: Missing scale size definition.');
  }

  if (parsedPitches.length < scaleSize) {
    throw new Error(
      `Incomplete Scala file: Expected ${scaleSize} notes, but parsed only ${parsedPitches.length}.`,
    );
  }

  // Prepend 1.0 (unison) to scale ratios to represent degree 0
  const scaleRatios = [1.0, ...parsedPitches];

  return {
    description,
    size: scaleSize,
    scaleRatios,
  };
}
