"""Poll the private STEVORA GitHub outbox using a read-only fine-grained token.

No inbound Home Assistant connectivity. Never send memory or secrets back to GitHub.
Every downloaded record is passed to the existing pending-review importer.
"""
import base64
import binascii
import json
import logging
import os
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

_LOG = logging.getLogger("stevora.github_sync")
REPOSITORY = "stefan1318/stevora-memory-sync"
BRANCH = "main"
API = "https://api.github.com"
TOKEN_FILE = Path("/share/stevora_sync/secrets/github_token")
ROOT = Path("/share/stevora_sync")
INBOX = ROOT / "inbox"
STATE_FILE = ROOT / "github_sync_state.json"
STATUS_FILE = ROOT / "github_sync_status.json"
MAX_BYTES = 256_000
MAX_LIST_BYTES = 2_000_000
MAX_FILES_PER_POLL = 50
FILENAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,110}\.json\Z")


def _timestamp():
    return datetime.now(timezone.utc).isoformat()


def _atomic_write(path, content, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.parent.is_symlink() or path.is_symlink():
        raise ValueError("Unsafe local file path")
    fd, name = tempfile.mkstemp(prefix=".stevora-", suffix=".tmp", dir=str(path.parent))
    try:
        os.chmod(name, mode)
        with os.fdopen(fd, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def _load_state():
    if not STATE_FILE.exists():
        return {}
    if STATE_FILE.is_symlink() or STATE_FILE.stat().st_size > 200_000:
        raise ValueError("Unsafe sync state")
    state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    if not isinstance(state, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in state.items()):
        raise ValueError("Invalid sync state")
    return state


def _save_status(status, downloaded=0, message=""):
    try:
        payload = {
            "status": status,
            "last_check_utc": _timestamp(),
            "downloaded": downloaded,
            "message": message[:200],
            "repository": REPOSITORY,
        }
        _atomic_write(STATUS_FILE, (json.dumps(payload, indent=2) + "\n").encode())
    except Exception:
        _LOG.exception("Unable to save GitHub sync status")


def _get_json(url, token, limit):
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "STEVORA-Memory-Sync/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        body = response.read(limit + 1)
    if len(body) > limit:
        raise ValueError("GitHub response exceeds limit")
    return json.loads(body)


def _validate_batch(raw):
    if len(raw) > MAX_BYTES:
        raise ValueError("Batch exceeds limit")
    batch = json.loads(raw.decode("utf-8"))
    if not isinstance(batch, dict) or not isinstance(batch.get("entries"), list):
        raise ValueError("Invalid batch format")
    if not 1 <= len(batch["entries"]) <= 100:
        raise ValueError("Invalid batch size")
    for entry in batch["entries"]:
        if not isinstance(entry, dict) or entry.get("category") not in {"idea", "decision", "implementation"}:
            raise ValueError("Invalid category")
        for key, low, high in (("title", 3, 160), ("details", 5, 4000), ("source", 1, 120)):
            value = entry.get(key)
            if not isinstance(value, str) or not low <= len(value.strip()) <= high:
                raise ValueError("Invalid entry: " + key)


def poll_github():
    """Download new, immutable private outbox files into the local inbox."""
    if not TOKEN_FILE.is_file() or TOKEN_FILE.is_symlink():
        _save_status("awaiting_token", message="Create /share/stevora_sync/secrets/github_token")
        return

    token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    if not token or len(token) > 512:
        _save_status("invalid_token_file")
        return

    try:
        INBOX.mkdir(parents=True, exist_ok=True)
        if INBOX.is_symlink():
            raise ValueError("Unsafe inbox directory")
        state = _load_state()
        list_url = f"{API}/repos/{REPOSITORY}/contents/outbox?ref={BRANCH}"
        listing = _get_json(list_url, token, MAX_LIST_BYTES)
        if not isinstance(listing, list):
            raise ValueError("GitHub outbox is not a directory")
        downloaded = 0
        for item in sorted(listing, key=lambda x: x.get("name", "")):
            name = item.get("name", "")
            sha = item.get("sha", "")
            if item.get("type") != "file" or not FILENAME.fullmatch(name):
                continue
            if not isinstance(sha, str) or len(sha) < 20:
                continue
            if name in state:
                if state[name] != sha:
                    _LOG.error("Remote outbox entry changed after import: %s; ignoring mutation", name)
                continue
            if downloaded >= MAX_FILES_PER_POLL:
                break

            file_url = f"{API}/repos/{REPOSITORY}/contents/outbox/{urllib.parse.quote(name)}?ref={BRANCH}"
            payload = _get_json(file_url, token, MAX_BYTES * 2 + 10_000)
            if payload.get("sha") != sha or payload.get("encoding") != "base64":
                raise ValueError("Unexpected GitHub file response")
            try:
                raw = base64.b64decode(payload["content"], validate=False)
            except (KeyError, binascii.Error, ValueError) as exc:
                raise ValueError("Invalid GitHub file encoding") from exc
            _validate_batch(raw)

            local_path = INBOX / ("github-" + name)
            if local_path.exists():
                if local_path.is_symlink() or local_path.read_bytes() != raw:
                    raise ValueError("Local inbox conflict: " + name)
            else:
                _atomic_write(local_path, raw)

            state[name] = sha
            _atomic_write(STATE_FILE, (json.dumps(state, indent=2) + "\n").encode())
            downloaded += 1
            _LOG.warning("GitHub Sync queued: %s", name)

        if len(listing) >= 1000:
            _LOG.warning("GitHub outbox reached 1000 entries; archive old records after backup")
        _save_status("ok", downloaded=downloaded)
    except urllib.error.HTTPError as exc:
        _LOG.error("GitHub sync HTTP %s (token contents not logged)", exc.code)
        _save_status("http_error", message=f"GitHub HTTP {exc.code}")
    except Exception as exc:
        _LOG.error("GitHub sync failed: %s", type(exc).__name__)
        _save_status("error", message=type(exc).__name__)
