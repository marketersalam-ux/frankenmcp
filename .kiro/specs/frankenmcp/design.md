# Design — FrankenMCP

Feature: `frankenmcp` — Kiroween 2026, Frankenstein category.

## Overview

FrankenMCP is a Next.js 15 (App Router) + TypeScript web app deployed on Vercel. It has no database and no user accounts. All computation happens in Next.js API routes (serverless) or in pure library functions; all state is per-request. The app has two user-facing flows (Generate, Connect & Measure) and one shared concern (the Adapter Agent loop with its visible log).

## Architecture

```
Browser (React UI: three panels + agent log + code viewer)
    │  POST /api/generate   { helpText } or { sample }
    │  POST /api/connect    { target: "textkit" | "calculator" | { url } }
    │  POST /api/probe      { target, tool, args }
    ▼
Next.js API routes (serverless, per-request, no held state)
    ├── lib/help-parser     --help text → FlagModel
    ├── lib/agent-loop      parse → generate → validate → fix → verify (+ step log)
    ├── lib/adapter-gen     FlagModel → { server.js, package.json, README.md } + tool schemas
    ├── lib/safety          deterministic rules → SafetyFlag[]
    ├── lib/tokens          tiktoken counts + trimmed-config builder
    └── lib/mcp-client      MCP SDK wrapper (stdio for bundled, SSE/HTTP for remote)
    ▼
Bundled demo MCP servers (allowlisted, spawned per-request, killed at request end)
  servers/textkit/mcp-server.js   servers/calculator/mcp-server.js
```

## Components and Interfaces

### help-parser (`src/lib/help-parser/`)

- **Input:** raw `--help` text (string).
- **Output:** `FlagModel`:
  ```ts
  interface FlagModel {
    toolName: string;
    description: string;
    flags: Flag[];            // { names: string[]; takesValue: boolean; valueName?: string; description: string }
    subcommands: Subcommand[]; // { name: string; description: string; flags: Flag[] }
    unparsedLines: string[];  // lines the parser could not understand, shown to the user
  }
  ```
- **Parsing rules (deterministic):**
  - Lines matching `(-{1,2}[a-zA-Z0-9][a-zA-Z0-9-]*)([ ,]+(-{1,2}[a-zA-Z0-9][a-zA-Z0-9-]*))*(\s+<[^>]+>|\s+[A-Z][A-Z0-9_-]*)?\s{2,}(.*)` are flags; a value placeholder (`<FILE>`, `FILE`, `=VALUE`) marks `takesValue`.
  - Lines under a `Commands:` / `Subcommands:` heading, matching `^  (\S+)\s{2,}(.*)`, are subcommands.
  - Everything else that is non-empty and not a heading is recorded in `unparsedLines`.
- **Testing:** property-based round-trip with fast-check — generate a `FlagModel`, render it as help text with a known renderer, parse it back, assert deep equality (modulo whitespace). Plus hand-verified fixtures: real ffmpeg, git, curl `--help` output, with expected flag counts recorded.

### adapter-gen (`src/lib/adapter-gen/`)

- **Input:** `FlagModel`.
- **Output:** `{ files: { "server.js": string; "package.json": string; "README.md": string }; tools: MCPToolSchema[]; }`
- **Generation rules:**
  - One MCP tool per subcommand, plus one tool per top-level flag group for tools without subcommands. Tool names are `snake_case`, derived from the command/flag name.
  - Each tool's `inputSchema` is a JSON Schema object built from the flags: boolean flags → `type: "boolean"`; value flags → `type: "string"` with `description` from the help text.
  - `server.js` uses `@modelcontextprotocol/sdk` (stdio transport) and shells out to the real CLI with an argument allowlist built only from parsed flags — it never passes through raw user strings as shell.
  - `README.md` contains setup instructions (install, run, add to an MCP client config) and the safety notes from the review.
- **Validation:** generated schemas are validated against the MCP tool-schema shape (name pattern, valid JSON Schema, description present). Failures go back to the agent loop for fixing.

### agent-loop (`src/lib/agent-loop/`)

- **Steps:** `parse` → `generate` → `validate` → `fix` → `verify`. Each step appends a `LogStep { step, status, detail, at }` to the run log.
- **Fix strategies (deterministic, in order):** (1) rename tools that collide or break the name pattern; (2) drop flags with empty names; (3) truncate descriptions over the length cap; (4) if validation still fails after all strategies, mark the run failed with the specific issue.
- **Output:** `{ files, tools, log: LogStep[], summary: { flagsParsed, toolsGenerated, issuesFixed, verified: boolean } }`.

