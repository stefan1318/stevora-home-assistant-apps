"""Periodically ingest private GitHub notes and process the local STEVORA inbox."""
import logging
import os
import threading
from pathlib import Path

_LOG = logging.getLogger("stevora.sync")
_INTERVAL = 60


def _loop():
    from github_sync import poll_github
    from import_chatgpt_batch import main

    inbox = Path(os.environ["STEVORA_SYNC_INBOX"])
    stop = threading.Event()
    while True:
        try:
            poll_github()
        except Exception:
            _LOG.exception("Unexpected private GitHub sync error")
        try:
            if inbox.is_dir() and any(inbox.glob("*.json")):
                main()
        except Exception:
            _LOG.exception("Local STEVORA Sync Watcher failed; will retry")
        stop.wait(_INTERVAL)


def start_watcher():
    os.environ.setdefault("STEVORA_SYNC_INBOX", "/share/stevora_sync/inbox")
    os.environ.setdefault("STEVORA_SYNC_ARCHIVE", "/share/stevora_sync/processed")
    os.environ.setdefault("STEVORA_MEMORY_DIR", "/config/stevora/memory")
    thread = threading.Thread(target=_loop, name="stevora-sync-watcher", daemon=True)
    thread.start()
    _LOG.warning("STEVORA Sync Watcher active (60s, private GitHub read-only poll enabled)")
