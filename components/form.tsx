"use client";

// Composants de formulaire communs : un seul style de champ, et un libellé,
// une aide et un message d'erreur reliés au champ (label/for,
// aria-describedby, aria-invalid). Les erreurs par champ renvoyées par les
// actions serveur (zod .flatten().fieldErrors) s'affichent sous le champ concerné.

import * as React from "react";
import { cn } from "@/lib/utils";
import { CONTROL } from "@/lib/formStyles";

const control = `w-full ${CONTROL}`;

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(control, className)} {...props} />;
  },
);

export interface SelectOption { value: string; label: string }

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { options: readonly SelectOption[]; placeholder?: string }
>(function Select({ className, options, placeholder, ...props }, ref) {
  return (
    <select ref={ref} className={cn(control, className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(control, className)} {...props} />;
  },
);

/** Case à cocher avec son libellé cliquable (et aide facultative). */
export function Checkbox({ label, hint, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; hint?: React.ReactNode }) {
  const id = React.useId();
  const hintId = hint ? `${id}-aide` : undefined;
  return (
    <div className={cn("flex items-start gap-2 text-sm", className)}>
      <input id={id} type="checkbox" aria-describedby={hintId} className="mt-0.5 h-4 w-4 rounded border-border accent-primary" {...props} />
      <div>
        <label htmlFor={id} className="cursor-pointer">{label}</label>
        {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

type ControlProps = { id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean; required?: boolean };

/**
 * Champ : libellé + contrôle + aide + erreur. Le contrôle (Input, Select,
 * Textarea…) est passé en enfant unique ; Field lui attribue son identifiant
 * et les attributs d'accessibilité.
 */
export function Field({ label, hint, error, required, className, children }: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** Message d'erreur, ou liste renvoyée par la validation (seul le premier est affiché). */
  error?: string | string[] | null;
  required?: boolean;
  className?: string;
  children: React.ReactElement<ControlProps>;
}) {
  const autoId = React.useId();
  const id = children.props.id ?? autoId;
  const message = Array.isArray(error) ? error[0] : error ?? undefined;
  const hintId = hint ? `${id}-aide` : undefined;
  const errorId = message ? `${id}-erreur` : undefined;
  const describedBy = [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1 text-sm min-w-0", className)}>
      <label htmlFor={id} className="block font-medium">
        {label}
        {required && <span className="text-red-600" aria-hidden="true"> *</span>}
      </label>
      {React.cloneElement(children, {
        id,
        required: required ?? children.props.required,
        "aria-invalid": message ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {message && <p id={errorId} className="text-xs font-medium text-red-700">{message}</p>}
    </div>
  );
}

/** Groupe de champs titré (fieldset accessible). */
export function FieldGroup({ title, description, className, children }: { title: string; description?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <fieldset className={cn("space-y-3 min-w-0", className)}>
      <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</legend>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {children}
    </fieldset>
  );
}

/** Message global d'un formulaire (annoncé aux lecteurs d'écran). */
export function FormMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (!error && !success) return null;
  return (
    <p role={error ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-sm", error ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800")}>
      {error ?? success}
    </p>
  );
}

export type FieldErrors = Record<string, string[] | undefined>;

/**
 * Lit le retour d'une action serveur : erreurs par champ (zod) et message global.
 * Renvoie un message global lisible même quand seules des erreurs de champ existent.
 */
export function readActionErrors(res: unknown): { fieldErrors: FieldErrors; message: string | null } {
  if (!res || typeof res !== "object" || (res as { ok?: boolean }).ok !== false) return { fieldErrors: {}, message: null };
  const r = res as { error?: unknown; errors?: unknown };
  const fieldErrors = r.errors && typeof r.errors === "object" ? (r.errors as FieldErrors) : {};
  const n = Object.values(fieldErrors).filter((v) => v && v.length).length;
  const message = typeof r.error === "string" ? r.error : n ? `${n} champ(s) à corriger — voir les messages sous les champs.` : "Enregistrement impossible.";
  return { fieldErrors, message };
}
