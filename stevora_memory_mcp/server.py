"""STEVORA MCP: read memory and stage untrusted proposals for human review."""
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from mcp.server.fastmcp import FastMCP

MEMORY_DIR = Path("/config/stevora/memory")
PROPOSALS_DIR = MEMORY_DIR / "proposals"
ALLOWED = {
    "knowledge_base.md", "ideas.json", "decisions.json",
    "implementation.json", "changelog.md", "sync_rules.md",
    "memory_status.json",
}
MAX_BYTES = 256_000
MAX_PROPOSALS = 500

mcp = FastMCP("STEVORA Memory", host="0.0.0.0", port=8765,
              stateless_http=True, json_response=True)

def _read(filename: str) -> str:
    if filename not in ALLOWED:
        return "Access denied"
    path = MEMORY_DIR / filename
    if not path.is_file() or path.is_symlink():
        return "File unavailable"
    if path.stat().st_size > MAX_BYTES:
        return "File exceeds memory read limit"
    return path.read_text(encoding="utf-8")

@mcp.tool()
def memory_read(filename: str) -> str:
    """Read one allowlisted STEVORA project memory file."""
    return _read(filename)

@mcp.tool()
def memory_search(query: str) -> str:
    """Search allowed STEVORA memory files for a short text query."""
    query = query.strip()
    if not query or len(query) > 200:
        return "Provide a query of 1-200 characters"
    results = []
    for filename in sorted(ALLOWED):
        content = _read(filename)
        if content in ("Access denied", "File unavailable", "File exceeds memory read limit"):
            continue
        for line_no, line in enumerate(content.splitlines(), 1):
            if query.casefold() in line.casefold():
                results.append(f"{filename}:{line_no}: {line[:500]}")
                if len(results) >= 50:
                    return "\n".join(results)
    return "\n".join(results) or "No matches"

@mcp.tool()
def memory_status() -> str:
    """Read current STEVORA memory synchronization status."""
    return _read("memory_status.json")

