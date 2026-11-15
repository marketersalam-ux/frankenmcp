import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { POST as generatePost } from "@/app/api/generate/route";
import { GET as samplesGet } from "@/app/api/samples/route";
import { POST as connectPost } from "@/app/api/connect/route";
import { POST as probePost } from "@/app/api/probe/route";
import { POST as trimPost } from "@/app/api/trim/route";

const mockRequest = (body: unknown): NextRequest => {
  // Route handlers only use request.json(), so a plain Request works;
  // cast through unknown to satisfy the NextRequest parameter type.
  return new Request("http://localhost:3000/api/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as unknown as NextRequest;
};

const mockRequestWithUrl = (url: string): NextRequest => {
  // Create a proper NextRequest-like object with nextUrl
  const urlObj = new URL(`http://localhost:3000${url}`);
  const request = new Request(urlObj, { method: "GET" });
  // Create a minimal NextRequest-like mock with nextUrl property
  return {
    ...request,
    nextUrl: urlObj,
  } as unknown as NextRequest;
};

interface GenerateResponse {
  tools?: Array<{ name: string }>;
  costs?: { total: number };
  log?: unknown[];
  summary?: { verified: boolean };
  unparsedLines?: string[];
  error?: string;
}

interface SampleResponse {
  name?: string;
  text?: string;
  error?: string;
  detail?: string;
}

interface ConnectResponse {
  tools?: Array<{ name: string }>;
  costs?: { total: number };
  error?: string;
}

interface ProbeResponse {
  result?: { content?: Array<{ text?: string }> };
  error?: string;
}

interface TrimResponse {
  config?: unknown;
  tokens?: number;
  saved?: number;
  error?: string;
}

async function jsonBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("API routes", () => {
  describe("GET /api/samples", () => {
    it("returns ffmpeg sample with correct text", async () => {
      const response = await samplesGet(mockRequestWithUrl("/api/samples?name=ffmpeg"));
      const data = await jsonBody<SampleResponse>(response);

      expect(response.status).toBe(200);
      expect(data.name).toBe("ffmpeg");
      expect(typeof data.text).toBe("string");
      expect(data.text).toContain("ffmpeg version");
    });

    it("returns git sample", async () => {
      const response = await samplesGet(mockRequestWithUrl("/api/samples?name=git"));
      const data = await jsonBody<SampleResponse>(response);

      expect(response.status).toBe(200);
      expect(data.name).toBe("git");
      expect(typeof data.text).toBe("string");
    });

    it("returns curl sample", async () => {
      const response = await samplesGet(mockRequestWithUrl("/api/samples?name=curl"));
      const data = await jsonBody<SampleResponse>(response);

      expect(response.status).toBe(200);
      expect(data.name).toBe("curl");
      expect(typeof data.text).toBe("string");
    });

    it("returns 400 on invalid sample name", async () => {
      const response = await samplesGet(mockRequestWithUrl("/api/samples?name=invalid"));
      const data = await jsonBody<SampleResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid sample");
    });

    it("returns 400 when name parameter is missing", async () => {
      const response = await samplesGet(mockRequestWithUrl("/api/samples"));
      const data = await jsonBody<SampleResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("name parameter required");
    });
  });

  describe("POST /api/generate", () => {
    it("generates 22 tools from git sample", async () => {
      const response = await generatePost(mockRequest({ sample: "git" }));
      const data = await jsonBody<GenerateResponse>(response);

      expect(response.status).toBe(200);
      expect(Array.isArray(data.tools)).toBe(true);
      expect(data.tools?.length).toBe(22);
      expect(data.costs).toBeDefined();
      expect(typeof data.costs?.total).toBe("number");
      expect(data.costs?.total).toBeGreaterThan(0);
      expect(Array.isArray(data.log)).toBe(true);
      expect(data.log?.length).toBe(5);
      expect(data.summary?.verified).toBe(true);
      expect(Array.isArray(data.unparsedLines)).toBe(true);
      expect(data.unparsedLines?.length).toBe(9);
    });

    it("generates tools from ffmpeg sample with unparsed lines", async () => {
      const response = await generatePost(mockRequest({ sample: "ffmpeg" }));
      const data = await jsonBody<GenerateResponse>(response);

      expect(response.status).toBe(200);
      expect(Array.isArray(data.unparsedLines)).toBe(true);
      expect(data.unparsedLines?.length).toBe(25);
    });

    it("generates tool from simple help text", async () => {
      const response = await generatePost(
        mockRequest({ helpText: "usage: test\n\n  --verbose   Be verbose\n" }),
      );
      const data = await jsonBody<GenerateResponse>(response);

      expect(response.status).toBe(200);
      expect(Array.isArray(data.tools)).toBe(true);
      expect(data.tools?.length).toBeGreaterThanOrEqual(1);
    });

    it("returns 400 when neither helpText nor sample provided", async () => {
      const response = await generatePost(mockRequest({}));
      const data = await jsonBody<GenerateResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("helpText or sample required");
    });

    it("returns 400 on invalid sample", async () => {
      const response = await generatePost(mockRequest({ sample: "invalid" }));
      const data = await jsonBody<GenerateResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe("POST /api/connect", () => {
    it("connects to textkit and returns 4 tools", async () => {
      const response = await connectPost(mockRequest({ target: "textkit" }));
      const data = await jsonBody<ConnectResponse>(response);

      expect(response.status).toBe(200);
      expect(Array.isArray(data.tools)).toBe(true);
      expect(data.tools?.length).toBe(4);
      expect(data.costs).toBeDefined();
      expect(typeof data.costs?.total).toBe("number");
      expect(data.costs?.total).toBeGreaterThan(0);
    });

    it("connects to calculator and returns 4 tools", async () => {
      const response = await connectPost(mockRequest({ target: "calculator" }));
      const data = await jsonBody<ConnectResponse>(response);

      expect(response.status).toBe(200);
      expect(Array.isArray(data.tools)).toBe(true);
      expect(data.tools?.length).toBe(4);
    });

    it("returns 400 on invalid target", async () => {
      const response = await connectPost(mockRequest({ target: "invalid" }));
      const data = await jsonBody<ConnectResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("invalid target");
    });

    it("returns 400 on missing target", async () => {
      const response = await connectPost(mockRequest({}));
      const data = await jsonBody<ConnectResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("invalid target");
    });
  });

  describe("POST /api/probe", () => {
    it("probes calculator add tool", async () => {
      const response = await probePost(
        mockRequest({ target: "calculator", tool: "add", args: { a: 2, b: 3 } }),
      );
      const data = await jsonBody<ProbeResponse>(response);

      expect(response.status).toBe(200);
      expect(data.result).toBeDefined();
      const content = data.result?.content;
      expect(Array.isArray(content)).toBe(true);
      expect(content?.[0]?.text).toBe("5");
    });

    it("returns 400 on invalid target", async () => {
      const response = await probePost(
        mockRequest({ target: "invalid", tool: "add", args: { a: 2, b: 3 } }),
      );
      const data = await jsonBody<ProbeResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("invalid target");
    });

    it("returns 400 on missing tool", async () => {
      const response = await probePost(mockRequest({ target: "calculator", args: { a: 2, b: 3 } }));
      const data = await jsonBody<ProbeResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("invalid tool");
    });

    it("returns 400 on empty tool name", async () => {
      const response = await probePost(
        mockRequest({ target: "calculator", tool: "  ", args: { a: 2, b: 3 } }),
      );
      const data = await jsonBody<ProbeResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("invalid tool");
    });

    it("returns 400 on invalid args", async () => {
      const response = await probePost(
        mockRequest({ target: "calculator", tool: "add", args: "not an object" }),
      );
      const data = await jsonBody<ProbeResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("invalid args");
    });

    it("returns 400 on array args", async () => {
      const response = await probePost(
        mockRequest({ target: "calculator", tool: "add", args: [1, 2] }),
      );
      const data = await jsonBody<ProbeResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("invalid args");
    });
  });

  describe("POST /api/trim", () => {
    const sampleTools = [
      {
        name: "tool_a",
        description: "First tool",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "tool_b",
        description: "Second tool",
        inputSchema: { type: "object", properties: {} },
      },
    ];

    it("full mode returns all tools with saved 0", async () => {
      const response = await trimPost(mockRequest({ tools: sampleTools, mode: "full" }));
      const data = await jsonBody<TrimResponse>(response);

      expect(response.status).toBe(200);
      expect(data.config).toBeDefined();
      expect(typeof data.tokens).toBe("number");
      expect(data.tokens).toBeGreaterThan(0);
      expect(data.saved).toBe(0);
    });

    it("names-only mode returns fewer tokens and saved > 0", async () => {
      const response = await trimPost(mockRequest({ tools: sampleTools, mode: "names-only" }));
      const data = await jsonBody<TrimResponse>(response);

      expect(response.status).toBe(200);
      expect(data.config).toBeDefined();
      expect(typeof data.tokens).toBe("number");
      expect(data.tokens).toBeGreaterThan(0);
      expect(typeof data.saved).toBe("number");
      expect(data.saved).toBeGreaterThan(0);
    });

    it("trimmed mode with pickedNames returns only picked tools", async () => {
      const response = await trimPost(
        mockRequest({
          tools: sampleTools,
          mode: "trimmed",
          pickedNames: ["tool_a"],
        }),
      );
      const data = await jsonBody<TrimResponse>(response);

      expect(response.status).toBe(200);
      expect(data.config).toBeDefined();
      expect(typeof data.saved).toBe("number");
      expect(data.saved).toBeGreaterThan(0);
    });

    it("invalid mode returns 400", async () => {
      const response = await trimPost(mockRequest({ tools: sampleTools, mode: "invalid" }));
      const data = await jsonBody<TrimResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("invalid mode");
    });

    it("trimmed mode without pickedNames returns 400", async () => {
      const response = await trimPost(mockRequest({ tools: sampleTools, mode: "trimmed" }));
      const data = await jsonBody<TrimResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("invalid pickedNames");
    });

    it("empty tools array returns 400", async () => {
      const response = await trimPost(mockRequest({ tools: [], mode: "full" }));
      const data = await jsonBody<TrimResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("invalid tools");
    });

    it("invalid tools (not an array) returns 400", async () => {
      const response = await trimPost(mockRequest({ tools: "not an array", mode: "full" }));
      const data = await jsonBody<TrimResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe("invalid tools");
    });
  });
});
