"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CLASS_HEX: Record<string, string> = {
  SAIN: "#22c55e",
  SENSIBLE: "#eab308",
  PRE_DOUTEUX: "#f97316",
  DOUTEUX: "#ea580c",
  COMPROMIS: "#ef4444",
  CTX: "#991b1b",
};

const CLASS_FR: Record<string, string> = {
  SAIN: "Sain",
  SENSIBLE: "Sensible",
  PRE_DOUTEUX: "Pré-douteux",
  DOUTEUX: "Douteux",
  COMPROMIS: "Compromis",
  CTX: "CTX",
};

export function PortfolioChart({ data }: { data: Record<string, number> }) {
  const order = ["SAIN", "SENSIBLE", "PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"];
  const rows = order
    .map((code) => ({ code, name: CLASS_FR[code], value: data[code] ?? 0 }))
  ;
  const total = rows.reduce((n, r) => n + r.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Aucune classification établie</p>
        <p className="mt-1 max-w-xs">La répartition apparaîtra après la première classification BKAM des dossiers.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} accessibilityLayer margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
        <XAxis dataKey="name" fontSize={12} tickLine={false} />
        <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v: number) => [`${v} projet(s)`, "Dossiers"]} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {rows.map((r) => (
            <Cell key={r.code} fill={CLASS_HEX[r.code]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
