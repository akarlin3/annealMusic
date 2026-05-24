import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminPage from '@/admin/AdminPage';
import { adminApi } from '@/admin/api';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

beforeEach(() => sessionStorage.clear());

describe('AdminPage', () => {
  it('gates on a key, then lists open reports', async () => {
    const list = vi.spyOn(adminApi, 'listReports').mockResolvedValue([
      {
        id: 'r1',
        patch_id: 'p1',
        patch_title: 'Naughty patch',
        patch_slug: 'abc12345',
        patch_visibility: 'public',
        preview_status: 'ready',
        reason: 'spam',
        detail: 'junk',
        reporter: 'anonymous',
        status: 'open',
        created_at: new Date().toISOString(),
      },
    ]);

    render(<AdminPage />);
    // Key form first.
    expect(screen.getByLabelText('Admin key')).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Admin key'), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByText('Enter'));

    await waitFor(() => expect(list).toHaveBeenCalledWith('secret'));
    expect(await screen.findByText('Naughty patch')).toBeInTheDocument();
  });
});
