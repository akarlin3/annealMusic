import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { ArrangementView } from '@/piece/ArrangementView';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ slug: undefined }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/api/client', () => ({
  api: {
    isBackendConfigured: () => false,
    myPieces: vi.fn().mockResolvedValue({ items: [] }),
    getPiece: vi.fn(),
  },
}));

vi.mock('@/jam/crdt', () => {
  const mockMap = {
    size: 0,
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    observe: vi.fn(),
    unobserve: vi.fn(),
  };
  return {
    doc: {
      getMap: vi.fn().mockReturnValue(mockMap),
      transact: vi.fn((cb) => cb()),
    },
    sessionConfigMap: mockMap,
  };
});

vi.mock('@/api/anon', () => ({
  getAnonId: () => 'test-anon-id',
}));

afterEach(cleanup);

describe('ArrangementView', () => {
  const ensureOrchestrator = vi.fn().mockReturnValue({
    getLoopSlot: vi.fn(),
    getLoopState: vi.fn(),
    getInputVoice: vi.fn(),
  });
  const showToast = vi.fn();

  it('renders Arrangement View header, title and snap dropdown', () => {
    render(
      <ArrangementView
        ensureOrchestrator={ensureOrchestrator}
        showToast={showToast}
      />,
    );

    // Verify Title and Subtitle exist
    expect(
      screen.getByPlaceholderText('Composition Title...'),
    ).toBeInTheDocument();
    expect(screen.getByText(/v3.6 Arrangement DAW/)).toBeInTheDocument();

    // Verify primary action buttons
    expect(screen.getByText('Load Compositions')).toBeInTheDocument();
    expect(screen.getByText('Add Movement')).toBeInTheDocument();
  });

  it('renders Snap Mode selector with grid and segment snapping options', () => {
    render(
      <ArrangementView
        ensureOrchestrator={ensureOrchestrator}
        showToast={showToast}
      />,
    );

    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(1);

    // Verify grid options exist
    expect(screen.getByText('Snap Off')).toBeInTheDocument();
    expect(screen.getByText('Segments')).toBeInTheDocument();
    expect(screen.getByText('Snaps Bar')).toBeInTheDocument();
  });

  it('toggles piano roll monophonic monophonic editor when clicked', () => {
    render(
      <ArrangementView
        ensureOrchestrator={ensureOrchestrator}
        showToast={showToast}
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: /Piano Roll Editor/i,
    });
    expect(toggleButton).toBeInTheDocument();

    // Dialog should not be present initially
    expect(screen.queryByText(/Monophonic Piano Roll overlay/i)).toBeNull();

    // Click button to open Piano Roll
    fireEvent.click(toggleButton);
    expect(
      screen.getByText(/Monophonic Piano Roll overlay/i),
    ).toBeInTheDocument();

    // Close and verify
    const backButton = screen.getByRole('button', {
      name: /Back to Arranger View/i,
    });
    fireEvent.click(backButton);
    expect(screen.queryByText(/Monophonic Piano Roll overlay/i)).toBeNull();
  });
});
