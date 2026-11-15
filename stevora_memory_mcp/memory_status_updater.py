"""Maintain an observed STEVORA status snapshot; never alter approved memory."""
import json
import logging
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

_LOG = logging.getLogger("stevora.memory_status")
MEMORY = Path(os.environ.get("STEVORA_MEMORY_DIR", "/config/stevora/memory"))
SYNC_STATUS = Path("/share/stevora_sync/github_sync_status.json")
STATUS = MEMORY / "memory_status.json"


def _json_dict(path):
    if not path.is_file() or path.is_symlink() or path.stat().st_size > 256_000:
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def refresh_memory_status():
    """Refresh observable health and proposal counts; preserve other fields."""
    try:
        MEMORY.mkdir(parents=True, exist_ok=True)
        if MEMORY.is_symlink() or STATUS.is_symlink():
            raise ValueError("Unsafe memory status path")
        previous = _json_dict(STATUS)
        sync = _json_dict(SYNC_STATUS)
        counts = {"pending_review": 0, "approved": 0, "rejected": 0}
        proposals = MEMORY / "proposals"
        if proposals.is_dir() and not proposals.is_symlink():
            for path in proposals.glob("*.json"):
                try:
                    if path.is_symlink() or path.stat().st_size > 16_000:
                        continue
                    state = _json_dict(path).get("status")
                    if state in counts:
                        counts[state] += 1
                except (OSError, ValueError):
                    continue

        status = dict(previous)
        status.update({
            "schema_version": previous.get("schema_version", 1),
            "project": previous.get("project", "STEVORA Home"),
            "chatgpt_sync": "github_pull_on_demand",
            "ha_memory_bridge": "installed",
            "github_sync_status": sync.get("status", "unknown"),
            "github_sync_operational": sync.get("status") == "ok",
            "github_last_check_utc": sync.get("last_check_utc"),
            "github_last_downloaded_count": sync.get("downloaded", 0),
            "memory_manager": {
                "installed": True,
                "version": "1.4.1",
                "proposals": counts,
            },
        })
        # A successful poll is not necessarily a new import; do not falsify last_sync.
        if status.get("last_sync") == sync.get("last_check_utc"):
            status["last_sync"] = None

        # Avoid rewriting the SD card every 60 seconds if nothing changed.
        comparable_old = dict(previous)
        comparable_old.pop("status_updated_at", None)
        if comparable_old == status:
            return

        status["status_updated_at"] = datetime.now(timezone.utc).isoformat()
        fd, tmp = tempfile.mkstemp(prefix=".memory-status-", dir=str(MEMORY))
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(status, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp, STATUS)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)
    except Exception:
        _LOG.exception("Could not refresh STEVORA memory status")
