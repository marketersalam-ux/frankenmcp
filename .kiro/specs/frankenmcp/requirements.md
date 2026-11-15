# Requirements — FrankenMCP

Feature: `frankenmcp` — Kiroween 2026, Frankenstein category.
Acceptance criteria in EARS notation (WHEN [event] THE SYSTEM SHALL [behaviour]).

## Introduction

FrankenMCP is a web app that turns any CLI tool into a working MCP server and shows exactly what that server costs in context-window tokens. It has three parts: a generator (CLI `--help` text → MCP server code + token costs + safety review), a live MCP client (connect, list tools, measure token costs, probe tools), and a visible adapter agent loop (parse → generate → validate → fix → verify). The core path needs no API keys and no sign-in.

## Glossary

- **Adapter Agent:** the deterministic agent loop that parses help text, generates an MCP server, validates it, fixes issues, and verifies the result, logging every step.
- **Tool schema:** an MCP tool definition (name, description, input JSON Schema).
- **Token cost:** the number of tokens in a tool schema's JSON text, counted with the cl100k tokenizer.
- **Trimmed config:** an MCP client config containing a reduced tool set (names-only, or a user-picked subset).
- **Bundled demo server:** an MCP server shipped with the app (textkit, calculator), spawned server-side on demand from an allowlist.

## Requirements

### Requirement 1: Generate an MCP server from --help text

**User Story:** As a developer using AI coding agents, I want to paste a CLI tool's `--help` output and get a working MCP server for it, so that my agent can use a tool it otherwise couldn't reach.

#### Acceptance Criteria

1. WHEN a user pastes `--help` text and submits it, THE SYSTEM SHALL parse it into a structured model of flags, options, and subcommands.
2. WHEN the help text contains lines the parser cannot understand, THE SYSTEM SHALL list them as unparsed lines and SHALL NOT invent flags for them.
3. WHEN parsing succeeds, THE SYSTEM SHALL generate a complete Node.js MCP server (server file, package file, README) implementing one MCP tool per parsed command/flag group.
4. WHEN the generated server code is produced, THE SYSTEM SHALL include setup instructions a stranger can follow to run it locally.
5. WHEN a user selects a built-in sample (ffmpeg, git, or curl), THE SYSTEM SHALL load that tool's real `--help` text into the input.

### Requirement 2: Adapter Agent loop with a visible log

**User Story:** As a developer, I want to see each step the generator takes and what it fixes, so that I can trust output I didn't write by hand.

#### Acceptance Criteria

1. WHEN generation runs, THE SYSTEM SHALL record and display each step: parse, generate, validate, fix, verify.
2. WHEN validation finds an issue in the generated schemas, THE SYSTEM SHALL log the issue, apply a fix, and re-validate before reporting success.
3. WHEN validation fails after fixes, THE SYSTEM SHALL report the failure with the specific issue instead of presenting broken output as valid.
4. WHEN generation completes, THE SYSTEM SHALL display a summary (flags parsed, tools generated, issues fixed, verification result).

### Requirement 3: Token cost measurement

**User Story:** As a developer, I want to know what an MCP server costs my context window before I install it, so that I don't blow my budget on tool schemas.

#### Acceptance Criteria

1. WHEN tool schemas exist (generated or from a connected server), THE SYSTEM SHALL count the tokens of each schema's JSON text with the cl100k tokenizer.
2. WHEN token costs are displayed, THE SYSTEM SHALL show per-tool cost and total cost, and SHALL state which tokenizer was used and that counts are estimates.
3. WHEN a user requests a trimmed config, THE SYSTEM SHALL produce a config with the chosen subset (full, trimmed, or names-only) and show the token saving versus the full set.
4. WHEN the same schemas are measured twice, THE SYSTEM SHALL return identical counts (deterministic measurement).

### Requirement 4: Safety review of generated adapters

**User Story:** As a developer, I want dangerous options flagged before I hand a generated server to my agent, so that the agent can't delete my files because a flag looked harmless.

#### Acceptance Criteria

1. WHEN the generated tools include options matching the destructive list (delete, remove, force, overwrite, recursive-remove, and equivalents), THE SYSTEM SHALL flag each one with its exact option text and a plain-language warning.
2. WHEN an option accepts filesystem paths, THE SYSTEM SHALL flag traversal risk and note that the generated server does not sandbox paths.
3. WHEN an option implies network access or credential use, THE SYSTEM SHALL flag it.
4. WHEN no safety issues are found, THE SYSTEM SHALL say so explicitly instead of showing an empty panel.

### Requirement 5: Live MCP connection and probing

**User Story:** As a developer, I want to connect to an MCP server and see its tools and costs live, so that I can evaluate a server before adding it to my agent.

#### Acceptance Criteria

1. WHEN a user selects a bundled demo server, THE SYSTEM SHALL spawn it server-side, connect with the MCP SDK, and list its tools.
2. WHEN a user pastes a remote MCP server URL (SSE or streamable HTTP), THE SYSTEM SHALL connect to it and list its tools, with a short timeout and a clear error on failure.
3. WHEN tools are listed from a live server, THE SYSTEM SHALL show each tool's schema token cost alongside it.
4. WHEN a user picks a tool, fills its arguments, and probes it, THE SYSTEM SHALL call the tool on the live server and display the result verbatim.
5. WHEN a server connection fails, THE SYSTEM SHALL show the specific error instead of a generic failure message.

### Requirement 6: No execution of user CLIs

**User Story:** As the app operator, I want the app to never execute user-supplied commands, so that the hosted app cannot be turned into a remote shell.

#### Acceptance Criteria

1. WHEN a user submits `--help` text, THE SYSTEM SHALL treat it as text only and SHALL NOT execute any command named in it.
2. WHEN the app spawns an MCP server, THE SYSTEM SHALL spawn only servers from the bundled allowlist.
3. WHEN a spawned server process ends, THE SYSTEM SHALL terminate it at the end of the request and SHALL NOT leave processes running between requests.

### Requirement 7: Free, keyless, no sign-in

**User Story:** As a hackathon judge, I want to test the whole app without an account or API key, so that I can evaluate it in minutes.

#### Acceptance Criteria

1. WHEN a judge opens the app URL, THE SYSTEM SHALL present the full workflow without a sign-in screen.
2. WHEN a judge uses generate, connect, measure, or probe, THE SYSTEM SHALL NOT ask for an API key.
3. WHEN the optional LLM review is offered (stretch goal), THE SYSTEM SHALL keep it optional and SHALL keep any user key client-side only.

### Requirement 8: Downloadable output

**User Story:** As a developer, I want to download the generated server and the trimmed config, so that I can use them in my own agent setup.

#### Acceptance Criteria

1. WHEN generation completes, THE SYSTEM SHALL offer the generated server as a downloadable archive containing the server file, package file, and README.
2. WHEN a trimmed config is produced, THE SYSTEM SHALL offer it as copy-to-clipboard and as a downloadable file.
3. WHEN a download is requested, THE SYSTEM SHALL include the token-cost summary and the safety review in the download or alongside it.

### Requirement 9: Honest limits, stated in the UI

**User Story:** As a user, I want the app to tell me what it can't do, so that I don't trust output beyond its limits.

#### Acceptance Criteria

1. WHEN the parser degrades on unusual help formats, THE SYSTEM SHALL show what it could not parse.
2. WHEN token counts are shown, THE SYSTEM SHALL label them as estimates from the named tokenizer.
3. WHEN the Adapter Agent is described in the UI, THE SYSTEM SHALL describe it as a deterministic loop, not as an LLM.
