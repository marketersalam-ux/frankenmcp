import type { SafetyFlag } from "@/lib/safety";

interface SafetyPanelProps {
  safety: SafetyFlag[];
}

function severityBadge(severity: "warn" | "info"): React.ReactNode {
  const baseClass = "inline-block px-2 py-0.5 text-xs font-semibold rounded";
  if (severity === "warn") {
    return <span className={`${baseClass} bg-blood text-bone`}>warn</span>;
  }
  return <span className={`${baseClass} bg-lab-line text-ash`}>info</span>;
}

export default function SafetyPanel({ safety }: SafetyPanelProps) {
  if (safety.length === 0) {
    return <p className="text-sm text-bone">No safety issues found.</p>;
  }

  const warnings = safety.filter((f) => f.severity === "warn").length;
  const notes = safety.filter((f) => f.severity === "info").length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ash">
        {warnings} warning{warnings !== 1 ? "s" : ""}, {notes} note{notes !== 1 ? "s" : ""}
      </p>
      <div className="space-y-2">
        {safety.map((flag, idx) => (
          <div key={idx} className="p-3 bg-lab-panel border border-lab-line rounded space-y-1">
            <div className="flex items-center gap-2">
              {severityBadge(flag.severity)}
              <code className="text-xs text-slime font-mono">{flag.option}</code>
            </div>
            <p className="text-sm text-bone">{flag.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
