/**
 * POST /api/generate
 * Input: { helpText?: string; sample?: "ffmpeg" | "git" | "curl" }
 * Output: { files, tools, costs, safety, log, summary }
 */
import { NextRequest, NextResponse } from "next/server";
import { runAdapterLoop } from "@/lib/agent-loop";
import { measureTools } from "@/lib/tokens";
import { readFileSync } from "fs";
import { resolve } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HELP_TEXT = 200000;

interface GenerateRequest {
  helpText?: string;
  sample?: "ffmpeg" | "git" | "curl";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateRequest;

    // Determine which help text to use
    let helpText: string;

    if (body.sample) {
      // Load from samples
      const sampleName = body.sample;
      if (!["ffmpeg", "git", "curl"].includes(sampleName)) {
        return NextResponse.json(
          { error: "Invalid sample", detail: `Unknown sample: ${sampleName}` },
          { status: 400 },
        );
      }
      const samplePath = resolve(process.cwd(), `src/data/samples/${sampleName}.txt`);
      try {
        helpText = readFileSync(samplePath, "utf-8");
      } catch {
        return NextResponse.json(
          {
            error: "Sample not found",
            detail: `Could not read sample file: ${sampleName}`,
          },
          { status: 400 },
        );
      }
    } else if (body.helpText) {
      // Use provided help text
      if (body.helpText.length > MAX_HELP_TEXT) {
        return NextResponse.json(
          {
            error: "Help text too long",
            detail: `Help text exceeds ${MAX_HELP_TEXT} characters (got ${body.helpText.length})`,
          },
          { status: 400 },
        );
      }
      helpText = body.helpText;
    } else {
      return NextResponse.json(
        { error: "helpText or sample required", detail: "Provide either helpText or sample" },
        { status: 400 },
      );
    }

    // Run the adapter loop
    const result = runAdapterLoop(helpText);

    // Measure tools
    const costs = measureTools(result.tools);

    // Return the result
    return NextResponse.json(
      {
        files: result.files,
        tools: result.tools,
        costs,
        safety: result.safety,
        log: result.log,
        summary: result.summary,
        unparsedLines: result.unparsedLines,
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
