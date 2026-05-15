FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt

COPY viewer /app/viewer

RUN mkdir -p /data/dialogs

EXPOSE 8001

CMD ["python", "viewer/server.py", "--port", "8001", "--dialog-dir", "/data/dialogs", "--spec-dir", "/mnt/specgraph/specs/nodes", "--runs-dir", "/mnt/specgraph/runs", "--specgraph-dir", "/mnt/specgraph-root"]
