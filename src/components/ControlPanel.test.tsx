import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ControlPanel from '@/components/ControlPanel';
import { CONTROL_DEFS, DEFAULT_PARAMS } from '@/state/params';

afterEach(cleanup);

const baseProps = {
  params: DEFAULT_PARAMS,
  setParam: () => {},
  engineId: 'sine' as const,
  engineParams: {},
  setEngineParam: () => {},
  showToast: () => {},
};

describe('ControlPanel — arc lock', () => {
  it('locks every sculpt control (but not volume) during an arc', () => {
    render(<ControlPanel {...baseProps} isPlaying arcLocked />);

    const sliders = screen.getAllByRole('slider') as HTMLInputElement[];
    const disabled = sliders.filter((s) => s.disabled);
    // All sculpt controls locked; volume stays interactive.
    expect(disabled).toHaveLength(CONTROL_DEFS.length);
    expect(sliders).toHaveLength(CONTROL_DEFS.length + 1);
    expect(screen.getAllByText('arc')).toHaveLength(CONTROL_DEFS.length);
  });

  it('leaves controls interactive in open mode (idle)', () => {
    render(<ControlPanel {...baseProps} isPlaying={false} arcLocked={false} />);
    const sliders = screen.getAllByRole('slider') as HTMLInputElement[];
    expect(sliders.filter((s) => s.disabled)).toHaveLength(0);
  });
});
