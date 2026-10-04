"use client";

// Navigation principale : barre latérale sur grand écran, tiroir sur mobile.
// Lien actif signalé visuellement et par aria-current ; recherche de dossier
// accessible partout (renvoie vers la liste des projets filtrée).

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface NavLink { href: string; label: string; icon: IconName }
export interface NavSection { title: string; items: NavLink[] }
export interface NavUser { name: string; email: string; role: string }

export type IconName =
  | "home" | "inbox" | "folder" | "building" | "users" | "shield" | "trend" | "bolt" | "gauge"
  | "sliders" | "scale" | "book" | "upload" | "history" | "bell";

// Tracés 24×24 (trait), sans dépendance.
const PATHS: Record<IconName, string> = {
  home: "M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10",
  inbox: "M4 4h16v16H4zM4 13h4l2 3h4l2-3h4",
  folder: "M3 6h6l2 2h10v11H3z",
  building: "M4 21V5l8-2v18M12 7h8v14M7 8h2M7 12h2M7 16h2M15 11h2M15 15h2M2 21h20",
  users: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1a3 3 0 0 0-3-3M17 5a3 3 0 0 1 0 6",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  gauge: "M12 14l4-4M4 18a9 9 0 1 1 16 0",
  sliders: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
  scale: "M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8",
  book: "M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-5a3 3 0 0 0-3 3",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0",
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className={cn("h-4 w-4 shrink-0", className)} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SearchBox({ onDone }: { onDone?: () => void }) {
  return (
    <form action="/projects" method="get" role="search" onSubmit={() => onDone?.()} className="px-3">
      <label htmlFor="recherche-globale" className="sr-only">Rechercher un dossier</label>
      <input id="recherche-globale" name="q" type="search" placeholder="Rechercher un dossier…"
        className="w-full rounded-md border border-border bg-muted/60 px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:bg-background" />
    </form>
  );
}

function NavBody({ sections, user, brand, onNavigate }: {
  sections: NavSection[]; user: NavUser; brand: React.ReactNode; onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "/";
  return (
    <div className="flex h-full flex-col">
      <div className="p-4 pr-12 md:pr-4 border-b border-border">{brand}</div>
      <div className="pt-3"><SearchBox onDone={onNavigate} /></div>
      <nav aria-label="Navigation principale" className="flex-1 p-2 space-y-3 overflow-y-auto">
        {sections.map((s) => (
          <div key={s.title} className="space-y-0.5">
            <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">{s.title}</div>
            {s.items.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <Link key={n.href} href={n.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}>
                  <Icon name={n.icon} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-border space-y-2">
        <div className="text-sm font-medium leading-tight">{user.name}</div>
        <div className="text-xs text-muted-foreground break-all">{user.email} · {user.role}</div>
        <form action="/auth/signout" method="post">
          <button type="submit" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}

export function AppNav({ sections, user, brand, brandCompact }: {
  sections: NavSection[]; user: NavUser; brand: React.ReactNode; brandCompact: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Fermer le tiroir à chaque changement de page.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <aside className="w-64 shrink-0 border-r border-border bg-background hidden md:block sticky top-0 h-screen">
        <NavBody sections={sections} user={user} brand={brand} />
      </aside>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 py-2.5">
          <Dialog.Trigger asChild>
            <button type="button" aria-label="Ouvrir le menu" className="rounded-md border border-border p-2 hover:bg-muted">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </Dialog.Trigger>
          <div className="min-w-0 flex-1">{brandCompact}</div>
        </header>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 md:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[85vw] max-w-xs bg-background shadow-xl md:hidden focus:outline-none">
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <Dialog.Description className="sr-only">Navigation principale de l&apos;application</Dialog.Description>
            <Dialog.Close asChild>
              <button type="button" aria-label="Fermer le menu" className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </Dialog.Close>
            <NavBody sections={sections} user={user} brand={brand} onNavigate={() => setOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
