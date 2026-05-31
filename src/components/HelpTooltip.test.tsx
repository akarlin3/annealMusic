import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { HelpTooltip } from './HelpTooltip';

afterEach(() => {
  cleanup();
});

describe('HelpTooltip Component', () => {
  it('renders a help button and slides in the explanation panel when clicked', () => {
    render(
      <HelpTooltip
        title="Phase Coupling Factor"
        description="Controls the synchronization strength between independent frequency loops."
        tips="Increase to lock phase loops together for clean harmonic intervals; decrease for organic drifts."
      />,
    );

    // Get the interactive trigger button
    const trigger = screen.getByRole('button', {
      name: /help for Phase Coupling Factor/i,
    });
    expect(trigger).toBeInTheDocument();

    // Verify explanation panel is not in the document initially
    expect(screen.queryByText('Phase Coupling Factor')).toBeNull();

    // Trigger open
    fireEvent.click(trigger);

    // Verify slide-in panel is visible
    expect(screen.getByText('Phase Coupling Factor')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Controls the synchronization strength between independent frequency loops.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Increase to lock phase loops together for clean harmonic intervals; decrease for organic drifts.',
      ),
    ).toBeInTheDocument();

    // Trigger close
    const closeBtn = screen.getByRole('button', {
      name: /close help sidebar/i,
    });
    fireEvent.click(closeBtn);

    // Verify slide-in panel is removed
    expect(screen.queryByText('Phase Coupling Factor')).toBeNull();
  });
});
