# FrankenMCP

Give any CLI tool a second life as an MCP server — and see exactly what it
costs your context window.

FrankenMCP is a Kiroween 2026 entry (Frankenstein category) by Salam of
AheadKit. Paste a CLI tool's `--help` output and the Adapter Agent parses it,
generates a working MCP server, validates and verifies the output, and shows
you the token cost of every tool schema before you install it. Connect to a
live MCP server and measure it the same way.

**Live:** https://frankenmcp.vercel.app — no sign-in, no API key.

## What it does

1. **Generate** — paste `--help` text (or pick a built-in ffmpeg/git/curl
   sample). The Adapter Agent — a deterministic loop (parse → generate →
   validate → fix → verify), not an LLM — produces a working Node.js MCP
   server (`server.js` + `package.json` + README), a per-tool token-cost
   table, and a safety review that flags destructive options.
2. **Connect & Measure** — connect to a bundled demo MCP server or any remote
   SSE/streamable-HTTP server. List tools, measure each schema's token cost
   with a real tokenizer, probe tools live.
3. **Config** — copy or download a trimmed MCP client config (full / trimmed /
   names-only) with the token saving shown.

## Honest limits

- The app never executes a user's CLI server-side. User CLIs are analysed
  from pasted `--help` text only; live execution happens only for the bundled,
  allowlisted demo servers.
- Token counts use the `cl100k_base` tokenizer and are estimates.
- The `--help` parser handles GNU-style help well and shows what it couldn't
  parse on unusual formats — it never invents flags it didn't see.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000. No account, no API key.

## Tests

```bash
npm test
```

Unit + property-based tests (Vitest + fast-check).

## Built with Kiro

This project was built with [Kiro](https://kiro.dev) using spec-driven
development. The spec lives in `.kiro/specs/frankenmcp/` (requirements,
design, tasks), steering docs in `.kiro/steering/`, and agent hooks in
`.kiro/hooks/`. The build log records every Kiro feature used and what it
did.

## Licence

MIT — see `LICENSE`.
