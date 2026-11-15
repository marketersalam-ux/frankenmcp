/**
 * Validation of generated MCP tool schemas.
 * Checks for name pattern, uniqueness, descriptions, and JSON Schema validity.
 */
import type { MCPToolSchema } from "../tokens/types";

/**
 * Validate an array of MCP tool schemas.
 * Checks:
 * - Each name matches /^[a-z][a-z0-9_]*$/ and is unique
 * - Each description is non-empty
 * - Each inputSchema is an object with type "object", a properties object
 * - Every property schema has a valid JSON Schema type
 */
export function validateTools(tools: MCPToolSchema[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const seenNames = new Set<string>();

  for (const tool of tools) {
    // Check name pattern and uniqueness
    if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
      issues.push(
        `Tool "${tool.name}": name must match /^[a-z][a-z0-9_]*$/ (lowercase alphanumeric and underscores, starting with a letter)`,
      );
    }
    if (seenNames.has(tool.name)) {
      issues.push(`Tool "${tool.name}": duplicate name`);
    }
    seenNames.add(tool.name);

    // Check description
    if (!tool.description || tool.description.trim() === "") {
      issues.push(`Tool "${tool.name}": description is required and must not be empty`);
    }

    // Check inputSchema structure
    const schema = tool.inputSchema as Record<string, unknown>;
    if (schema.type !== "object") {
      issues.push(`Tool "${tool.name}": inputSchema.type must be "object"`);
    }
    if (!schema.properties || typeof schema.properties !== "object") {
      issues.push(`Tool "${tool.name}": inputSchema must have a properties object`);
    } else {
      const properties = schema.properties as Record<string, unknown>;
      for (const [propName, propSchema] of Object.entries(properties)) {
        if (typeof propSchema !== "object" || propSchema === null) {
          issues.push(
            `Tool "${tool.name}", property "${propName}": property schema must be an object`,
          );
          continue;
        }
        const ps = propSchema as Record<string, unknown>;
        if (!isValidJsonSchemaType(ps.type)) {
          issues.push(
            `Tool "${tool.name}", property "${propName}": type must be one of string/boolean/number/integer/array/object (got ${JSON.stringify(ps.type)})`,
          );
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Check if a value is a valid JSON Schema type.
 */
function isValidJsonSchemaType(type: unknown): boolean {
  return ["string", "boolean", "number", "integer", "array", "object"].includes(String(type));
}