@mcp.tool()
def memory_propose(category: str, title: str, details: str, source: str = "HA AI") -> str:
    """Stage a proposal for human review. NEVER approves decisions or changes implemented state.

    category must be idea, decision, or implementation. This is not a sync from ChatGPT.
    """
    if category not in ("idea", "decision", "implementation"):
        return "Invalid category"
    if not (3 <= len(title.strip()) <= 160 and 5 <= len(details.strip()) <= 4000
            and 1 <= len(source.strip()) <= 120):
        return "Invalid length: title 3-160, details 5-4000, source 1-120"
    if PROPOSALS_DIR.is_symlink():
        return "Unsafe proposals directory"
    if not PROPOSALS_DIR.exists():
        PROPOSALS_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    if len(list(PROPOSALS_DIR.glob("*.json"))) >= MAX_PROPOSALS:
        return "Proposal queue full; review existing proposals"
    proposal_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:12]
    record = {
        "id": proposal_id,
        "category": category,
        "title": title.strip(),
        "details": details.strip(),
        "source": source.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending_review",
    }
    path = PROPOSALS_DIR / (proposal_id + ".json")
    fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(record, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return json.dumps({"id": proposal_id, "status": "pending_review"}, ensure_ascii=False)


@mcp.tool()
def memory_save_confirmed(category: str, title: str, details: str,
                          user_confirmation: str, source: str = "STEVORA AI") -> str:
    """Save a confirmed project decision/implementation directly to permanent memory.

    Only call after the user explicitly confirms the specific decision or that
    the implementation works. Never use for ideas, guesses, tests or secrets.
    The confirmation must be the user's actual statement, not invented by AI.
    """
    import fcntl
    import hashlib
    import shutil
    import tempfile

    if category not in ("decision", "implementation"):
        return "Rejected: only confirmed decisions and implementations can auto-save"
    if not all(isinstance(v, str) for v in (title, details, user_confirmation, source)):
        return "Rejected: invalid text"
    title, details, user_confirmation, source = [v.strip() for v in
                                                 (title, details, user_confirmation, source)]
    if not (3 <= len(title) <= 160 and 5 <= len(details) <= 4000
            and 5 <= len(user_confirmation) <= 500 and 1 <= len(source) <= 120):
        return "Rejected: invalid field lengths"
    # Conservative screening: avoid storing credentials or credential-like material.
    forbidden = re.compile(
        r"(?i)(password|passwd|api[_ -]?key|secret|bearer\s+|private[_ -]?key|"
        r"access[_ -]?token|refresh[_ -]?token|парола|токен|частен ключ|"
        r"-----BEGIN|ghp_|github_pat_|sk-[A-Za-z0-9])"
    )
    if forbidden.search(" ".join((title, details, user_confirmation))):
        return "Rejected: possible secret or credential; redact and retry"
    if MEMORY_DIR.is_symlink() or not MEMORY_DIR.is_dir():
        return "Rejected: unsafe or missing memory directory"
    filename = "decisions.json" if category == "decision" else "implementation.json"
    target = MEMORY_DIR / filename
    if not target.is_file() or target.is_symlink() or target.stat().st_size > MAX_BYTES:
        return "Rejected: unsafe or missing canonical memory file"

    lock_path = MEMORY_DIR / ".auto-memory.lock"
    if lock_path.is_symlink():
        return "Rejected: unsafe lock"
    with open(lock_path, "a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        raw = target.read_bytes()
        try:
            document = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            return "Rejected: invalid canonical memory JSON"
        if not isinstance(document, dict) or not isinstance(document.get("items"), list):
            return "Rejected: unsupported canonical memory schema"
        items = document["items"]
        fingerprint = hashlib.sha256(
            (category + "\0" + title.casefold() + "\0" + details.casefold()).encode()
        ).hexdigest()[:20]
        record_id = "auto-" + fingerprint
        for item in items:
            if isinstance(item, dict) and (
                item.get("id") == record_id or
                (str(item.get("title", "")).strip().casefold() == title.casefold()
                 and item.get("category", category) == category)
            ):
                return json.dumps({"status": "already_exists", "id": item.get("id")})
        now = datetime.now(timezone.utc).isoformat()
        record = {
            "id": record_id, "category": category, "title": title,
            "details": details, "source": source, "created_at": now,
            "status": "approved", "approved_at": now,
            "approved_by": "automatic_confirmed_memory",
            "confirmation": user_confirmation,
        }
        updated = dict(document)
        updated["items"] = [*items, record]
        payload = (json.dumps(updated, ensure_ascii=False, indent=2) + "\n").encode()
        if len(payload) > MAX_BYTES:
            return "Rejected: canonical memory size limit"
        backup_dir = MEMORY_DIR / "backups"
        if backup_dir.is_symlink():
            return "Rejected: unsafe backup directory"
        backup_dir.mkdir(mode=0o700, exist_ok=True)
        backup = backup_dir / (filename + "." + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f") + ".bak")
        with open(backup, "xb") as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        fd, tmp = tempfile.mkstemp(prefix=".auto-memory-", dir=str(MEMORY_DIR))
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, "wb") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp, target)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)
        return json.dumps({"status": "saved", "id": record_id, "category": category},
                          ensure_ascii=False)

@mcp.tool()
def memory_list_proposals(limit: int = 10) -> str:
    """List pending proposal summaries; all proposals require human review."""
    if not 1 <= limit <= 30:
        return "Limit must be 1-30"
    if not PROPOSALS_DIR.is_dir() or PROPOSALS_DIR.is_symlink():
        return "[]"
    result = []
    for path in sorted(PROPOSALS_DIR.glob("*.json"), reverse=True):
        if path.is_symlink() or path.stat().st_size > 16000:
            continue
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            result.append({k: record.get(k) for k in ("id", "category", "title", "status")})
        except (OSError, ValueError):
            continue
        if len(result) >= limit:
            break
    return json.dumps(result, ensure_ascii=False)

if __name__ == "__main__":
    from sync_watcher import start_watcher
    start_watcher()
    mcp.run(transport="streamable-http")
