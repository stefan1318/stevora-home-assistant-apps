#!/usr/bin/env python3
"""Import explicitly supplied STEVORA ChatGPT summaries into pending local proposals.

No ChatGPT account/API access. No network calls. No automatic approval.
Run on Home Assistant host after placing a JSON batch in /share/stevora_sync/inbox.
"""
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

INBOX = Path(os.environ.get("STEVORA_SYNC_INBOX", "/share/stevora_sync/inbox"))
ARCHIVE = Path(os.environ.get("STEVORA_SYNC_ARCHIVE", "/share/stevora_sync/processed"))
MEMORY = Path(os.environ.get("STEVORA_MEMORY_DIR", "/homeassistant/stevora/memory"))
PROPOSALS = MEMORY / "proposals"
CATEGORIES = {"idea", "decision", "implementation"}
MAX_BATCH = 100
MAX_BYTES = 256000

def main():
    INBOX.mkdir(parents=True, exist_ok=True)
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    PROPOSALS.mkdir(parents=True, exist_ok=True)
    if any(p.is_symlink() for p in (INBOX, ARCHIVE, PROPOSALS)):
        raise SystemExit("Unsafe symlink directory")
    batches = sorted(INBOX.glob("*.json"))
    if not batches:
        print("No JSON batches. See docs/sync-bridge.md")
        return
    for batch in batches:
        if batch.is_symlink() or batch.stat().st_size > MAX_BYTES:
            print("SKIP unsafe or oversized:", batch.name)
            continue
        try:
            data = json.loads(batch.read_text(encoding="utf-8"))
            if not isinstance(data, dict) or not isinstance(data.get("entries"), list):
                raise ValueError("Expected object with entries array")
            entries = data["entries"]
            if not (1 <= len(entries) <= MAX_BATCH):
                raise ValueError("entries count must be 1..100")
            prepared = []
            for i, e in enumerate(entries):
                if not isinstance(e, dict):
                    raise ValueError(f"entry {i} is not an object")
                cat, title, details, source = (e.get(k) for k in ("category", "title", "details", "source"))
                if cat not in CATEGORIES or not all(isinstance(v, str) for v in (title, details, source)):
                    raise ValueError(f"entry {i}: invalid category/text")
                if not (3 <= len(title.strip()) <= 160 and 5 <= len(details.strip()) <= 4000 and 1 <= len(source.strip()) <= 120):
                    raise ValueError(f"entry {i}: invalid lengths")
                prepared.append((cat, title.strip(), details.strip(), source.strip()))
            # Stable IDs from batch contents prevent duplicates if retried.
            import hashlib
            batch_digest = hashlib.sha256(batch.read_bytes()).hexdigest()[:16]
            for i, (cat, title, details, source) in enumerate(prepared):
                proposal_id = f"sync-{batch_digest}-{i:03d}"
                path = PROPOSALS / (proposal_id + ".json")
                if path.exists():
                    print("EXISTS:", proposal_id)
                    continue
                record = {
                    "id": proposal_id, "category": cat, "title": title,
                    "details": details, "source": source,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "status": "pending_review",
                    "import_method": "manual_chatgpt_summary",
                }
                fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "w", encoding="utf-8") as out:
                    json.dump(record, out, ensure_ascii=False, indent=2)
                    out.write("\n")
                print("STAGED:", proposal_id)
            target = ARCHIVE / batch.name
            if target.exists():
                target = ARCHIVE / (batch_digest + "-" + batch.name)
            batch.rename(target)
            print("PROCESSED:", batch.name)
        except (OSError, ValueError, TypeError) as exc:
            print("ERROR:", batch.name, str(exc))

if __name__ == "__main__":
    main()
