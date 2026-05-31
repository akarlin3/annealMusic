import type { TransformDef } from '../types';
import { applyLinear } from './linear';
import { applyLog } from './log';
import { applyExp } from './exp';
import { applyDiscrete } from './discrete';
import { applyQuantile } from './quantile';

export { applyLinear, applyLog, applyExp, applyDiscrete, applyQuantile };

export function applyTransform(val: number, def: TransformDef): number {
  switch (def.type) {
    case 'linear':
      return applyLinear(val, def);
    case 'log':
      return applyLog(val, def);
    case 'exp':
      return applyExp(val, def);
    case 'discrete':
      return applyDiscrete(val, def);
    case 'quantile':
      return applyQuantile(val, def);
    default:
      return applyLinear(val, def);
  }
}
