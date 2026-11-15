/**
 * Safety review module for MCP adapter flag analysis.
 * Detects destructive, path, and network/credential risks in parsed flags.
 */
import type { FlagModel, Flag } from "../help-parser";
import {
  DESTRUCTIVE_WORDS,
  DESTRUCTIVE_PHRASES,
  PATH_VALUE_PATTERNS,
  NETWORK_CREDENTIAL_PATTERNS,
} from "./rules";

/**
 * A single safety issue found during review.
 */
export interface SafetyFlag {
  /** The exact option text that triggered the flag */
  option: string;
  /** Severity level: "warn" for destructive, "info" for path/network */
  severity: "warn" | "info";
  /** Plain-language message describing the issue */
  message: string;
}

/**
 * Message shown when no safety issues are found.
 */
export const NO_ISSUES_MESSAGE = "No safety issues found";

/** Split text into lowercase words on non-alphanumeric separators. */
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== "");
}

/** Whole-word matches of `patterns` present in `text`. */
function matchingWords(text: string, patterns: string[]): string[] {
  const words = new Set(wordsOf(text));
  return patterns.filter((p) => words.has(p.toLowerCase()));
}

/**
 * Phrase matches: normalize separators to single spaces, then look for the
 * phrase as a word sequence ("reset --hard" matches "reset --hard",
 * "--reset-hard", and "reset hard").
 */
function matchingPhrases(text: string, phrases: string[]): string[] {
  const normalized = ` ${wordsOf(text).join(" ")} `;
  return phrases.filter((phrase) => {
    const words = wordsOf(phrase).join(" ");
    return normalized.includes(` ${words} `);
  });
}

/**
 * Review the safety of a parsed flag model.
 * Returns one SafetyFlag per matched pattern — a single flag can produce
 * several (e.g. `--force-delete` matches both "force" and "delete").
 * Subcommand flags are reviewed with their subcommand name included in the
 * option text, so "reset --hard" is caught as a phrase.
 */
export function reviewSafety(model: FlagModel): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  const reviewOne = (optionText: string, flag: Flag) => {
    for (const word of matchingWords(optionText, DESTRUCTIVE_WORDS)) {
      flags.push({
        option: optionText,
        severity: "warn",
        message: `Destructive option "${word}": ${optionText} may delete or modify data. Review usage before enabling for agents.`,
      });
    }
    for (const phrase of matchingPhrases(optionText, DESTRUCTIVE_PHRASES)) {
      flags.push({
        option: optionText,
        severity: "warn",
        message: `Destructive option "${phrase}": ${optionText} may delete or modify data. Review usage before enabling for agents.`,
      });
    }
    for (const word of matchingWords(flag.description, DESTRUCTIVE_WORDS)) {
      flags.push({
        option: optionText,
        severity: "warn",
        message: `Destructive operation "${word}": ${optionText} — description mentions a destructive action. Review usage before enabling for agents.`,
      });
    }
    for (const phrase of matchingPhrases(flag.description, DESTRUCTIVE_PHRASES)) {
      flags.push({
        option: optionText,
        severity: "warn",
        message: `Destructive operation "${phrase}": ${optionText} — description mentions a destructive action. Review usage before enabling for agents.`,
      });
    }
    if (flag.valueName) {
      const lower = flag.valueName.toLowerCase();
      const pathMatch = PATH_VALUE_PATTERNS.find((p) => lower.includes(p.toLowerCase()));
      if (pathMatch) {
        flags.push({
          option: optionText,
          severity: "info",
          message: `Path flag: ${optionText} accepts a ${pathMatch.toLowerCase()} value. The generated server does not sandbox paths.`,
        });
      }
    }
    for (const word of matchingWords(optionText, NETWORK_CREDENTIAL_PATTERNS)) {
      flags.push({
        option: optionText,
        severity: "info",
        message: `Network or credential flag "${word}": ${optionText} may involve external network access or credential handling.`,
      });
    }
    if (flag.valueName) {
      for (const word of matchingWords(flag.valueName, NETWORK_CREDENTIAL_PATTERNS)) {
        flags.push({
          option: optionText,
          severity: "info",
          message: `Network or credential flag "${word}": ${optionText} value involves external network access or credential handling.`,
        });
      }
    }
  };

  for (const flag of model.flags) {
    reviewOne(flag.names.join(" / "), flag);
  }
  for (const sub of model.subcommands) {
    for (const flag of sub.flags) {
      reviewOne(`${sub.name} ${flag.names.join(" / ")}`, flag);
    }
  }

  return flags;
}

/**
 * Check if a safety flag array contains any issues.
 * @param flags - Array of safety flags to check
 * @returns true if there are any issues, false if empty
 */
export function hasSafetyIssues(flags: SafetyFlag[]): boolean {
  return flags.length > 0;
}
