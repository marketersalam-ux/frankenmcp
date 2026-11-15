/**
 * Probe arguments builder for the ConnectPanel.
 * Converts form values to typed arguments based on tool schema.
 */

/**
 * Coerce a raw string value to the target type based on property schema.
 * @param raw The raw string value from the form
 * @param propertySchema The JSON Schema property definition
 * @returns The coerced value
 * @throws Error if coercion fails (invalid number, invalid JSON)
 */
export function coerceArgValue(raw: string, propertySchema: { type?: string }): unknown {
  const schemaType = propertySchema.type;

  if (schemaType === "number" || schemaType === "integer") {
    const num = Number(raw);
    if (Number.isNaN(num)) {
      throw new Error(`Argument must be a number`);
    }
    return num;
  }

  if (schemaType === "boolean") {
    return raw === "true";
  }

  if (schemaType === "object" || schemaType === "array") {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`Argument must be valid JSON`);
    }
  }

  // Default: return as string
  return raw;
}

/**
 * Build probe arguments from form values and tool schema.
 * Skips empty optional properties; includes empty required properties after coercion.
 * @param formValues Form input values keyed by property name
 * @param tool MCPToolSchema with inputSchema
 * @returns Record of property name -> coerced value
 * @throws Error if coercion fails for a required property
 */
export function buildProbeArgs(
  formValues: Record<string, string>,
  tool: {
    inputSchema: Record<string, unknown>;
  },
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Handle missing or malformed inputSchema
  const inputSchema = tool.inputSchema as {
    properties?: Record<string, { type?: string }>;
    required?: string[];
  };

  if (!inputSchema.properties) {
    return result;
  }

  const required = inputSchema.required ?? [];
  const properties = inputSchema.properties;

  for (const [key, schema] of Object.entries(properties)) {
    const formValue = formValues[key] ?? "";
    const isRequired = required.includes(key);
    const isEmpty = formValue.trim().length === 0;

    // Skip empty optional properties
    if (!isRequired && isEmpty) {
      continue;
    }

    // Include the value (coerce, or throw if required and coercion fails)
    result[key] = coerceArgValue(formValue, schema as { type?: string });
  }

  return result;
}
