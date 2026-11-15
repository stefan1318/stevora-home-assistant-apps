# STEVORA Memory MCP

Local Home Assistant app exposing **read-only** MCP tools for STEVORA project memory.

Tools: `memory_read`, `memory_search`, `memory_status`.

Memory is stored locally in `/config/stevora/memory/` and is not included in this GitHub repository.

## Installation
Add this repository URL to Home Assistant **Settings → Apps → Install app → Repositories**:
https://github.com/stefan1318/stevora-home-assistant-apps

Install STEVORA Memory MCP, start it, and inspect its logs.

## MCP
The server uses Streamable HTTP at `/mcp` on port 8765 inside the app container. The host port is deliberately **not published**. Connect only through a trusted internal network path. No authentication is implemented, so **never port-forward or expose this service publicly**.

This release does not modify Home Assistant settings or memory files. It does not automatically sync ChatGPT history. Do not treat plans as completed implementations.
