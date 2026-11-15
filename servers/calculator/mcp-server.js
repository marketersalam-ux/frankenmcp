/**
 * MCP Server for calculator
 * Minimal calculator with add, subtract, multiply, divide.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Tool definitions
const TOOLS = [
  {
    name: "add",
    description: "Add two numbers",
    inputSchema: {
      type: "object",
      properties: {
        a: {
          type: "number",
          description: "First number",
        },
        b: {
          type: "number",
          description: "Second number",
        },
      },
      required: ["a", "b"],
      additionalProperties: false,
    },
  },
  {
    name: "subtract",
    description: "Subtract two numbers",
    inputSchema: {
      type: "object",
      properties: {
        a: {
          type: "number",
          description: "First number",
        },
        b: {
          type: "number",
          description: "Second number",
        },
      },
      required: ["a", "b"],
      additionalProperties: false,
    },
  },
  {
    name: "multiply",
    description: "Multiply two numbers",
    inputSchema: {
      type: "object",
      properties: {
        a: {
          type: "number",
          description: "First number",
        },
        b: {
          type: "number",
          description: "Second number",
        },
      },
      required: ["a", "b"],
      additionalProperties: false,
    },
  },
  {
    name: "divide",
    description: "Divide two numbers",
    inputSchema: {
      type: "object",
      properties: {
        a: {
          type: "number",
          description: "Dividend",
        },
        b: {
          type: "number",
          description: "Divisor",
        },
      },
      required: ["a", "b"],
      additionalProperties: false,
    },
  },
];

async function callTool(name, args) {
  const a = args?.a;
  const b = args?.b;

  // Type validation
  if (typeof a !== "number" || typeof b !== "number") {
    throw new Error("Arguments a and b must be numbers");
  }

  switch (name) {
    case "add":
      return String(a + b);
    case "subtract":
      return String(a - b);
    case "multiply":
      return String(a * b);
    case "divide":
      if (b === 0) {
        throw new Error("Division by zero");
      }
      return String(a / b);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server(
  { name: "frankenmcp-calculator", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await callTool(request.params.name, request.params.arguments || {});
    return { content: [{ type: "text", text: result }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: message }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
