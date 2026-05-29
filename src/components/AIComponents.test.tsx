import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QuotaIndicator from '@/components/QuotaIndicator';
import GeneratePatchDialog from '@/components/GeneratePatchDialog';
import ModifyPatchDialog from '@/components/ModifyPatchDialog';
import SimilarPatchesRow from '@/components/SimilarPatchesRow';
import { api } from '@/api/client';
import type { AIQuota } from '@/api/types';

// Mock dialog showModal/close in HTMLDialogElement for jsdom
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockQuota: AIQuota = {
  hour_limit: 20,
  hour_used: 5,
  day_limit: 100,
  day_used: 12,
};

describe('QuotaIndicator', () => {
  it('fetches and displays the quota successfully', async () => {
    vi.spyOn(api, 'aiQuota').mockResolvedValue(mockQuota);

    render(<QuotaIndicator />);

    await vi.waitFor(() => {
      expect(screen.getByText('AI Quota:')).toBeInTheDocument();
      expect(screen.getByText('5/20 hr')).toBeInTheDocument();
    });
  });
});

describe('GeneratePatchDialog', () => {
  it('renders elements and details of the dialog when open', async () => {
    vi.spyOn(api, 'aiQuota').mockResolvedValue(mockQuota);
    const onClose = vi.fn();
    const showToast = vi.fn();

    render(
      <GeneratePatchDialog
        isOpen={true}
        onClose={onClose}
        showToast={showToast}
      />,
    );

    expect(screen.getByText('Generate AI Patch')).toBeInTheDocument();
    expect(screen.getByText('Describe the sound you want')).toBeInTheDocument();

    await vi.waitFor(() => {
      expect(screen.getByText('5/20 hr · 12/100 day')).toBeInTheDocument();
    });
  });
});

describe('ModifyPatchDialog', () => {
  it('renders correctly and has AI Mood Modifier header', () => {
    const onClose = vi.fn();
    const showToast = vi.fn();

    render(
      <ModifyPatchDialog
        isOpen={true}
        onClose={onClose}
        showToast={showToast}
      />,
    );

    expect(screen.getByText('AI Mood Modifier')).toBeInTheDocument();
    expect(screen.getByText('Direction or Mood')).toBeInTheDocument();
  });
});

describe('SimilarPatchesRow', () => {
  it('shows similar patches carousel successfully', async () => {
    vi.spyOn(api, 'similarPatches').mockResolvedValue({
      items: [
        {
          id: 'patch-1',
          short_slug: 'similar1',
          title: 'Forest mist',
          description: 'damp pine and fog',
          state: 'm=open&e=sine&rootFreq=220',
          engine: 'sine',
          mode: 'open',
          has_captures: false,
          load_count: 5,
          published_at: null,
          preview_status: 'none',
          preview_duration_ms: null,
        },
      ],
      next_cursor: null,
    });
    const showToast = vi.fn();

    render(
      <MemoryRouter>
        <SimilarPatchesRow patchId="source-patch-id" showToast={showToast} />
      </MemoryRouter>,
    );

    await vi.waitFor(() => {
      expect(screen.getByText('Similar Vibes')).toBeInTheDocument();
      expect(screen.getByText('Forest mist')).toBeInTheDocument();
    });
  });
});
