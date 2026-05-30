import { getLatinSquareRow } from '../utils';

describe('Williams Latin Square Counterbalancing', () => {
  it('generates a balanced Latin square row of size N', () => {
    const N = 4;

    // Rows should be permutations of [0, 1, 2, 3]
    for (let subjectIndex = 0; subjectIndex < N; subjectIndex++) {
      const row = getLatinSquareRow(N, subjectIndex);
      expect(row.length).toBe(N);

      const uniqueElements = new Set(row);
      expect(uniqueElements.size).toBe(N);

      // All elements must be within [0, N-1]
      row.forEach((val) => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(N);
      });
    }
  });

  it('shifts rows deterministically by subjectIndex', () => {
    const N = 4;
    const row0 = getLatinSquareRow(N, 0);
    const row1 = getLatinSquareRow(N, 1);

    // Williams base is c = [0, 3, 1, 2].
    // row0 = shift 0 = [0, 3, 1, 2]
    // row1 = shift 1 = [1, 0, 2, 3]
    expect(row0).toEqual([0, 3, 1, 2]);
    expect(row1).toEqual([1, 0, 2, 3]);
  });
});
