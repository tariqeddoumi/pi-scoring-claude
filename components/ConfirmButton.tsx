"use client";

// Bouton d'action à confirmer (suppression, rejet, recalcul global…) : fenêtre
// intégrée et accessible à la place de window.confirm. Le focus va sur
// « Annuler » (choix sûr par défaut) ; Échap ou un clic extérieur annule.

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";

export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "danger",
  onConfirm,
  disabled,
  variant = "outline",
  className,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** « danger » pour une action destructive ou irréversible. */
  tone?: "danger" | "primary";
  onConfirm: () => void;
  disabled?: boolean;
  variant?: Variant;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant={variant} disabled={disabled} className={className} aria-label={ariaLabel}>{children}</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          role="alertdialog"
          onOpenAutoFocus={(e) => { e.preventDefault(); cancelRef.current?.focus(); }}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-5 shadow-xl focus:outline-none"
        >
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">Confirmer ou annuler l&apos;action.</Dialog.Description>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Dialog.Close asChild>
              <Button ref={cancelRef} type="button" variant="outline">{cancelLabel}</Button>
            </Dialog.Close>
            <Button
              type="button"
              variant={tone === "danger" ? "danger" : "primary"}
              className={cn(tone === "danger" && "font-semibold")}
              onClick={() => { setOpen(false); onConfirm(); }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