### safety (`src/lib/safety/`)

- **Rules (deterministic, data-driven from `rules.ts`):**
  - Destructive list: `delete, remove, rm, force, overwrite, purge, drop, destroy, wipe, clean --all, reset --hard` (matched on flag names and descriptions, case-insensitive).
  - Path flags: any flag whose value name matches `FILE|PATH|DIR|OUTPUT` → traversal note.
  - Network/credential flags: `url, host, port, token, password, key, auth` → network/credential note.
- **Output:** `SafetyFlag[] { option, severity: "warn" | "info", message }`. Empty result is reported explicitly ("No safety issues found").

### tokens (`src/lib/tokens/`)

- `countTokens(text: string): number` — tiktoken `cl100k_base`, server-side.
- `measureTools(tools): { perTool: { name, tokens }[]; total: number }`.
- `buildTrimmedConfig(tools, mode: "full" | "trimmed" | "names-only"): { config, tokens, saved }` — names-only keeps name + one-line description; trimmed keeps the user-picked subset.
- Deterministic: same input, same counts. Verified by a test that measures twice.

### mcp-client (`src/lib/mcp-client/`)

- `listTools(target): Promise<MCPToolSchema[]>` — stdio transport for bundled servers (spawn from the allowlist, kill at request end), SSE/streamable-HTTP transport for remote URLs (5s timeout, 1 MB response cap).
- `callTool(target, toolName, args): Promise<unknown>` — same transport rules; args passed through as JSON only.
- Errors are returned as structured `{ error, detail }`, never thrown as bare 500s.

### API routes

| Route | Input | Output |
|---|---|---|
| `POST /api/generate` | `{ helpText?: string; sample?: "ffmpeg" \| "git" \| "curl" }` | `{ files, tools, costs, safety, log, summary }` |
| `POST /api/connect` | `{ target: "textkit" \| "calculator" \| { url: string } }` | `{ tools, costs }` or `{ error, detail }` |
| `POST /api/probe` | `{ target, tool: string; args: Record<string, unknown> }` | `{ result }` or `{ error, detail }` |

### UI (`src/app/page.tsx` + components)

- Three panels in one workflow: **Generate** (textarea + sample buttons + agent log + code viewer + cost table + safety panel + download) → **Connect** (server picker + tool list with costs + probe form + result) → **Config** (trimmed config viewer + copy/download).
- No sign-in, no keys, no tracking. Every number labelled with its source (tokenizer name, "estimate").

### Bundled demo servers

- **textkit** (`servers/textkit/`): a tiny real CLI (`cli.js`: `wc`, `reverse`, `slugify`, `upper`) plus its MCP server (`mcp-server.js`), generated by our own generator and then hand-verified — the dogfood proof. The CLI is the live-test target for the Connect panel.
- **calculator** (`servers/calculator/`): a minimal MCP server (add/subtract/multiply/divide) for a second live target.

## Data Models

No database. Per-request data only. The only persisted files are the sample help texts (`src/data/samples/*.txt`) and the bundled servers.

## Testing Strategy

- **Unit tests** (Vitest): parser fixtures (ffmpeg/git/curl help text with expected counts), generator output shape, safety rules, token determinism.
- **Property-based tests** (fast-check): parser round-trip (model → rendered help → parse → equal model); generator invariant (every generated tool has a valid name + valid JSON Schema + non-empty description); token measurement monotonicity (adding a tool never reduces the total).
- **Integration tests:** API routes against the bundled servers (spawn → list → probe → kill), run in CI-less local `npm test` (no CI service needed; hooks run tests on save).
- **Manual verification:** the demo script (ARCHITECTURE.md) is run end-to-end against the deployed Vercel URL before recording, and the recording is of the deployed app, not localhost.

## Security Considerations

- No arbitrary execution (see Requirement 6): only allowlisted bundled servers are spawned; user CLI text is never executed.
- No secrets in the repo; no keys in the core path.
- Remote URL fetches: 5s timeout, 1 MB cap, no credentials forwarded.
- Generated code is inert source the user inspects before running; the download README says so.
