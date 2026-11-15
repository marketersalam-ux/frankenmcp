import type { FlagModel, Flag, Subcommand } from "./types";

/**
 * Parse --help text into a FlagModel.
 * Deterministic: same input always produces same output.
 * Lines the parser cannot understand go to `unparsedLines` — the parser
 * never invents flags it did not see.
 */
export function parseHelp(text: string): FlagModel {
  const lines = text.split("\n");
  const flags: Flag[] = [];
  const subcommands: Subcommand[] = [];
  const unparsedLines: string[] = [];

  const toolName = extractToolName(lines);
  const { description, index: descriptionIndex } = extractDescription(lines);

  let inSubcommands = false;
  let currentSubcommand: Subcommand | null = null;
  let pendingHeader: string | null = null;

  const flushPendingHeader = () => {
    if (pendingHeader !== null) {
      unparsedLines.push(pendingHeader);
      pendingHeader = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // The description line is consumed, not unparsed.
    if (i === descriptionIndex) continue;

    if (line.trim() === "") {
      flushPendingHeader();
      continue;
    }

    // Usage line: consumed (tool name already extracted), never unparsed.
    if (/^\s*usage:\s+\S+/i.test(line)) {
      flushPendingHeader();
      continue;
    }

    // Flag lines win everywhere — even inside a subcommand section, where
    // they belong to the current subcommand.
    const flag = parseFlagLine(line);
    if (flag) {
      flushPendingHeader();
      if (inSubcommands && currentSubcommand) {
        currentSubcommand.flags.push(flag);
      } else {
        flags.push(flag);
      }
      continue;
    }

    // Indented `name  description` entry: a subcommand only when we are
    // inside a subcommand section, or when a pending header line just
    // introduced one (git-style group headers like
    // "start a working area (see also: git help tutorial)").
    const entry = matchSubcommandEntry(line);
    if (entry) {
      if (pendingHeader !== null) {
        pendingHeader = null;
        inSubcommands = true;
        currentSubcommand = null;
      }
      if (inSubcommands) {
        currentSubcommand = { name: entry.name, description: entry.description, flags: [] };
        subcommands.push(currentSubcommand);
      } else {
        unparsedLines.push(line);
      }
      continue;
    }

    // Non-indented prose line: a possible section header.
    if (!/^\s/.test(line)) {
      flushPendingHeader();
      if (/^(commands?|subcommands?):\s*$/i.test(line.trim())) {
        inSubcommands = true;
        currentSubcommand = null;
      } else {
        pendingHeader = line;
        inSubcommands = false;
        currentSubcommand = null;
      }
      continue;
    }

    // Indented line that is neither a flag nor a subcommand entry.
    flushPendingHeader();
    unparsedLines.push(line);
  }

  flushPendingHeader();

  return { toolName, description, flags, subcommands, unparsedLines };
}

/** Tool name from the first `usage: <name>` line, or "" when there is none. */
function extractToolName(lines: string[]): string {
  for (const line of lines) {
    const match = line.match(/^\s*usage:\s+(\S+)/i);
    if (match) return match[1];
  }
  return "";
}

/**
 * Description: the last plain line before the first usage/flag line that is
 * not build metadata, not a section header (ends with ":"), and not a
 * bracketed usage continuation. "" when no such line exists. Also returns
 * the line index so the main loop can consume it instead of flagging it
 * as unparsed.
 */
function extractDescription(lines: string[]): { description: string; index: number } {
  let firstContent = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*usage:\s+\S+/i.test(lines[i]) || parseFlagLine(lines[i]) !== null) {
      firstContent = i;
      break;
    }
  }
  for (let i = firstContent - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed === "") continue;
    if (trimmed.endsWith(":")) continue;
    if (trimmed.startsWith("[")) continue;
    if (isMetadataLine(trimmed)) continue;
    return { description: trimmed, index: i };
  }
  return { description: "", index: -1 };
}

/**
 * Build/version metadata lines (shape-based, no tool names):
 * version banners, "built with" lines, configure lines, library version
 * tables, copyright lines.
 */
function isMetadataLine(trimmed: string): boolean {
  return (
    /\bversion\s+\d/i.test(trimmed) ||
    /^built with\b/i.test(trimmed) ||
    /^configuration:/i.test(trimmed) ||
    /^lib\w+\s+\d+\s*\./i.test(trimmed) ||
    /\bcopyright\b/i.test(trimmed)
  );
}

interface SubcommandEntry {
  name: string;
  description: string;
}

/** Indented `name` + 2+ spaces + description; name must not start with - or [. */
function matchSubcommandEntry(line: string): SubcommandEntry | null {
  const match = line.match(/^\s+(\S+)\s{2,}(.+)$/);
  if (!match) return null;
  const name = match[1];
  if (name.startsWith("-") || name.startsWith("[")) return null;
  return { name, description: match[2].trim() };
}

