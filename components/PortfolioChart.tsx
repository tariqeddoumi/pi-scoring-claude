"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={rows} accessibilityLayer margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <XAxis dataKey="name" fontSize={12} tickLine={false} />
          <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v: number) => [`${v} projet(s)`, "Dossiers"]} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} cursor="pointer"
            onClick={(d: { code?: string }) => d?.code && router.push(`/projects?cls=${d.code}`)}>
            {rows.map((r) => (
              <Cell key={r.code} fill={CLASS_HEX[r.code]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Accès clavier et lecteur d'écran : une pastille par classe représentée. */}
      <ul className="flex flex-wrap gap-1.5" aria-label="Voir les dossiers par classe">
        {rows.filter((r) => r.value > 0).map((r) => (
          <li key={r.code}>
            <Link href={`/projects?cls=${r.code}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs hover:bg-muted">
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: CLASS_HEX[r.code] }} />
              {r.name} · {r.value}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
