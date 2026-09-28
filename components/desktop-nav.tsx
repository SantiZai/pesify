"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartBar,
  Gear,
  House,
  Plus,
  SignOut,
  Users,
  Wallet,
  type Icon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { cn } from "cn";

type Props = {
  onAdd: () => void;
  displayName: string;
  photoURL?: string | null;
  onLogout: () => void;
  loggingOut: boolean;
};

type Item = {
  label: string;
  icon: Icon;
  href?: string;
  soon?: boolean;
};

const ITEMS: Item[] = [
  { label: "Inicio", icon: House, href: "/dashboard" },
  { label: "Familia", icon: Users, href: "/family" },
  { label: "Reportes", icon: ChartBar, href: "/reports" },
  { label: "Ajustes", icon: Gear, href: "/settings" },
];

/**
 * Navegación de escritorio (§4.1 top navigation): barra superior con marca,
 * links, botón Agregar y perfil/salir. Visible solo en md+.
 */
export function DesktopNav({ onAdd, displayName, photoURL, onLogout, loggingOut }: Props) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 hidden border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 md:block">
      <div className="mx-auto flex h-16 w-full max-w-4xl items-center gap-6 px-4 md:px-8">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-5" weight="fill" />
          </span>
          <span className="text-lg font-bold tracking-tight">Pesify</span>
        </Link>

        <nav className="flex items-center gap-1">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = !!item.href && pathname === item.href;
            const cls = cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground",
              item.soon && "cursor-not-allowed opacity-50"
            );
            const content = (
              <>
                <Icon className="size-4" weight={active ? "fill" : "regular"} />
                {item.label}
              </>
            );
            return item.soon || !item.href ? (
              <span key={item.label} aria-disabled title="Próximamente" className={cls}>
                {content}
              </span>
            ) : (
              <Link key={item.label} href={item.href} className={cn(cls, "hover:text-primary")}>
                {content}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Avatar name={displayName} photoURL={photoURL} className="size-8" />
          <span className="hidden max-w-40 truncate text-sm text-muted-foreground lg:inline">
            {displayName}
          </span>
          <Button type="button" onClick={onAdd}>
            <Plus className="size-4" weight="bold" />
            Agregar
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            disabled={loggingOut}
            title="Cerrar sesión"
          >
            <SignOut className="size-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
