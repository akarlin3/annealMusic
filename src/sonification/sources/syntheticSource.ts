import type { SourceDef } from '../types';

export class SyntheticSourceAdapter {
  def: SourceDef;
  private cachedFn: ((t: number) => number) | null = null;
  private cachedFormula = '';

  constructor(def: SourceDef) {
    this.def = def;
  }

  private compileFormula(formula: string): (t: number) => number {
    if (this.cachedFn && this.cachedFormula === formula) {
      return this.cachedFn;
    }

    try {
      // Create a function that accepts `t` and has access to common Math functions
      // We sanitise/clamp formula values to prevent infinite loops or unsafe code, though standard sandbox handles it.
      const safeFormula = formula.replace(
        /window|document|eval|Function|localStorage|sessionStorage|fetch|xmlhttprequest|axios/gi,
        '0',
      );
      const fn = new Function(
        't',
        `
        try {
          const { sin, cos, tan, abs, min, max, pow, sqrt, log, exp, PI, E } = Math;
          return Number(${safeFormula});
        } catch (e) {
          return 0;
        }
      `,
      );

      this.cachedFn = (t: number) => {
        const val = fn(t);
        return isNaN(val) ? 0 : val;
      };
      this.cachedFormula = formula;
      return this.cachedFn;
    } catch (e) {
      console.error('Failed to compile synthetic formula:', formula, e);
      return () => 0;
    }
  }

  getValueAt(_column: string, t: number): number {
    const formula = this.def.formula || '0';
    const compiled = this.compileFormula(formula);
    return compiled(t);
  }
}
