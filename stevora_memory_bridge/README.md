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
- `stevora_memory/proposals`: `limit` 1–30; returns review queue including SHA-256 revisions
- `stevora_memory/decide`: `proposal_id`, `revision`, `action` (`approve` or `reject`); administrator-only transactional review
- `stevora_memory/health`: storage health and available files

Every command checks `connection.user.is_admin` **server-side**. All filesystem operations are confined to the existing `/config/stevora/memory` canonical store, reject symlinks and impose file and output limits. The bridge supports **confirmed proposal approval and rejection**. Approvals update canonical JSON, use a shared advisory lock, create backups, write audit records and perform atomic replacement. A proposal must still be explicitly confirmed in the Android interface. Never approve unreviewed content. Existing Memory MCP writes should use the same lock to avoid conflicting updates. The server-side decision path has not yet been tested against the live Home Assistant installation.

The bridge reads the same canonical files as the MCP service, but does not connect to the MCP HTTP transport. The two interfaces share a trusted local backing store.

**Deployment status:** repository source only. A GitHub commit does not install this integration on Home Assistant.

## Major update installation

Update **both** `__init__.py` and `storage.py` from this repository under `/config/custom_components/stevora_memory_bridge/`, validate the Home Assistant configuration and restart HA. Install the latest Android APK. In Settings → Memory Manager, open Review proposals. Test with a harmless test proposal first, check that its status changes and that an audit record is created in `/config/stevora/memory/audit/`. Check `/config/stevora/memory/backups/` for approved changes. Do not use the approval feature on important records until this test succeeds.

## STEVORA OS Native UI

On builds that include the native Memory & Sync screen, open STEVORA OS as an
administrator and refresh after enabling the bridge. The **Memory** navigation
entry appears after the authenticated bridge health check succeeds. The screen
reads the available knowledge base and sync report and lists recent proposals
for review. If storage is unavailable, the screen reports that state.
