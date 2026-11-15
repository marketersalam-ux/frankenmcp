/**
 * Flag model interfaces for help-parser module.
 * Deterministic parsing of --help text into structured model.
 */

/**
 * A flag (option) in the help text.
 */
export interface Flag {
  /** Flag names (e.g., ['-h', '--help'] or ['--config']) */
  names: string[];
  /** Whether this flag takes a value */
  takesValue: boolean;
  /** Name of the value placeholder (e.g., 'FILE', 'URL') if takesValue is true */
  valueName?: string;
  /** Description text for this flag */
  description: string;
}

/**
 * A subcommand with its own flags.
 */
export interface Subcommand {
  /** Subcommand name (e.g., 'add', 'commit', 'push') */
  name: string;
  /** Description of the subcommand */
  description: string;
  /** Flags specific to this subcommand */
  flags: Flag[];
}

/**
 * The parsed model from help text.
 */
export interface FlagModel {
  /** Tool name extracted from usage line (e.g., 'curl', 'ffmpeg', 'git') */
  toolName: string;
  /** Short description of the tool */
  description: string;
  /** Top-level flags (options that apply to the main command) */
  flags: Flag[];
  /** Subcommands defined in this help text */
  subcommands: Subcommand[];
  /** Lines that the parser could not understand */
  unparsedLines: string[];
}
