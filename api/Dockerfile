FROM python:3.12-slim

# ffmpeg: transcode uploaded WAV captures to Opus + repackage rendered previews.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
# Include the `render` extra (Playwright) — this image runs the preview renderer.
RUN pip install --no-cache-dir ".[render]"

# Headless Chromium for server-side preview rendering (v0.8, Option B). The
# render harness itself is served by the web build at RENDER_HARNESS_URL.
RUN playwright install --with-deps chromium

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

ENV TRANSCODE_ENABLED=true \
    STORAGE_BACKEND=s3 \
    RENDER_ENABLED=true \
    ENV=prod

EXPOSE 8000

# Railway runs `alembic upgrade head` as the release command (see DEPLOY.md);
# this is the serve command.
CMD ["gunicorn", "app.main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-b", "0.0.0.0:8000", "-w", "2"]
