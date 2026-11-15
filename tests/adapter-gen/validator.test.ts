/**
 * Tests for the adapter-gen validator module.
 * Tests validation of tool schemas.
 */
import { describe, it, expect } from "vitest";
import { validateTools } from "../../src/lib/adapter-gen";
import type { MCPToolSchema } from "../../src/lib/tokens/types";

describe("adapter-gen: validator", () => {
  describe("validateTools", () => {
    it("passes valid tools", () => {
      const tools: MCPToolSchema[] = [
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: {
            type: "object",
            properties: {
              verbose: { type: "boolean", description: "Be verbose" },
              args: { type: "array", items: { type: "string" } },
            },
            additionalProperties: false,
          },
        },
      ];

      const result = validateTools(tools);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("fails on invalid name pattern", () => {
      const tools: MCPToolSchema[] = [
        {
          name: "Test-Tool",
          description: "A test tool",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      ];

      const result = validateTools(tools);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain("name must match");
    });

    it("fails on duplicate names", () => {
      const tools: MCPToolSchema[] = [
        {
          name: "test_tool",
          description: "First",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: "test_tool",
          description: "Second",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      ];

      const result = validateTools(tools);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes("duplicate"))).toBe(true);
    });

    it("fails on empty description", () => {
      const tools: MCPToolSchema[] = [
        {
          name: "test_tool",
          description: "",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      ];

      const result = validateTools(tools);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain("description");
    });

    it("fails on non-object inputSchema", () => {
      const tools: MCPToolSchema[] = [
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: {
            type: "string",
            properties: {},
            additionalProperties: false,
          } as Record<string, unknown>,
        },
      ];

      const result = validateTools(tools);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain('inputSchema.type must be "object"');
    });

    it("fails on missing properties object", () => {
      const tools: MCPToolSchema[] = [
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: {
            type: "object",
            additionalProperties: false,
          } as Record<string, unknown>,
        },
      ];

      const result = validateTools(tools);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain("properties");
    });

    it("fails on invalid property schema type", () => {
      const tools: MCPToolSchema[] = [
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: {
            type: "object",
            properties: {
              flag: { type: "invalid_type", description: "A flag" },
            },
            additionalProperties: false,
          } as Record<string, unknown>,
        },
      ];

      const result = validateTools(tools);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain("type must be one of");
    });

    it("accepts all valid JSON Schema types", () => {
      const types = ["string", "boolean", "number", "integer", "array", "object"];
      for (const schemaType of types) {
        const tools: MCPToolSchema[] = [
          {
            name: "test_tool",
            description: "A test tool",
            inputSchema: {
              type: "object",
              properties: {
                flag: { type: schemaType, description: "A flag" },
              },
              additionalProperties: false,
            } as Record<string, unknown>,
          },
        ];

        const result = validateTools(tools);
        expect(result.valid).toBe(true);
      }
    });
  });
});
