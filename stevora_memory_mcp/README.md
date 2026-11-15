# STEVORA Memory MCP

Home Assistant MCP service for reading local STEVORA project memory and staging **pending proposals**.

## Tools
- `memory_read`, `memory_search`, `memory_status`: read-only memory access
- `memory_propose(category, title, details, source)`: creates a pending proposal
- `memory_list_proposals(limit)`: lists pending proposals

Categories: `idea`, `decision`, `implementation`. **All three are proposals only.** The MCP service cannot approve proposals, alter `decisions.json`, or claim a feature has been implemented.

Proposals are saved under `/config/stevora/memory/proposals/` (visible via Samba as `\\\\HOMEASSISTANT\\config\\stevora\\memory\\proposals\\`). Review manually before any promotion into canonical memory. Never interpret a pending proposal as confirmed.

## Installation and upgrade
Repository: https://github.com/stefan1318/stevora-home-assistant-apps

Home Assistant → Settings → Apps → STEVORA Memory MCP → Update (after refreshing repository). Restart app if necessary. Verify logs and tools.

## Security and limitations
The MCP server has **no authentication**. Its port 8765 is not published on the host; **never expose it to the public internet**. Anyone with access to the internal MCP endpoint may create pending proposals. Only deploy on a trusted internal network. Write access is limited by application logic to proposal files, but the app's `config:rw` mount technically grants broader filesystem permissions; for production, move proposals to a dedicated restricted storage mount and add authentication.

This app **does not automatically read or synchronize ChatGPT conversations**. A separate authenticated sync pipeline is needed. No API keys or personal memory belong in GitHub.
