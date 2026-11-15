import { readFileSync, writeFileSync } from "fs";
import { runAdapterLoop } from "./src/lib/agent-loop/loop.js";

const helpText = readFileSync("/tmp/textkit_help.txt", "utf-8");
const result = runAdapterLoop(helpText);

console.log("Agent loop result:");
console.log(JSON.stringify(result.summary, null, 2));
console.log("\nTools generated:");
console.log(JSON.stringify(result.tools, null, 2));

// Write the server.js
const serverContent = result.files["server.js"];
writeFileSync("/home/hatch/workspace/frankenmcp/servers/textkit/mcp-server.js.generated", serverContent);
console.log("\nGenerated server written to mcp-server.js.generated");
