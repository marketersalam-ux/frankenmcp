# Tasks — FrankenMCP

Feature: `frankenmcp` — Kiroween 2026. Work through in order; check off as each is done and verified.
Status key: `- [ ]` pending, `- [x]` done. Requirements references are to `requirements.md`.

## Phase 1 — Scaffold (Nov 18)

- [x] 1. Create public GitHub repo `marketersalam-ux/frankenmcp` (MIT licence), clone into Kiro workspace — DONE 2026-11-15 (verified public)
- [x] 2. Commit `.kiro/` first: specs (requirements/design/tasks), steering (product/tech/structure), hooks — first commit message: `chore: kiro spec + steering + hooks (frankenmcp)` — DONE 2026-11-15 (commit f4bcabf; .kiro at root, MIT detected)
  - _Requirements: Kiro evidence (rules §4)_
- [x] 3. Scaffold Next.js 15 + TypeScript + Tailwind app; verify `npm run dev` serves the starter page — DONE 2026-11-15 (Next 15.5.29 patched, dev serves 200 "Create Next App")
- [x] 4. Add ESLint + Prettier + Vitest + fast-check + tiktoken + `@modelcontextprotocol/sdk`; verify `npm test` runs (empty suite passes) — DONE 2026-11-15 (vitest 3.2.4, fast-check 4.3.0, tiktoken 1.0.22, SDK 1.20.1, prettier 3.6.2; smoke test passes)
- [x] 5. Write `.gitignore` (node_modules, .next, .env*) — verify it does NOT contain `.kiro` — DONE 2026-11-15 (verified: no `.kiro` in .gitignore)

## Phase 2 — Core libraries (Nov 18–20)

- [x] 6. Implement `lib/help-parser` (flag/subcommand model + unparsed lines) — DONE 2026-11-15 (Kiro CLI; parser rewritten during review to remove fixture-specific hardcoding and fix description extraction; verified: ffmpeg 43 flags, git 22 subcommands, curl 256 flags)
  - _Requirements: 1.1, 1.2_
- [x] 7. Add hand-verified fixtures: real ffmpeg, git, curl `--help` text in `src/data/samples/` + expected flag counts — DONE 2026-11-15 (real output captured from local installs; counts hand-verified: ffmpeg 43/0/25, git 0/22/9, curl 256/0/2)
  - _Requirements: 1.5_
- [x] 8. Property-based round-trip test for the parser (fast-check: model → rendered help → parse → equal) — DONE 2026-11-15 (200-run round-trip + determinism properties pass; the round-trip discipline forced the clean parser rewrite)
  - _Requirements: 1.1, 1.2_
- [x] 9. Implement `lib/tokens` (tiktoken counts, per-tool + total, trimmed-config builder) + determinism test — DONE 2026-11-15 (Kiro CLI, claude-haiku-4.5; counter uses get_encoding("cl100k_base") directly)
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
- [x] 10. Implement `lib/safety` (destructive list, path flags, network/credential flags) + unit tests — DONE 2026-11-15 (Kiro CLI; matching rewritten during review to whole-word + phrase rules — substring matching falsely flagged --form/--hardware/--support; added false-positive tests)
  - _Requirements: 4.1, 4.2, 4.3, 4.4_
- [x] 11. Implement `lib/adapter-gen` (FlagModel → server.js + package.json + README + tool schemas) + schema validation — DONE 2026-11-15 (Kiro CLI, claude-haiku-4.5; server template uses ONE callTool + TOOL_COMMANDS/TOOL_FLAGS maps — per-tool callTool definitions shadowed each other and the subcommand was never passed to the CLI; name/property dedupe at generation)
  - _Requirements: 1.3, 1.4_
- [x] 12. Implement `lib/agent-loop` (parse → generate → validate → fix → verify + step log) + failure-path test — DONE 2026-11-15 (Kiro CLI, claude-haiku-4.5; fix path corrected during review — files are always rebuilt from fixed tools, all 5 steps always logged, fix strategies deep-copy + return a rename map)
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

## Phase 3 — MCP live layer (Nov 20–22)

- [x] 13. Write the bundled demo CLI `servers/textkit/cli.js` (wc/reverse/slugify/upper) and verify it runs standalone — DONE 2026-11-15 (Kiro CLI, claude-haiku-4.5; arg parsing fixed during review — flags now work anywhere + --flag=value; added flags-after-text tests)
- [x] 14. Generate textkit's MCP server with our own generator, hand-verify it, commit as `servers/textkit/mcp-server.js` (dogfood) — DONE 2026-11-15 (Kiro CLI; dogfood test is byte-equality vs fresh generation + live MCP client calls comparing server output to direct CLI output; one documented hand adjustment: run local cli.js via node; .prettierignore protects the generated file)
- [x] 15. Write `servers/calculator/mcp-server.js` (add/subtract/multiply/divide) — DONE 2026-11-15 (Kiro CLI, claude-haiku-4.5; verified: 4 tools via real MCP client, divide-by-zero + non-number errors)
- [x] 16. Implement `lib/mcp-client` (stdio for bundled allowlist + SSE/HTTP for remote URLs, timeouts + caps) + integration test (spawn → list → probe → kill) — DONE 2026-11-15 (Kiro CLI, claude-haiku-4.5; SSE/StreamableHTTP constructors take a URL object, not {url}; shared runWithClient helper; SSRF hardened — IPv6 brackets, ::ffff: mapped forms, link-local, 0.0.0.0, localhost., obfuscated numeric IPs; real hanging-server timeout test + real streamable-HTTP MCP server test)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.2, 6.3_
- [x] 17. Implement API routes `/api/generate`, `/api/connect`, `/api/probe` with structured errors — DONE 2026-11-15 (Kiro CLI, claude-haiku-4.5; next.config fixed — outputFileTracingIncludes is top-level in Next 15.5, not under experimental; 33 no-explicit-any lint errors fixed in the route tests; loop result extended with safety flags; production build succeeds, all 3 routes dynamic)
  - _Requirements: 1, 2, 3, 4, 5_

