interface CostTableProps {
  costs: {
    perTool: Array<{ name: string; tokens: number }>;
    total: number;
  };
}

export default function CostTable({ costs }: CostTableProps) {
  // Sort by tokens descending
  const sorted = [...costs.perTool].sort((a, b) => b.tokens - a.tokens);

  return (
    <div className="space-y-2">
      <div className="overflow-y-auto" style={{ maxHeight: "320px" }}>
        <table className="w-full text-sm font-mono">
          <thead className="sticky top-0 bg-lab-panel border-b border-lab-line">
            <tr>
              <th className="text-left px-3 py-2 text-slime">Tool</th>
              <th className="text-right px-3 py-2 text-slime">Tokens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lab-line">
            {sorted.map((tool) => (
              <tr key={tool.name} className="hover:bg-lab-panel transition-colors">
                <td className="px-3 py-2 text-bone">{tool.name}</td>
                <td className="text-right px-3 py-2 text-slime-dim">{tool.tokens}</td>
              </tr>
            ))}
            <tr className="bg-lab-panel border-t-2 border-lab-line font-semibold">
              <td className="px-3 py-2 text-slime">Total</td>
              <td className="text-right px-3 py-2 text-slime">{costs.total}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ash">
        Token counts are estimates counted with the cl100k_base tokenizer (tiktoken).
      </p>
    </div>
  );
}
