#!/usr/bin/env python3
"""Convert an official ChatGPT conversations.json export to STEVORA review batches.

No network, no model calls, no approval or changes to canonical memory.
Only conversations with STEVORA in their title or message text are selected.
Outputs are deliberately labelled 'idea' and 'pending_review' by the importer;
human review is essential before turning excerpts into decisions.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

KEYWORD = re.compile(r"\\bstevora\\b", re.IGNORECASE)
REDACT = [
    re.compile(r"(?i)(sk-[a-z0-9_-]{12,})"),
    re.compile(r"(?i)(Bearer\\s+[A-Za-z0-9._~+/-]{12,})"),
]
MAX_SOURCE_BYTES = 100 * 1024 * 1024
MAX_EXCERPT = 3000

def get_text(msg):
    content = msg.get("content") or {}
    if content.get("content_type") not in ("text", "multimodal_text"):
        return ""
    parts = content.get("parts") or []
    return "\\n".join(p for p in parts if isinstance(p, str))

def clean(text):
    for pattern in REDACT:
        text = pattern.sub("[REDACTED]", text)
    return text.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("export", type=Path, help="Path to extracted conversations.json")
    parser.add_argument("--out", type=Path, default=Path("/share/stevora_sync/inbox"))
    parser.add_argument("--limit", type=int, default=100, help="Max STEVORA conversations per run")
    args = parser.parse_args()
    if args.limit < 1 or args.limit > 1000:
        parser.error("--limit must be 1..1000")
    if args.export.is_symlink() or args.export.stat().st_size > MAX_SOURCE_BYTES:
        parser.error("Source is a symlink or exceeds 100 MB")
    conversations = json.loads(args.export.read_text(encoding="utf-8"))
    if not isinstance(conversations, list):
        parser.error("Expected ChatGPT conversations.json array")
    args.out.mkdir(parents=True, exist_ok=True)
    count = 0
    for convo in conversations:
        if not isinstance(convo, dict):
            continue
        title = str(convo.get("title") or "Untitled conversation")
        mapping = convo.get("mapping") or {}
        if not isinstance(mapping, dict):
            continue
        messages = []
        for node in mapping.values():
            if not isinstance(node, dict) or not isinstance(node.get("message"), dict):
                continue
            msg = node["message"]
            role = (msg.get("author") or {}).get("role")
            if role not in ("user", "assistant"):
                continue
            body = get_text(msg)
            if body:
                messages.append((msg.get("create_time") or 0, role, body))
        messages.sort(key=lambda row: row[0] if isinstance(row[0], (int, float)) else 0)
        if not KEYWORD.search(title) and not any(KEYWORD.search(body) for _, _, body in messages):
            continue
        # Keep only short local review excerpts, never entire conversation dumps.
        excerpts = []
        for _, role, body in messages:
            if KEYWORD.search(body):
                excerpt = clean(body)[:MAX_EXCERPT]
                if excerpt:
                    excerpts.append(f"{role}: {excerpt}")
            if len(excerpts) >= 5:
                break
        if not excerpts:
            excerpts = ["Conversation title matched STEVORA; inspect source export manually."]
        conversation_id = str(convo.get("id") or title)
        digest = hashlib.sha256(conversation_id.encode("utf-8")).hexdigest()[:16]
        filename = f"chatgpt-history-{digest}.json"
        entry = {
            "category": "idea",
            "title": ("ChatGPT history review: " + clean(title))[:160],
            "details": ("Historical discussion excerpts; NOT an approved decision or verified implementation.\\n\\n" + "\\n\\n".join(excerpts))[:4000],
            "source": ("ChatGPT export, conversation " + digest)[:120],
        }
        # Skip already queued/processed conversations, based on stable export ID.
        processed = Path("/share/stevora_sync/processed") / filename
        if (args.out / filename).exists() or processed.exists():
            continue
        (args.out / filename).write_text(json.dumps({"entries": [entry]}, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
        count += 1
        if count >= args.limit:
            break
    print(f"Queued {count} STEVORA conversations for pending review.")
    print("IMPORTANT: Inspect generated files before the watcher processes them; they may contain sensitive conversation excerpts.")

if __name__ == "__main__":
    main()
