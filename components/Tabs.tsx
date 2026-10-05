"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex flex-wrap gap-1 rounded-lg bg-muted p-1 border border-border",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("mt-4 focus:outline-none", className)} {...props} />;
}

/**
 * Onglets dont le choix est reporté dans l'URL (?param=slug, sans navigation) :
 * le lien copié ouvre le même onglet, et un rechargement le conserve.
 */
export function UrlTabs({ param, slugs, onValueChange, ...props }: React.ComponentProps<typeof TabsPrimitive.Root> & {
  param: string;
  /** Valeur d'onglet → slug d'URL. */
  slugs: Record<string, string>;
}) {
  return (
    <TabsPrimitive.Root
      {...props}
      onValueChange={(value) => {
        onValueChange?.(value);
        const slug = slugs[value];
        if (!slug) return;
        const url = new URL(window.location.href);
        url.searchParams.set(param, slug);
        window.history.replaceState(null, "", url);
      }}
    />
  );
}
