"""STEVORA read-only memory MCP server."""
import os
from pathlib import Path
from mcp.server.fastmcp import FastMCP

MEMORY_DIR = Path("/config/stevora/memory")
ALLOWED = {
    "knowledge_base.md",
    "ideas.json",
    "decisions.json",
    "implementation.json",
    "changelog.md",
    "sync_rules.md",
    "memory_status.json",
}
MAX_BYTES = 256_000

mcp = FastMCP(
    "STEVORA Memory",
    host="0.0.0.0",
    port=8765,
    stateless_http=True,
    json_response=True,
)

def _read(filename: str) -> str:
    if filename not in ALLOWED:
        return "Access denied"
    path = MEMORY_DIR / filename
    if not path.is_file() or path.is_symlink():
        return "File unavailable"
    if path.stat().st_size > MAX_BYTES:
        return "File exceeds memory read limit"
    return path.read_text(encoding="utf-8")

@mcp.tool()
def memory_read(filename: str) -> str:
    """Read one allowlisted STEVORA project memory file."""
    return _read(filename)

@mcp.tool()
def memory_search(query: str) -> str:
    """Search allowed STEVORA memory files for a short text query."""
    query = query.strip()
    if not query or len(query) > 200:
        return "Provide a query of 1-200 characters"
    results = []
    for filename in sorted(ALLOWED):
        content = _read(filename)
        if content in ("Access denied", "File unavailable", "File exceeds memory read limit"):
            continue
        for line_no, line in enumerate(content.splitlines(), 1):
            if query.casefold() in line.casefold():
                results.append(f"{filename}:{line_no}: {line[:500]}")
                if len(results) >= 50:
                    return "\n".join(results)
    return "\n".join(results) or "No matches"

@mcp.tool()
def memory_status() -> str:
    """Read current STEVORA memory synchronization status."""
    return _read("memory_status.json")

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
