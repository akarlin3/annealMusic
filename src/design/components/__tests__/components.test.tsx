import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';
import { Slider } from '../Slider';
import { Panel } from '../Panel';
import { Card } from '../Card';

describe('Canonical Component Library', () => {
  describe('Button', () => {
    it('renders with standard primary variant styles', () => {
      render(<Button>Click Me</Button>);
      const btn = screen.getByRole('button', { name: /click me/i });
      expect(btn).toBeInTheDocument();
      expect(btn.className).toContain('bg-[var(--color-accent)]');
    });

    it('triggers onClick handler when clicked', () => {
      const clickMock = vi.fn();
      render(<Button onClick={clickMock}>Click Me</Button>);
      const btn = screen.getByRole('button', { name: /click me/i });
      fireEvent.click(btn);
      expect(clickMock).toHaveBeenCalledTimes(1);
    });

    it('honors the disabled prop correctly', () => {
      render(<Button disabled>Disabled Button</Button>);
      const btn = screen.getByRole('button', { name: /disabled button/i });
      expect(btn).toBeDisabled();
    });
  });

  describe('Slider', () => {
    it('renders label and tabular value readout when provided', () => {
      render(
        <Slider
          label="Volume"
          valueDisplay="85%"
          min="0"
          max="100"
          defaultValue="85"
        />,
      );
      expect(screen.getByText('Volume')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('responds correctly to value adjustments', () => {
      const changeMock = vi.fn();
      render(
        <Slider
          aria-label="Seeker"
          min="0"
          max="100"
          defaultValue="10"
          onChange={changeMock}
        />,
      );
      const input = screen.getByRole('slider', {
        name: /seeker/i,
      }) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '50' } });
      expect(changeMock).toHaveBeenCalled();
      expect(input.value).toBe('50');
    });
  });

  describe('Panel', () => {
    it('renders its children contents inside popover mode', () => {
      render(
        <Panel variant="popover" isOpen={true}>
          <div>Popover panel contents</div>
        </Panel>,
      );
      expect(screen.getByText('Popover panel contents')).toBeInTheDocument();
    });

    it('does not render anything if isOpen is false', () => {
      const { container } = render(
        <Panel isOpen={false}>
          <div>Hidden contents</div>
        </Panel>,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Card', () => {
    it('renders with border and surface tokens', () => {
      render(<Card>Simple Card</Card>);
      expect(screen.getByText('Simple Card')).toBeInTheDocument();
    });

    it('includes active scaling class when interactive is set to true', () => {
      render(<Card interactive>Interactive Card</Card>);
      const card = screen.getByText('Interactive Card');
      expect(card.className).toContain('cursor-pointer');
      expect(card.className).toContain('active:scale-[0.98]');
    });
  });
});
