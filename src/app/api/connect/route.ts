/**
 * POST /api/connect
 * Input: { target: MCPTarget }
 * Output: { tools, costs } or { error, detail }
 */
import { NextRequest, NextResponse } from "next/server";
import { listTools, isMCPTarget } from "@/lib/mcp-client";
import { measureTools } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ConnectRequest {
  target?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ConnectRequest;

    if (!isMCPTarget(body.target)) {
      return NextResponse.json(
        {
          error: "invalid target",
          detail: 'target must be "textkit", "calculator", or { url: string }',
        },
        { status: 400 },
      );
    }

    // List tools from the MCP server
    let tools;
    try {
      tools = await listTools(body.target);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        {
          error: "connection failed",
          detail: message,
        },
        { status: 502 },
      );
    }

    // Measure tools
    const costs = measureTools(tools);

    return NextResponse.json(
      {
        tools,
        costs,
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "internal error",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
