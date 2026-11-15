/**
 * POST /api/trim
 * Input: { tools: MCPToolSchema[], mode: 'full' | 'trimmed' | 'names-only', pickedNames?: string[] }
 * Output: { config, tokens, saved } or { error, detail }
 */
import { NextRequest, NextResponse } from "next/server";
import { buildTrimmedConfig } from "@/lib/tokens";
import type { MCPToolSchema } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOOLS = 500;

interface TrimRequest {
  tools?: unknown;
  mode?: unknown;
  pickedNames?: unknown;
}

/**
 * Validate that the input is a valid MCPToolSchema array.
 */
function isValidToolArray(tools: unknown): tools is MCPToolSchema[] {
  if (!Array.isArray(tools)) {
    return false;
  }
  return tools.every(
    (tool) =>
      typeof tool === "object" &&
      tool !== null &&
      typeof (tool as Record<string, unknown>).name === "string" &&
      typeof (tool as Record<string, unknown>).description === "string" &&
      typeof (tool as Record<string, unknown>).inputSchema === "object",
  );
}

/**
 * Validate that the input is a valid mode string.
 */
function isValidMode(mode: unknown): mode is "full" | "trimmed" | "names-only" {
  return mode === "full" || mode === "trimmed" || mode === "names-only";
}

/**
 * Validate that the input is a valid pickedNames array.
 */
function isValidPickedNames(pickedNames: unknown): pickedNames is string[] {
  if (!Array.isArray(pickedNames)) {
    return false;
  }
  return pickedNames.length > 0 && pickedNames.every((name) => typeof name === "string");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TrimRequest;

    // Validate tools
    if (!isValidToolArray(body.tools)) {
      return NextResponse.json(
        {
          error: "invalid tools",
          detail:
            "tools must be a non-empty array of objects each with name (string), description (string), and inputSchema (object)",
        },
        { status: 400 },
      );
    }

    if (body.tools.length === 0) {
      return NextResponse.json(
        {
          error: "invalid tools",
          detail: "tools array must not be empty",
        },
        { status: 400 },
      );
    }

    if (body.tools.length > MAX_TOOLS) {
      return NextResponse.json(
        {
          error: "tools too large",
          detail: `tools array exceeds ${MAX_TOOLS} items (got ${body.tools.length})`,
        },
        { status: 400 },
      );
    }

    // Validate mode
    if (!isValidMode(body.mode)) {
      return NextResponse.json(
        {
          error: "invalid mode",
          detail: "mode must be one of: 'full', 'trimmed', 'names-only'",
        },
        { status: 400 },
      );
    }

    // Validate pickedNames for trimmed mode
    if (body.mode === "trimmed") {
      if (!isValidPickedNames(body.pickedNames)) {
        return NextResponse.json(
          {
            error: "invalid pickedNames",
            detail: "trimmed mode requires pickedNames as a non-empty array of strings",
          },
          { status: 400 },
        );
      }
    }

    // Build the trimmed config
    const pickNames =
      body.mode === "trimmed" && isValidPickedNames(body.pickedNames)
        ? body.pickedNames
        : undefined;
    const result = buildTrimmedConfig(body.tools, body.mode, pickNames);

    return NextResponse.json(
      {
        config: result.config,
        tokens: result.tokens,
        saved: result.saved,
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
