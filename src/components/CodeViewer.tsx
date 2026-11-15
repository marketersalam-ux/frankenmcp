"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";

interface CodeViewerProps {
  files: {
    "server.js": string;
    "package.json": string;
    "README.md": string;
  };
}

type FileName = "server.js" | "package.json" | "README.md";

export default function CodeViewer({ files }: CodeViewerProps) {
  const [activeTab, setActiveTab] = useState<FileName>("server.js");

  const content = files[activeTab];
  const lines = content.split("\n").length;
  const chars = content.length;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 border-b border-lab-line">
        {(["server.js", "package.json", "README.md"] as const).map((name) => (
          <button
            key={name}
            onClick={() => setActiveTab(name)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === name
                ? "border-slime text-slime"
                : "border-transparent text-ash hover:text-bone"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center text-xs text-ash">
        <span>
          {lines} lines · {chars} characters
        </span>
        <CopyButton text={content} label="Copy code" />
      </div>

      <pre className="bg-lab-panel border border-lab-line rounded p-4 font-mono text-xs overflow-x-auto text-bone whitespace-pre-wrap break-words max-h-96">
        {content}
      </pre>
    </div>
  );
}
