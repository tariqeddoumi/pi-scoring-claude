// Sommaire collant d'une page longue : une pastille par section, défilement
// horizontal sur mobile. Les cibles portent un id et la classe scroll-mt-*.

export function SectionNav({ sections, label = "Sur cette page" }: { sections: { id: string; label: string }[]; label?: string }) {
  if (sections.length < 2) return null;
  return (
    <nav aria-label={label} className="sticky top-[52px] md:top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-muted/95 backdrop-blur border-b border-border">
      <ul className="flex gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:thin]">
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="inline-block rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Anchor({ id }: { id: string }) {
  // -mb-6 compense l'espacement vertical (space-y-6) du conteneur : pas de double marge.
  return <div id={id} className="scroll-mt-28 md:scroll-mt-16 -mb-6" aria-hidden="true" />;
}
