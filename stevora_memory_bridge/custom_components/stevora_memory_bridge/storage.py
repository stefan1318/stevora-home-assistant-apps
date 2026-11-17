"""Transactional proposal decisions for STEVORA canonical memory."""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/config/stevora/memory")
ID_RE = re.compile(r"^[a-zA-Z0-9_-]{8,100}$")
SECRET_RE = re.compile(r"(?i)(password|passwd|api[_ -]?key|secret|bearer\s+|private[_ -]?key|access[_ -]?token|refresh[_ -]?token|парола|токен|частен ключ|-----BEGIN|ghp_|github_pat_|sk-[A-Za-z0-9])")
MAX_SIZE = 256_000


def _write_atomic(path: Path, payload: bytes):
    fd, temp = tempfile.mkstemp(prefix=".stevora-", dir=str(path.parent))
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def _read_json(path: Path, limit: int):
    if not path.is_file() or path.is_symlink() or path.stat().st_size > limit:
        raise ValueError("Unsafe or unavailable memory file")
    return json.loads(path.read_text(encoding="utf-8"))


def decide_proposal(proposal_id: str, action: str, reviewer: str, expected_hash: str) -> dict:
    if not ID_RE.fullmatch(proposal_id) or action not in ("approve", "reject"):
        raise ValueError("Invalid proposal decision")
    if not re.fullmatch(r"[0-9a-f]{64}", expected_hash):
        raise ValueError("Invalid revision hash")
    if not ROOT.is_dir() or ROOT.is_symlink():
        raise ValueError("Memory storage unavailable")
    folder = ROOT / "proposals"
    if not folder.is_dir() or folder.is_symlink():
        raise ValueError("Proposal directory unavailable")
    proposal_path = folder / (proposal_id + ".json")
    lock_path = ROOT / ".auto-memory.lock"
    if lock_path.is_symlink():
        raise ValueError("Unsafe lock path")
    with open(lock_path, "a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        proposal = _read_json(proposal_path, 16_000)
        if not isinstance(proposal, dict) or proposal.get("id") != proposal_id:
            raise ValueError("Invalid proposal")
        if proposal.get("status") != "pending_review":
            raise ValueError("Proposal already processed")
        if hashlib.sha256(proposal_path.read_bytes()).hexdigest() != expected_hash:
            raise ValueError("Proposal changed; refresh before deciding")
        category = proposal.get("category")
        title = proposal.get("title")
        details = proposal.get("details")
        if not isinstance(title, str) or not 3 <= len(title.strip()) <= 160:
            raise ValueError("Invalid title")
        if not isinstance(details, str) or not 5 <= len(details.strip()) <= 4000:
            raise ValueError("Invalid details")
        if SECRET_RE.search(title + " " + details):
            raise ValueError("Possible credential detected")
        if category not in ("idea", "decision", "implementation"):
            raise ValueError("Invalid category")
        now = datetime.now(timezone.utc).isoformat()
        audit_dir = ROOT / "audit"
        if audit_dir.is_symlink():
            raise ValueError("Unsafe audit directory")
        audit_dir.mkdir(mode=0o700, exist_ok=True)
        audit_path = audit_dir / (proposal_id + ".json")
        if audit_path.exists() or audit_path.is_symlink():
            raise ValueError("Audit record already exists")
        destination = None
        new_payload = None
        if action == "approve":
            filename = {"idea": "ideas.json", "decision": "decisions.json", "implementation": "implementation.json"}[category]
            destination = ROOT / filename
            original = destination.read_bytes() if destination.is_file() and not destination.is_symlink() and destination.stat().st_size <= MAX_SIZE else None
            if original is None:
                raise ValueError("Canonical file unavailable")
            doc = json.loads(original)
            if not isinstance(doc, dict) or not isinstance(doc.get("items"), list):
                raise ValueError("Unsupported canonical schema")
            if any(isinstance(item, dict) and (item.get("id") == proposal_id or
                   str(item.get("title", "")).strip().casefold() == title.strip().casefold()) for item in doc["items"]):
                raise ValueError("Duplicate canonical record")
            record = dict(proposal)
            record.update({"status": "approved", "approved_at": now, "approved_by": reviewer})
            doc["items"].append(record)
            new_payload = (json.dumps(doc, ensure_ascii=False, indent=2) + "\n").encode()
            if len(new_payload) > MAX_SIZE:
                raise ValueError("Canonical file size limit")
            backups = ROOT / "backups"
            if backups.is_symlink():
                raise ValueError("Unsafe backup directory")
            backups.mkdir(mode=0o700, exist_ok=True)
            backup = backups / (filename + "." + proposal_id + ".bak")
            with open(backup, "xb") as handle:
                handle.write(original)
                handle.flush()
                os.fsync(handle.fileno())
        audit = {"proposal_id": proposal_id, "action": action, "reviewer": reviewer, "at": now,
                 "revision": expected_hash, "category": category, "title": title}
        with open(audit_path, "xb") as handle:
            handle.write((json.dumps(audit, ensure_ascii=False) + "\n").encode())
            handle.flush()
            os.fsync(handle.fileno())
        # Canonical first, then proposal status. If interrupted, the audit and
        # canonical ID prevent duplicate approvals on retry.
        if destination is not None:
            _write_atomic(destination, new_payload)
        proposal["status"] = "approved" if action == "approve" else "rejected"
        proposal["reviewed_at"] = now
        proposal["reviewed_by"] = reviewer
        _write_atomic(proposal_path, (json.dumps(proposal, ensure_ascii=False, indent=2) + "\n").encode())
        return {"status": proposal["status"], "id": proposal_id, "category": category}
