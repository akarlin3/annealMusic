# Publishing & Scientific Communication

AnnealMusic v7.6 enables researchers to easily publish their sonifications and listening sessions as rich, interactive scientific figures, high-fidelity video abstracts, and shareable social cards.

---

## 1. Automated Rendering Pipelines

AnnealMusic provides backend (headless) and interactive (client-side) rendering pipelines to accommodate any research output.

### Headless Server-Side Exports

You can trigger headless, high-resolution rendering using the `/api/v1/renders` REST API. The backend orchestrates an off-screen Playwright viewport to perform the exact Web Audio DSP performance and transcodes it to standard H.264/AAC MP4.

#### Video Abstracts

- **Endpoint**: `POST /api/v1/renders/video`
- **JSON Body**:
  ```json
  {
    "source_kind": "sonification",
    "source_id": "c1f73752-d178-4395-849c-d07f35bde2ef",
    "resolution": "1920x1080",
    "duration_ms": 30000
  }
  ```
- **Transcoding Options**: Resolves to standard 1080p, 4K UHD, or 720p square.

#### Still Figures

- **Endpoint**: `POST /api/v1/renders/image`
- **JSON Body**:
  ```json
  {
    "source_kind": "sonification",
    "source_id": "c1f73752-d178-4395-849c-d07f35bde2ef",
    "resolution": "1920x1080"
  }
  ```

---

## 2. Embedding Interactive Figures

For online journals, blog posts, and digital abstracts, you can embed the high-performance, compact (`< 30 KB` gzipped) figure player using a standard `<iframe>`.

### Code Example

```html
<iframe
  src="https://annealmusic.app/embed-figure/c1f73752-d178-4395-849c-d07f35bde2ef?theme=light&bg=ffffff&fg=1c1917&accent=8b5cf6"
  width="100%"
  height="120"
  frameborder="0"
  allow="autoplay; clipboard-write"
  title="Scientific Sonification Figure"
></iframe>
```

### URL Customization Parameters

Customize colors to fit the specific stylesheet of your publisher:

- `theme`: `dark` | `light` (default is `dark`)
- `bg`: Background color in hex format (e.g. `ffffff`)
- `fg`: Text and icon color in hex format (e.g. `1c1917`)
- `accent`: Play button and waveform color in hex format (e.g. `8b5cf6`)

---

## 3. Academic Citations

Every exported artifact includes an associated BibTeX citation sidecar file.

### BibTeX Format

```bibtex
@misc{annealmusic_sonification_2026,
  title        = {Dawn Field Sonification},
  author       = {K., Investigator},
  year         = {2026},
  publisher    = {AnnealMusic},
  howpublished = {\url{https://annealmusic.app/p/abc123}},
  doi          = {10.5281/zenodo.123456}
}
```

If a study has a minted Zenodo DOI (see the v7.5 Research Export suite), the BibTeX reference automatically resolves the registered DOI.
