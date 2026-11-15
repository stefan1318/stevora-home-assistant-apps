"""Poll local STEVORA sync inbox; all imported records remain pending review."""
import logging
import os
import threading
from pathlib import Path

_LOG = logging.getLogger("stevora.sync")
_INTERVAL = 60

def _loop():
    from import_chatgpt_batch import main
    inbox = Path(os.environ["STEVORA_SYNC_INBOX"])
    while True:
        try:
            if inbox.is_dir() and any(inbox.glob("*.json")):
                main()
        except Exception:
            _LOG.exception("STEVORA Sync Watcher failed; will retry")
        threading.Event().wait(_INTERVAL)

def start_watcher():
    os.environ.setdefault("STEVORA_SYNC_INBOX", "/share/stevora_sync/inbox")
    os.environ.setdefault("STEVORA_SYNC_ARCHIVE", "/share/stevora_sync/processed")
    os.environ.setdefault("STEVORA_MEMORY_DIR", "/config/stevora/memory")
    thread = threading.Thread(target=_loop, name="stevora-sync-watcher", daemon=True)
    thread.start()
    _LOG.warning("STEVORA Sync Watcher active (60s poll, pending-review only)")
