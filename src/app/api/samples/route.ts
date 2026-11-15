/**
 * GET /api/samples?name=ffmpeg|git|curl
 * Returns the help text for a sample CLI tool.
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SAMPLES = ["ffmpeg", "git", "curl"] as const;

interface SampleResponse {
  name: string;
  text: string;
}

export async function GET(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        { error: "name parameter required", detail: "Provide name=ffmpeg|git|curl" },
        { status: 400 },
      );
    }

    if (!VALID_SAMPLES.includes(name as never)) {
      return NextResponse.json(
        { error: "Invalid sample", detail: `Unknown sample: ${name}. Valid: ffmpeg, git, curl` },
        { status: 400 },
      );
    }

    const samplePath = resolve(process.cwd(), `src/data/samples/${name}.txt`);
    let text: string;
    try {
      text = readFileSync(samplePath, "utf-8");
    } catch {
      return NextResponse.json(
        {
          error: "Sample not found",
          detail: `Could not read sample file: ${name}`,
        },
        { status: 400 },
      );
    }

    const response: SampleResponse = { name, text };
    return NextResponse.json(response);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal server error", detail }, { status: 500 });
  }
}
