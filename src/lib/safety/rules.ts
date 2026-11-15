/**
 * Safety rules for FlagModel analysis.
 * Data-driven rule sets for destructive, path, and network/credential flags.
 *
 * Matching is word-based, not substring-based: "rm" must not match "--form",
 * "hard" must not match "--hardware", and "port" must not match "--support".
 * The two destructive phrases ("clean --all", "reset --hard") match as
 * word sequences after normalizing separators to spaces.
 */

/** Destructive words, matched as whole words (case-insensitive). */
export const DESTRUCTIVE_WORDS = [
  "delete",
  "remove",
  "rm",
  "force",
  "overwrite",
  "purge",
  "drop",
  "destroy",
  "wipe",
];

/**
 * Destructive phrases, matched as word sequences after normalizing
 * non-alphanumeric separators to spaces (so "reset --hard", "--reset-hard"
 * and "reset --hard" all match "reset --hard").
 */
export const DESTRUCTIVE_PHRASES = ["clean --all", "reset --hard"];

/**
 * Path flag value patterns (matched case-insensitively against valueName).
 * Substring match is right here: value placeholders are single tokens, and
 * "filename" genuinely means a file path.
 */
export const PATH_VALUE_PATTERNS = ["FILE", "PATH", "DIR", "OUTPUT", "DIRECTORY", "LOCATION"];

/** Network and credential patterns, matched as whole words (case-insensitive). */
export const NETWORK_CREDENTIAL_PATTERNS = [
  "url",
  "host",
  "port",
  "token",
  "password",
  "key",
  "auth",
  "credential",
  "api",
  "secret",
];
