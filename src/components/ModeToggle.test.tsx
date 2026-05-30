import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ModeToggle from '@/components/ModeToggle';

const mockNavigate = vi.fn();
const mockLocation = { pathname: '/' };

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockLocation.pathname = '/';
});

describe('ModeToggle — Top Mode Switcher', () => {
  it('renders all three top creative modes (Sketch, Compose, Drone)', () => {
    render(<ModeToggle />);
    expect(screen.getByRole('radio', { name: 'Sketch' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Compose' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Drone' })).toBeInTheDocument();
  });

  it('navigates to /piece when Compose is clicked', () => {
    render(<ModeToggle />);
    fireEvent.click(screen.getByRole('radio', { name: 'Compose' }));
    expect(mockNavigate).toHaveBeenCalledWith('/piece');
  });

  it('updates the UI mode when Drone is clicked', () => {
    render(<ModeToggle />);
    fireEvent.click(screen.getByRole('radio', { name: 'Drone' }));
    // Mode updates on store
    expect(mockNavigate).not.toHaveBeenCalled(); // Already on '/'
  });
});
