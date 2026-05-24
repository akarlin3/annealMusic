FROM python:3.12-slim

# ffmpeg is required to transcode uploaded WAV captures to Opus.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir .

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

ENV TRANSCODE_ENABLED=true \
    STORAGE_BACKEND=s3 \
    ENV=prod

EXPOSE 8000

# Railway runs `alembic upgrade head` as the release command (see DEPLOY.md);
# this is the serve command.
CMD ["gunicorn", "app.main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-b", "0.0.0.0:8000", "-w", "2"]
