import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatage monétaire MAD. */
export function formatMAD(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Nombre décimal au format français (virgule), nombre de décimales fixe. */
export function formatDecimal(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null) return "—";
  return `${formatDecimal(value, digits)} %`;
}

/**
 * Montant MAD abrégé pour les indicateurs : « 866 M MAD », « 1,2 Md MAD ».
 * En dessous d'un million, le montant complet est conservé.
 */
export function formatMADCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  const a = Math.abs(value);
  if (a < 1_000_000) return formatMAD(value);
  const [div, unit] = a >= 1_000_000_000 ? [1_000_000_000, "Md"] : [1_000_000, "M"];
  const n = value / div;
  const digits = Math.abs(n) >= 100 ? 0 : 1;
  return `${formatDecimal(n, digits).replace(/,0$/, "")} ${unit} MAD`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-MA").format(value);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-MA", {
    dateStyle: "medium",
  }).format(new Date(d));
}
