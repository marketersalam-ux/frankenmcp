# Structure — FrankenMCP

## Repository layout

```
frankenmcp/
├── .kiro/                        # Kiro evidence — committed, never gitignored
│   ├── specs/frankenmcp/         # requirements.md, design.md, tasks.md
│   ├── steering/                 # product.md, tech.md, structure.md
│   ├── hooks/                    # test-on-save.json, lint-on-save.json
│   └── settings/mcp.json         # MCP servers used during the build
├── src/
│   ├── app/                      # Next.js App Router: page.tsx + api/ routes
│   │   └── api/
│   │       ├── generate/route.ts
│   │       ├── connect/route.ts
│   │       └── probe/route.ts
│   ├── lib/
│   │   ├── help-parser/          # index.ts, parser.ts, types.ts
│   │   ├── adapter-gen/          # index.ts, generator.ts, validator.ts, templates.ts
│   │   ├── agent-loop/           # index.ts, loop.ts, types.ts
│   │   ├── safety/               # index.ts, rules.ts
│   │   ├── tokens/               # index.ts, counter.ts, trim.ts
│   │   └── mcp-client/           # index.ts, client.ts, allowlist.ts
│   ├── components/               # GeneratePanel, ConnectPanel, ConfigPanel, AgentLog, CostTable, CodeViewer
│   └── data/samples/             # real --help text: ffmpeg.txt, git.txt, curl.txt
├── servers/
│   ├── textkit/                  # bundled demo CLI (cli.js) + its MCP server (mcp-server.js)
│   └── calculator/               # minimal MCP server (mcp-server.js)
├── tests/                        # unit + property-based tests, mirroring src/lib/
├── README.md                     # setup instructions a stranger can follow in <15 min
├── LICENSE                       # MIT
└── .gitignore                    # node_modules, .next, .env* — MUST NOT contain .kiro
```

## Naming conventions

- Files and directories: `kebab-case`.
- React components: `PascalCase` files, one component per file.
- Library modules: `index.ts` re-exporting from focused files; pure functions preferred, no hidden state.
- Tests: `<name>.test.ts` next to the module under `tests/`, mirroring the `src/lib/` path.

## Conventions the agent must follow

- The spec in `.kiro/specs/frankenmcp/` is the source of truth. If code and spec disagree, fix the code — or update the spec deliberately and say so in the build log.
- Every new library function gets a unit test; every parser/generator change gets a property-based test run.
- Errors are structured `{ error, detail }`, never bare 500s with stack traces.
- UI copy is plain, specific, and honest. No AI-slop words (delve, tapestry, crucial, pivotal, seamless, unlock, elevate, vibrant, groundbreaking, "it's important to note"). No em-dash stuffing. Numbers always carry their source.
