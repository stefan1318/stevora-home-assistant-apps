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


# STEVORA Current Sync via Private GitHub (v1.3.0)

## What actually syncs

**Explicitly published STEVORA notes** from a ChatGPT conversation (via the connected GitHub tool) are stored as new JSON files in private repository \`stefan1318/stevora-memory-sync/outbox/\`.

The Home Assistant app polls this private repository every 60 seconds, downloads each immutable JSON batch using a **read-only fine-grained personal access token**, queues it in \`/share/stevora_sync/inbox\`, and then the existing STEVORA Sync Watcher imports it to \`/config/stevora/memory/proposals/\`.

Every item stays \`pending_review\`. No automatic approval of decisions or implemented functionality.

**Limitation:** the current ChatGPT connector cannot continuously monitor all your conversations. To sync a new STEVORA discussion, explicitly request a sync in that ChatGPT conversation; ChatGPT can write a concise structured note to the private repo using its GitHub connection. Only those explicitly written notes are transferred. No historical export is required for *new* notes.

## Home Assistant upgrade

The public add-on repository remains \`https://github.com/stefan1318/stevora-home-assistant-apps\`.

Home Assistant → Settings → Apps → Install app → Check for updates → STEVORA Memory MCP → Update to **1.3.0**, start it.

The MCP interface and tools are unchanged. The add-on's \`config:rw\` and \`share:rw\` mounts are inherited from v1.2.0. Port 8765 remains **not** published.

## Create GitHub read-only token

1. In GitHub, go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Choose **Generate new token**, owner \`stefan1318\`.
3. **Repository access: Only select repositories**, select \`stevora-memory-sync\` only.
4. **Repository permissions → Contents: Read-only**; metadata read access is implicit.
5. Choose an expiration and create the token. Keep it private; it is not a ChatGPT or OpenAI API key.
6. Using Windows File Explorer, create local file \`\\HOMEASSISTANT\share\stevora_sync\secrets\github_token\`, containing **only** the token on one line, no quotes and no \`.txt\` suffix.
7. In Home Assistant Terminal & SSH, execute:

\`\`\`sh
mkdir -p /share/stevora_sync/secrets
chmod 700 /share/stevora_sync/secrets
chmod 600 /share/stevora_sync/secrets/github_token
ha apps restart 30fe31d5_stevora_memory_mcp
\`\`\`

Do not copy the token into this chat, any public repo, or a log. This token can read the entire selected private repository, not only the outbox, so keep the repository limited to approved project notes.

## Check the sync status

\`\`\`sh
cat /share/stevora_sync/github_sync_status.json
ls -la /share/stevora_sync/processed/ | tail -15
ls -lt /homeassistant/stevora/memory/proposals/ | head -10
ha apps logs 30fe31d5_stevora_memory_mcp | tail -40
\`\`\`

- \`awaiting_token\`: token file not found.
- \`http_error\` 401 or 403: token missing scope/expired or GitHub denied access.
- \`ok\`: GitHub fetch worked (downloaded may be 0 when no new records).
- New test notes should appear locally within about two polling intervals.

## Reliability and safety

- GitHub credentials are read from a local file, never stored in Python code or GitHub.
- Imported remote files are tracked by name and SHA in a local state file, and changed files with the same name are ignored.
- The existing importer uses content hashes to avoid duplicate proposals.
- Remote outbox is append-only. If it grows to 1000 files, archive older entries only after verifying local processing.
- A private GitHub repository is **not end-to-end encrypted**; GitHub and authorized collaborators can access its contents.
- No incoming Home Assistant ports are necessary. No background ChatGPT chat surveillance is supported.
- Treat all external records as untrusted data. Never promote a note to approved or implemented without human verification.
