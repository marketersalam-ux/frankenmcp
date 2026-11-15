import type { LogStep } from "@/lib/agent-loop/types";

interface AgentLogProps {
  log: LogStep[];
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  } catch {
    return "N/A";
  }
}

function statusBadge(status: "ok" | "fixed" | "failed"): React.ReactNode {
  const baseClass = "inline-block px-2 py-0.5 text-xs font-semibold rounded";
  if (status === "ok") {
    return <span className={`${baseClass} bg-slime text-lab-bg`}>ok</span>;
  }
  if (status === "fixed") {
    return <span className={`${baseClass} bg-amber-glow text-lab-bg`}>fixed</span>;
  }
  return <span className={`${baseClass} bg-blood text-bone`}>failed</span>;
}

export default function AgentLog({ log }: AgentLogProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-ash">
        Adapter Agent — a deterministic loop (parse, generate, validate, fix, verify). No LLM runs
        here.
      </p>
      <div className="space-y-1 font-mono text-sm">
        {log.map((step, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 p-2 bg-lab-panel border border-lab-line rounded"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-slime">{step.step}</span>
                {statusBadge(step.status)}
                <span className="text-ash">{formatTime(step.at)}</span>
              </div>
              <p className="text-bone whitespace-pre-wrap text-xs">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
