# STEVORA Memory Bridge (Home Assistant)

The bridge uses the **existing Home Assistant WebSocket authentication**. It never exposes the MCP add-on port to the internet and never forwards a Home Assistant token to the MCP service.

## Install on Home Assistant Dunav

1. Copy `custom_components/stevora_memory_bridge/` from this directory into `/config/custom_components/stevora_memory_bridge/`.
2. Add to `/config/configuration.yaml`:
   ```yaml
   stevora_memory_bridge:
   ```
3. Run Home Assistant configuration validation and restart Home Assistant.
4. Open the latest STEVORA Companion build, sign in with a Home Assistant **admin** account and open Settings → Memory Manager.
5. Read Knowledge Base or Sync Status, then search for a known phrase. If the bridge is not installed, the Android client shows an unavailable message.

## WebSocket contract

- `stevora_memory/read`: `filename` from fixed allowlist; returns `content`, `truncated`
- `stevora_memory/search`: `query` 1–200 characters; returns up to 50 bounded matches
- `stevora_memory/proposals`: `limit` 1–30; returns review queue

Every command checks `connection.user.is_admin` **server-side**. All filesystem operations are confined to the existing `/config/stevora/memory` canonical store, reject symlinks and impose file and output limits. This is a **read-only** bridge; proposal approval, rejection and permanent memory writes are intentionally not implemented. They must not be advertised as supported until server-side confirmation, locking, atomic writes and audit logging are implemented and tested.

The bridge reads the same canonical files as the MCP service, but does not connect to the MCP HTTP transport. The two interfaces share a trusted local backing store.

**Deployment status:** repository source only. A GitHub commit does not install this integration on Home Assistant.
