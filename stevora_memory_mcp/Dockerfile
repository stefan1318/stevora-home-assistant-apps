FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir "mcp>=1.10,<2.0"
COPY server.py /app/server.py
COPY sync_watcher.py /app/sync_watcher.py
COPY memory_status_updater.py /app/memory_status_updater.py
COPY github_sync.py /app/github_sync.py
COPY import_chatgpt_batch.py /app/import_chatgpt_batch.py
EXPOSE 8765
CMD ["python", "/app/server.py"]
