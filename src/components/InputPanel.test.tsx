import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import InputPanel from '@/components/InputPanel';
import type { InputApi } from '@/hooks/useInput';

afterEach(cleanup);

function makeInput(overrides: Partial<InputApi> = {}): InputApi {
  return {
    state: 'idle',
    devices: [],
    deviceId: undefined,
    deviceLabel: '',
    level: 1,
    monitoring: false,
    latencyMs: 0,
    errorMessage: '',
    connect: vi.fn(),
    disconnect: vi.fn(),
    selectDevice: vi.fn(),
    setLevel: vi.fn(),
    setMonitoring: vi.fn(),
    getAnalyser: () => null,
    ...overrides,
  };
}

describe('InputPanel — state transitions', () => {
  it('idle: shows the connect CTA and triggers connect', () => {
    const input = makeInput();
    render(<InputPanel input={input} />);
    const btn = screen.getByRole('button', { name: /connect input/i });
    fireEvent.click(btn);
    expect(input.connect).toHaveBeenCalledTimes(1);
  });

  it('prompting: disables the button with a waiting label', () => {
    render(<InputPanel input={makeInput({ state: 'prompting' })} />);
    const btn = screen.getByRole('button', {
      name: /allow microphone access/i,
    });
    expect(btn).toBeDisabled();
  });

  it('denied: shows fix instructions and a working retry', () => {
    const input = makeInput({ state: 'denied' });
    render(<InputPanel input={input} />);
    expect(screen.getByText(/access was blocked/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(input.connect).toHaveBeenCalledTimes(1);
  });

  it('error: surfaces the error message', () => {
    render(
      <InputPanel
        input={makeInput({ state: 'error', errorMessage: 'Device in use' })}
      />,
    );
    expect(screen.getByText(/device in use/i)).toBeInTheDocument();
  });
});

describe('InputPanel — connected controls', () => {
  const connected = (over: Partial<InputApi> = {}) =>
    makeInput({
      state: 'connected',
      deviceLabel: 'USB Interface',
      latencyMs: 16,
      devices: [
        { deviceId: 'a', label: 'Built-in Mic' },
        { deviceId: 'b', label: 'USB Interface' },
      ],
      deviceId: 'b',
      ...over,
    });

  it('renders the device picker and switches device', () => {
    const input = connected();
    render(<InputPanel input={input} />);
    const select = screen.getByLabelText('Input device');
    fireEvent.change(select, { target: { value: 'a' } });
    expect(input.selectDevice).toHaveBeenCalledWith('a');
  });

  it('shows placeholder labels for unlabeled devices', () => {
    render(
      <InputPanel
        input={connected({
          devices: [{ deviceId: 'x', label: '' }],
          deviceId: 'x',
        })}
      />,
    );
    expect(screen.getByRole('option', { name: 'Input 1' })).toBeInTheDocument();
  });

  it('toggles monitoring (off by default)', () => {
    const input = connected();
    render(<InputPanel input={input} />);
    const toggle = screen.getByRole('switch', { name: 'Monitoring' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(input.setMonitoring).toHaveBeenCalledWith(true);
  });

  it('adjusts input level', () => {
    const input = connected();
    render(<InputPanel input={input} />);
    fireEvent.change(screen.getByLabelText('Input Level'), {
      target: { value: '1.0' },
    });
    expect(input.setLevel).toHaveBeenCalledWith(2.0);
  });

  it('surfaces the latency estimate readout', () => {
    render(<InputPanel input={connected()} />);
    expect(screen.getByText(/16 MS INPUT LATENCY/i)).toBeInTheDocument();
  });

  it('disconnects', () => {
    const input = connected();
    render(<InputPanel input={input} />);
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    expect(input.disconnect).toHaveBeenCalledTimes(1);
  });
});