## Phase 4 — UI (Nov 22–24)

- [x] 18. Build the Generate panel (textarea + samples + agent log + code viewer + cost table + safety panel + download) — DONE 2026-11-15 (Kiro CLI, claude-haiku-4.5; GeneratePanel + AgentLog/CostTable/CodeViewer/SafetyPanel/CopyButton + GET /api/samples; fixed Tailwind v4 bg-opacity classes + <p>-in-<pre> nesting during review)
  - _Requirements: 1, 2, 3, 4, 8.1_
- [x] 19. Build the Connect panel (server picker + tool list with costs + probe form + verbatim result) — DONE 2026-11-15 (Kiro CLI, claude-haiku-4.5; ConnectPanel + probe-args helper; fixed during review: the cost table now uses the real tiktoken costs from /api/connect — a chars/4 client-side estimate was showing under a cl100k_base footnote; also fixed <span>-in-<option> + probe disabled for no-arg tools)
  - _Requirements: 5, 3_
- [x] 20. Build the Config panel (trimmed config viewer + copy + download) — DONE 2026-11-15 (Kiro CLI, claude-haiku-4.5; ConfigPanel + POST /api/trim + downloadTextFile; fixed stale pickedNames when tools arrive after mount (useEffect sync), displayed the source label, and disabled Build with 0 picks in trimmed mode)
  - _Requirements: 3.3, 8.2, 8.3_
- [x] 21. Add honest-limits labelling throughout (tokenizer name + "estimate", deterministic-loop wording, unparsed-lines display) — DONE 2026-11-15 (unparsedLines added to AgentRunResult + /api/generate response; cl100k_base + 'estimate' on every token display; deterministic-loop wording in AgentLog caption + footer; footer 'Limits, stated plainly')
  - _Requirements: 9.1, 9.2, 9.3_
- [x] 22. Full UI pass: no sign-in, no key prompts anywhere; verify the whole workflow keyless — DONE 2026-11-15 (grep-verified: no sign-in/key/password prompts in UI; e2e vs local dev server: generate ffmpeg -> connect textkit -> probe slugify 'hello_world' -> trim names-only saved 211 -> samples; 212 tests pass, tsc + lint + build green)
  - _Requirements: 7.1, 7.2_

## Phase 5 — Hardening + deploy (Nov 18 — moved up, the build finished early)

- [x] 23. Run the full test suite (unit + property + integration); fix failures; record results in BUILD-LOG.md — re-run Nov 18: 212/212 pass (19 files)
- [x] 24. Security review against Requirement 6 (no user-CLI execution, allowlist-only spawn, no secrets in repo) — grep the repo for secrets/keys — done Nov 18: secrets grep clean, no env vars in src/ or servers/, .gitignore covers .env* and .vercel
- [x] 25. Deploy to Vercel (free tier); verify the deployed URL end-to-end: generate (ffmpeg sample) → connect (textkit) → probe → download — deployed Nov 18, live at https://frankenmcp-eight.vercel.app (frankenmcp.vercel.app belongs to a different FrankenMCP project); E2E verified live: generate ffmpeg 43 flags / 25 unparsed / 851 tokens, git 22 tools / 1,180, curl 256 flags / 4,972, trim 851→19, connect textkit 4 tools / 289 + calculator 4 tools, probe add(2,3)=5, wc words:4; fixed two tracing defects en route (tiktoken WASM via serverExternalPackages; SDK server modules traced for the spawned servers)
- [ ] 26. Checkpoint: ~80% done by Nov 27. Anything unfinished is cut or descoped in writing, not silently dropped.

## Phase 6 — Packaging (Nov 18–19 — moved up, before the Agentware sprint)

- [ ] 27. Polish pass on UI copy + README (setup instructions a stranger can follow in <15 min)
- [ ] 28. Record demo video (<3 min, screen recording of the DEPLOYED app, no face, no voice); upload to YouTube (public)
- [ ] 29. Write the Kiro write-up from BUILD-LOG.md (which Kiro features, what each did — honest, specific)
- [ ] 30. Publish the Bonus Blog post on dev.to (Kiro + the project, mentioning Kiroween 2026)
- [ ] 31. Post the Social Blitz post (public, starts with `#KiroweenHackathon26`)
- [ ] 32. Fill the Devpost form (category Frankenstein + Best Student Project with BMU details) — review the full submission before submitting
- [ ] 33. SUBMIT by Nov 19–20 Dhaka time (moved up; hard deadline Dec 4). Confirm submission receipt; record the Devpost URL.

## Stretch (only if Phases 1–5 finish early)

- [ ] S1. Optional BYOK LLM review of generated adapters (key client-side only, in memory, never sent to our server)
  - _Requirements: 7.3_
- [ ] S2. More built-in `--help` samples (pandoc, rg) with hand-verified counts
