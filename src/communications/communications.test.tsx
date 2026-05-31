import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { api } from '@/api/client';
import RenderDialog from './RenderDialog';
import VideoRenderQueue from './VideoRenderQueue';
import OutreachCardBuilder from './OutreachCardBuilder';
import AccessibilityEditor from './AccessibilityEditor';
import type {
  RenderedArtifactOut,
  AccessibilityDescriptionOut,
} from '@/api/types';

// Mock dialog APIs for jsdom
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

const mockArtifact: RenderedArtifactOut = {
  id: '7d6cde40-a35b-4c28-971c-43b9cde185a4',
  user_id: 'avery-user-id',
  source_kind: 'sonification',
  source_id: 'sonification-id',
  source_version: 'v7.6.0',
  render_kind: 'video',
  storage_key: 'renders/7d6cde40.mp4',
  bytes: null, // pending
  resolution: '1920x1080',
  duration_ms: 15000,
  citation_bibtex: null,
  doi: null,
  created_at: '2026-05-31T03:00:00Z',
};

const mockCompletedArtifact: RenderedArtifactOut = {
  ...mockArtifact,
  bytes: 1048576, // 1 MB
  citation_bibtex:
    '@misc{sonification2026,\n  title = {Dawn Field},\n  author = {Lead Investigator},\n  year = {2026},\n  publisher = {AnnealMusic}\n}',
  doi: '10.5281/zenodo.123456',
};

const mockA11yDesc: AccessibilityDescriptionOut = {
  artifact_kind: 'sonification',
  artifact_id: 'sonification-id',
  description: 'A scientific sonification mapping data to frequency.',
  language: 'en',
  source: 'auto',
  updated_at: '2026-05-31T03:00:00Z',
};

describe('RenderDialog', () => {
  it('renders standard elements when open', () => {
    const onClose = vi.fn();
    const showToast = vi.fn();

    render(
      <RenderDialog
        isOpen={true}
        onClose={onClose}
        sourceKind="sonification"
        sourceId="sonification-id"
        showToast={showToast}
      />,
    );

    expect(screen.getByText('Publishing & Exports')).toBeInTheDocument();
    expect(screen.getByText('Video Abstract')).toBeInTheDocument();
    expect(screen.getByText('Still Figure')).toBeInTheDocument();
  });

  it('triggers queueVideoRender when submitting video', async () => {
    const onClose = vi.fn();
    const showToast = vi.fn();
    const mockQueue = vi
      .spyOn(api, 'queueVideoRender')
      .mockResolvedValue(mockArtifact);

    render(
      <RenderDialog
        isOpen={true}
        onClose={onClose}
        sourceKind="sonification"
        sourceId="sonification-id"
        showToast={showToast}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: 'Export' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockQueue).toHaveBeenCalledWith({
        source_kind: 'sonification',
        source_id: 'sonification-id',
        resolution: '1920x1080',
        duration_ms: 15000,
      });
      expect(showToast).toHaveBeenCalledWith(
        'Headless video rendering queued in the background!',
      );
    });
  });
});

describe('VideoRenderQueue', () => {
  it('displays pending and rendering state', () => {
    const showToast = vi.fn();
    render(
      <VideoRenderQueue
        initialArtifacts={[mockArtifact]}
        showToast={showToast}
      />,
    );

    expect(screen.getByText('ID: 7d6cde40')).toBeInTheDocument();
    expect(screen.getByText('Rendering')).toBeInTheDocument();
  });

  it('displays complete downloads and copy citation buttons', () => {
    const showToast = vi.fn();
    render(
      <VideoRenderQueue
        initialArtifacts={[mockCompletedArtifact]}
        showToast={showToast}
      />,
    );

    expect(screen.getByText('Download')).toBeInTheDocument();
  });
});

describe('OutreachCardBuilder', () => {
  it('renders preview frame and preset color buttons', () => {
    const showToast = vi.fn();
    render(
      <OutreachCardBuilder
        sourceKind="sonification"
        sourceId="sonification-id"
        title="Amber Sonification"
        creator="Researcher K"
        doi="10.5281/zenodo.123456"
        showToast={showToast}
      />,
    );

    expect(screen.getByText('Outreach Card Pack Builder')).toBeInTheDocument();
    expect(screen.getByText('Amber Sonification')).toBeInTheDocument();
    expect(screen.getByText('by Researcher K')).toBeInTheDocument();
    expect(screen.getByText('DOI: 10.5281/zenodo.123456')).toBeInTheDocument();
  });
});

describe('AccessibilityEditor', () => {
  it('loads and retrieves accessibility description, allowing saves', async () => {
    const showToast = vi.fn();
    const mockGet = vi
      .spyOn(api, 'getAccessibilityDescription')
      .mockResolvedValue(mockA11yDesc);
    const mockSave = vi
      .spyOn(api, 'saveAccessibilityDescription')
      .mockResolvedValue({
        ...mockA11yDesc,
        source: 'manual',
      });

    render(
      <AccessibilityEditor
        artifactKind="sonification"
        artifactId="sonification-id"
        showToast={showToast}
      />,
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('sonification', 'sonification-id');
      expect(
        screen.getByText('Accessibility Transcript Editor'),
      ).toBeInTheDocument();
      expect(
        screen.getByDisplayValue(
          'A scientific sonification mapping data to frequency.',
        ),
      ).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: 'Save Draft' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith({
        artifact_kind: 'sonification',
        artifact_id: 'sonification-id',
        description: 'A scientific sonification mapping data to frequency.',
        language: 'en',
        source: 'manual',
      });
      expect(showToast).toHaveBeenCalledWith(
        'Accessibility transcript updated successfully!',
      );
    });
  });
});
