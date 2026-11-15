# STEVORA Sync Bridge — safe manual intake (v0.1)

This first stage is **not automatic ChatGPT synchronization**. It imports a JSON summary that a person explicitly provides, stages every entry as `pending_review`, and never modifies canonical `decisions.json` or `implementation.json`.

## Install
Download `sync_bridge/import_chatgpt_batch.py` from this GitHub repository and place it in `\\HOMEASSISTANT\\share\\stevora_sync\\import_chatgpt_batch.py`. Create the `inbox` folder beside it.

## Batch format
Save a UTF-8 JSON file to `\\HOMEASSISTANT\\share\\stevora_sync\\inbox\\stevora-update-001.json`:

```json
{
  "entries": [
    {
      "category": "idea",
      "title": "Example STEVORA feature",
      "details": "A proposed feature discussed in ChatGPT; not approved.",
      "source": "ChatGPT STEVORA conversation, 2026-11-15"
    }
  ]
}
```

Allowed categories: `idea`, `decision`, `implementation`. All become **pending proposals**, even when labeled decision or implementation. A human must verify and approve them separately. Do not put API keys, tokens, passwords, personal addresses, or sensitive home details into batches.

## Run

```sh
python3 /share/stevora_sync/import_chatgpt_batch.py
```

Proposals appear in `/homeassistant/stevora/memory/proposals/`. Processed batches move to `/share/stevora_sync/processed/`. Identical batches are idempotent via content-based IDs.

## Security
No listening port, no network calls, no secrets, no GitHub upload of memory. The local MCP server remains separate and should never be exposed publicly. A future automatic sync requires a separately authorized, documented source of ChatGPT data; GitHub alone cannot retrieve private ChatGPT chats.
