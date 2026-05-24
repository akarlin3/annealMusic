import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReportDialog from '@/gallery/ReportDialog';
import { galleryApi } from '@/gallery/api';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ReportDialog', () => {
  it('submits the selected reason and detail', async () => {
    const report = vi
      .spyOn(galleryApi, 'report')
      .mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onDone = vi.fn();

    render(
      <ReportDialog patchId="patch-1" onClose={onClose} onDone={onDone} />,
    );

    fireEvent.click(screen.getByLabelText('Inappropriate'));
    fireEvent.change(screen.getByPlaceholderText('Details (optional)'), {
      target: { value: 'bad' },
    });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() =>
      expect(report).toHaveBeenCalledWith('patch-1', 'inappropriate', 'bad'),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
