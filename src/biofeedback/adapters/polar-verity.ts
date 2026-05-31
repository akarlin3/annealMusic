import { PolarH10Adapter } from './polar-h10';

export class PolarVerityAdapter extends PolarH10Adapter {
  override readonly id = 'polar-verity';
  override readonly name = 'Polar Verity Sense';
}
