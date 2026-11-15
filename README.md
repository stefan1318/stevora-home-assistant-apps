# STEVORA Home Assistant Apps

Home Assistant app repository for STEVORA Home.

The `stevora_memory_mcp` app exposes **read-only** MCP access to local project memory. Personal memory files and secrets are not stored in this GitHub repository.

Add the repository URL in Home Assistant Settings → Apps → Install app → Repositories.

Security: MCP port 8765 is not published to the host. Do not expose it to the internet. This version has no authentication and cannot write memory.
