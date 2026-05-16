FROM python:3.11-slim

ARG SPECSPACE_RELEASE_COMMIT=
ARG SPECSPACE_RELEASE_CREATED_AT=
ARG SPECSPACE_VERSION=0.0.1

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SPECSPACE_RELEASE_COMMIT=$SPECSPACE_RELEASE_COMMIT \
    SPECSPACE_RELEASE_CREATED_AT=$SPECSPACE_RELEASE_CREATED_AT \
    SPECSPACE_VERSION=$SPECSPACE_VERSION

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt

COPY viewer /app/viewer
COPY deploy/specspace-demo /app/deploy/specspace-demo

RUN mkdir -p /data/dialogs

EXPOSE 8001

CMD ["python", "viewer/server.py", "--host", "0.0.0.0", "--port", "8001", "--dialog-dir", "/data/dialogs", "--spec-dir", "/mnt/specgraph/specs/nodes", "--runs-dir", "/mnt/specgraph/runs"]
