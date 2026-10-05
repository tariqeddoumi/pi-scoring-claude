// Tons sémantiques de l'interface : une seule source pour les couleurs des
// badges, bandeaux et statuts. Changer une teinte ici la change partout.

export const TONE = {
  neutral: "bg-slate-100 text-slate-700 border-slate-300",
  info: "bg-blue-100 text-blue-800 border-blue-300",
  success: "bg-emerald-100 text-emerald-800 border-emerald-300",
  successSoft: "bg-lime-100 text-lime-800 border-lime-300",
  warning: "bg-amber-100 text-amber-800 border-amber-300",
  alert: "bg-orange-100 text-orange-800 border-orange-300",
  danger: "bg-red-100 text-red-800 border-red-300",
  accent: "bg-purple-100 text-purple-800 border-purple-300",
} as const;

export type ToneName = keyof typeof TONE;
