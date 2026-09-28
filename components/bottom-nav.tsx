"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartBar, Gear, House, Plus, Users, type Icon } from "@phosphor-icons/react";
import { cn } from "cn";

type Props = {
  onAdd: () => void;
};

type Item = {
  label: string;
  icon: Icon;
  href?: string;
  /** Todavía no existe la pantalla: se muestra deshabilitado. */
  soon?: boolean;
};

// Familia, Reportes y Ajustes ya tienen pantalla.
const ITEMS: Item[] = [
  { label: "Inicio", icon: House, href: "/dashboard" },
  { label: "Familia", icon: Users, href: "/family" },
  { label: "Reportes", icon: ChartBar, href: "/reports" },
  { label: "Ajustes", icon: Gear, href: "/settings" },
];

/**
 * Bottom navigation mobile-first estilo dock flotante: píldora separada del
 * borde con los 4 links (icono + etiqueta) y el botón + circular al final.
 */
export function BottomNav({ onAdd }: Props) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:hidden">
      <div className="mx-auto flex max-w-md items-center gap-1 rounded-[28px] border bg-background/95 px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur supports-backdrop-filter:bg-background/80">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = !!item.href && pathname === item.href;
          const cls = cn(
            "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-medium transition-colors",
            active ? "text-primary" : "text-muted-foreground",
            item.soon && "opacity-50"
          );
          const content = (
            <>
              <Icon className="size-6" weight={active ? "fill" : "regular"} />
              <span className="truncate">{item.label}</span>
            </>
          );
          return item.soon || !item.href ? (
            <span key={item.label} aria-disabled title="Próximamente" className={cn(cls, "cursor-not-allowed")}>
              {content}
            </span>
          ) : (
            <Link key={item.label} href={item.href} className={cn(cls, "hover:text-primary")}>
              {content}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onAdd}
          title="Agregar movimiento"
          aria-label="Agregar movimiento"
          className="ml-1 flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95"
        >
          <Plus className="size-6" weight="bold" />
        </button>
      </div>
    </nav>
  );
}