/**
 * Parse one flag line, or null when the line is not a flag line.
 *
 * Accepted shapes (GNU-style and ffmpeg-style):
 *   -d, --data <data>      description     (2+ spaces before description)
 *   -h                     description
 *   -i url                 description     (lowercase value token)
 *   -E, --cert <cert>      description     (single space after <value>)
 *   -q                                     (flags only, no description)
 *
 * The flag part and the description are split at the first run of 2+
 * spaces. When there is no such gap, the line only parses as a flag when
 * the token after the flags is an unambiguous value placeholder (<...> or
 * an UPPERCASE word) or when nothing follows the flags at all — otherwise
 * the line is left unparsed rather than guessed at.
 */
function parseFlagLine(line: string): Flag | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("-")) return null;

  const gap = trimmed.search(/\s{2,}/);
  const head = gap === -1 ? trimmed : trimmed.slice(0, gap);
  let description = gap === -1 ? "" : trimmed.slice(gap).trim();

  const tokens = tokenizeHead(head);
  const names: string[] = [];
  let valueName: string | undefined;
  let takesValue = false;
  let i = 0;

  // Consume leading flag tokens (each may carry an =VALUE suffix or a
  // trailing [...] modifier, e.g. -metadata[:<spec>] -> -metadata).
  for (; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "--") continue; // bare separator, not a flag name
    if (!/^-{1,2}[a-zA-Z0-9]/.test(token)) break;
    const eq = token.indexOf("=");
    const base = (eq === -1 ? token : token.slice(0, eq)).replace(/\[.*\]$/, "");
    if (base.length >= 2) names.push(base);
    if (eq !== -1) {
      takesValue = true;
      if (valueName === undefined) valueName = stripValueBrackets(token.slice(eq + 1)) || undefined;
    }
  }

  if (names.length === 0) return null;

  if (gap === -1) {
    // No 2+ space gap: the description (if any) follows the flags after a
    // single space. Accept the line when the token right after the flags is
    // an unambiguous value placeholder (<...>, a [-starting token, or an
    // UPPERCASE word), or when it starts with an uppercase letter (a
    // description start — the flag takes no value). A lowercase token there
    // is ambiguous between a value and a description start, so the line
    // stays unparsed rather than guessed at.
    if (i < tokens.length) {
      const v = tokens[i];
      if (/^<[^>]+>$/.test(v) || v.startsWith("[") || /^[A-Z][A-Z0-9_-]*$/.test(v)) {
        valueName = v.startsWith("<") ? stripValueBrackets(v) : v;
        takesValue = true;
        description = tokens.slice(i + 1).join(" ");
      } else if (/^[A-Z]/.test(v)) {
        description = tokens.slice(i).join(" ");
      } else {
        return null;
      }
    }
  } else {
    // With a gap, the head must be flags plus at most one value token.
    if (i < tokens.length) {
      if (i + 1 !== tokens.length || valueName !== undefined) return null;
      const v = tokens[i];
      valueName = v.startsWith("<") ? stripValueBrackets(v) : v;
      takesValue = true;
    }
  }

  return { names, takesValue, valueName, description };
}

/**
 * Tokenize a flag head on whitespace, keeping multi-word <...> value
 * placeholders whole (e.g. `<file name>`) and splitting comma-joined flags
 * (e.g. `-f,--flag`). Commas inside <...> spans are preserved.
 */
function tokenizeHead(head: string): string[] {
  const raw = head.split(/\s+/).filter((t) => t !== "");
  const tokens: string[] = [];
  let i = 0;
  while (i < raw.length) {
    const tok = raw[i];
    // Rejoin a <...> span split across whitespace.
    if (tok.startsWith("<") && !tok.endsWith(">")) {
      const parts = [tok];
      i++;
      while (i < raw.length && !raw[i].endsWith(">")) {
        parts.push(raw[i]);
        i++;
      }
      if (i < raw.length) {
        parts.push(raw[i]);
        i++;
      }
      tokens.push(parts.join(" "));
      continue;
    }
    // Split comma-joined flags like -f,--flag.
    if (tok.includes(",") && tok.split(",").every((p) => p === "" || p.startsWith("-"))) {
      tokens.push(...tok.split(",").filter((p) => p !== ""));
      i++;
      continue;
    }
    tokens.push(tok.replace(/,$/, "")); // "-d," -> "-d"
    i++;
  }
  return tokens;
}

function stripValueBrackets(token: string): string {
  return token.replace(/^[[<]+/, "").replace(/[\]>]+$/, "");
}
