#!/usr/bin/env node

/**
 * textkit — a tiny demo CLI with four text subcommands.
 * Used as the live-test target for FrankenMCP's Connect panel.
 */

function countWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function countChars(text) {
  return text.length;
}

function countLines(text) {
  if (text.trim().length === 0) return 0;
  return text.split("\n").length;
}

function wc(text, options) {
  const words = countWords(text);
  const chars = countChars(text);
  const lines = countLines(text);

  const output = [];
  if (!options.words && !options.chars && !options.lines) {
    output.push(`words: ${words}`);
    output.push(`chars: ${chars}`);
    output.push(`lines: ${lines}`);
  } else {
    if (options.words) output.push(`words: ${words}`);
    if (options.chars) output.push(`chars: ${chars}`);
    if (options.lines) output.push(`lines: ${lines}`);
  }
  return output.join("\n");
}

function reverse(text, options) {
  let result = text.split("").reverse().join("");
  if (options.upper) result = result.toUpperCase();
  return result;
}

function slugify(text, options) {
  const sep = options.separator || "-";
  const slugified = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, sep)
    .replace(
      new RegExp(
        `^${sep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}+|${sep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}+$`,
        "g",
      ),
      "",
    );
  return slugified;
}

function upper(text) {
  return text.toUpperCase();
}

function printHelp() {
  console.log(`usage: textkit <command> [options]

Commands:
  wc        Count words, chars, lines in text
    --words        Print only word count
    --chars        Print only char count
    --lines        Print only line count
  reverse   Reverse the text
    --upper        Uppercase the reversed text
  slugify   Slugify the text (lowercase, separate by dashes)
    --separator SEP  Use a custom separator (default: -)
  upper     Uppercase the text
`);
}

const FLAG_DEFS = {
  wc: {
    "--words": { key: "words" },
    "--chars": { key: "chars" },
    "--lines": { key: "lines" },
  },
  reverse: { "--upper": { key: "upper" } },
  slugify: { "--separator": { key: "separator", takesValue: true } },
  upper: {},
};

/**
 * Parse subcommand args: flags may appear anywhere (before or after the
 * positional text), in `--flag value` or `--flag=value` form. Everything
 * that is not a known flag is positional text.
 */
function parseArgs(args, flagDefs) {
  const options = {};
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      let name = arg;
      let inlineValue;
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        name = arg.slice(0, eq);
        inlineValue = arg.slice(eq + 1);
      }
      const def = flagDefs[name];
      if (!def) {
        console.error(`unknown flag: ${name}`);
        process.exit(1);
      }
      if (def.takesValue) {
        const value = inlineValue !== undefined ? inlineValue : args[++i];
        if (value === undefined) {
          console.error(`error: ${name} requires a value`);
          process.exit(1);
        }
        options[def.key] = value;
      } else {
        if (inlineValue !== undefined) {
          console.error(`error: ${name} takes no value`);
          process.exit(1);
        }
        options[def.key] = true;
      }
    } else if (arg.startsWith("-") && arg !== "-") {
      console.error(`unknown flag: ${arg}`);
      process.exit(1);
    } else {
      positionals.push(arg);
    }
  }
  return { options, text: positionals.join(" ") };
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  const flagDefs = FLAG_DEFS[command];
  if (!flagDefs) {
    console.error(`unknown command: ${command}`);
    process.exit(1);
  }

  const { options, text } = parseArgs(args.slice(1), flagDefs);
  if (!text) {
    console.error("error: text required");
    process.exit(1);
  }

  if (command === "wc") console.log(wc(text, options));
  else if (command === "reverse") console.log(reverse(text, options));
  else if (command === "slugify") console.log(slugify(text, options));
  else if (command === "upper") console.log(upper(text));
}

main();
