import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ResearchApp } from '../ResearchApp';
import { ModeProvider } from '@/mode/ModeContext';
import { ModeAesthetic } from '@/design/ModeAesthetic';

// Mock Canvas 2D Context for jsdom
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  fillText: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
});

afterEach(cleanup);

describe('ResearchApp', () => {
  it('renders successfully without throwing runtime boot errors', () => {
    render(
      <ModeProvider>
        <ModeAesthetic>
          <ResearchApp />
        </ModeAesthetic>
      </ModeProvider>,
    );

    // Check if the Research Interface header title is displayed correctly
    expect(screen.getByText(/Research Interface console/i)).toBeInTheDocument();

    // Check if the Live RPC Stream is initialized correctly
    expect(screen.getByText(/Live RPC Stream/i)).toBeInTheDocument();
  });
});
