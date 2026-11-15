# Tech — FrankenMCP

## Stack

- **Framework:** Next.js 15 (App Router) + TypeScript (strict mode).
- **Styling:** Tailwind CSS.
- **MCP:** `@modelcontextprotocol/sdk` (official TypeScript SDK) — `Client`, `StdioClientTransport`, SSE / streamable-HTTP transports.
- **Tokenizer:** `tiktoken`, `cl100k_base` encoding, server-side only.
- **Tests:** Vitest + fast-check (property-based). Run with `npm test`.
- **Lint/format:** ESLint + Prettier. Hooks run them on save.
- **Hosting:** Vercel free tier. App must stay live + free until Jan 29, 2027.
- **Repo:** public GitHub `marketersalam-ux/frankenmcp`, MIT licence.

## Constraints

- **No database, no accounts, no server-side state.** All computation is per-request in API routes.
- **Vercel Hobby functions: 10s max duration.** MCP operations spawn a child process, operate, and kill it inside one request. No long-lived processes, no sessions held between requests.
- **No secrets in the repo.** No API keys in the core path. Never commit `.env` files.
- **`.kiro/` is NEVER gitignored.** It is submission evidence (Kiroween rules §4).
- **Deterministic core.** The parser, generator, safety review, and token measurement are deterministic functions — same input, same output. No LLM in the core path.

## Commands

- `npm run dev` — local dev server.
- `npm test` — full test suite (unit + property + integration).
- `npm run lint` — ESLint.
- `npm run build` — production build (must pass before any deploy).

## Key files

- `src/lib/help-parser/` — `--help` text → flag/subcommand model.
- `src/lib/adapter-gen/` — flag model → MCP server code + tool schemas.
- `src/lib/agent-loop/` — parse → generate → validate → fix → verify, with step log.
- `src/lib/safety/` — deterministic safety rules.
- `src/lib/tokens/` — tiktoken counting + trimmed-config builder.
- `src/lib/mcp-client/` — MCP SDK wrapper (stdio for bundled, SSE/HTTP for remote).
- `src/app/api/` — `generate`, `connect`, `probe` routes.
- `servers/` — bundled demo CLI + MCP servers (allowlisted only).
