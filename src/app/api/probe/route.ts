/**
 * POST /api/probe
 * Input: { target: MCPTarget; tool: string; args: Record<string, unknown> }
 * Output: { result } or { error, detail }
 */
import { NextRequest, NextResponse } from "next/server";
import { callTool, isMCPTarget } from "@/lib/mcp-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProbeRequest {
  target?: unknown;
  tool?: unknown;
  args?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ProbeRequest;

    // Validate target
    if (!isMCPTarget(body.target)) {
      return NextResponse.json(
        {
          error: "invalid target",
          detail: 'target must be "textkit", "calculator", or { url: string }',
        },
        { status: 400 },
      );
    }

    // Validate tool name
    if (typeof body.tool !== "string" || body.tool.trim() === "") {
      return NextResponse.json(
        {
          error: "invalid tool",
          detail: "tool must be a non-empty string",
        },
        { status: 400 },
      );
    }

    // Validate args
    if (typeof body.args !== "object" || body.args === null || Array.isArray(body.args)) {
      return NextResponse.json(
        {
          error: "invalid args",
          detail: "args must be a plain object",
        },
        { status: 400 },
      );
    }

    // Call the tool
    let result;
    try {
      result = await callTool(body.target, body.tool, body.args as Record<string, unknown>);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        {
          error: "tool call failed",
          detail: message,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        result,
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
