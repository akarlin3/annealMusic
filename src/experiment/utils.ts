/**
 * Deterministic hash function to convert UUID/subjectId to integer
 */
export function hashSubjectId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

/**
 * Williams Latin Square row generator for N conditions
 */
export function getLatinSquareRow(N: number, subjectIndex: number): number[] {
  const row: number[] = [];
  const shift = subjectIndex % N;

  const baseSequence: number[] = [];
  for (let i = 0; i < N; i++) {
    if (i % 2 === 0) {
      baseSequence.push(i / 2);
    } else {
      baseSequence.push(N - (i + 1) / 2);
    }
  }

  for (let i = 0; i < N; i++) {
    row.push((baseSequence[i] + shift) % N);
  }

  return row;
}
