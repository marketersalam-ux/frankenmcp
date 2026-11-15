# Product — FrankenMCP

## What it is

FrankenMCP turns any CLI tool into a working MCP server and shows exactly what that server costs in context-window tokens. It is a Kiroween 2026 entry (Frankenstein category) by Salam of AheadKit — a solo student entry.

## Who it's for

Developers using AI coding agents (Claude Code, Copilot, Cursor, Kiro) who want their agent to use a CLI tool it can't reach, and who want to know the token cost before installing another MCP server.

## The core workflow (three steps, one page)

1. **Generate** — paste a CLI tool's `--help` output; the Adapter Agent parses it and generates a working MCP server (code + token costs + safety review).
2. **Connect & Measure** — connect to a live MCP server (bundled demo or remote URL); see tools, token costs, probe tools live.
3. **Config** — copy or download a trimmed MCP client config with the token saving shown.

## Product principles

- **Receipts, not claims.** Every number shows its source. Token counts name their tokenizer and are labelled estimates. The agent log shows every step. Nothing is claimed without evidence.
- **Honest limits, stated in the UI.** The parser shows what it couldn't parse. The Adapter Agent is described as a deterministic loop, not an LLM. The safety review says plainly when it finds nothing.
- **Keyless by design.** The whole core workflow works with no account and no API key. A judge must be able to test everything in minutes.
- **Never execute user commands.** User CLIs are analysed from pasted text only. Only bundled, allowlisted demo servers are ever spawned, per-request, killed at request end.
- **No face, no voice.** The demo video is a screen recording. Nothing in the product needs a camera or a microphone.
