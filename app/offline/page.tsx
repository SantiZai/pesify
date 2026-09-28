import Link from "next/link";
import { CloudSlash } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/ui/button";

/** Página de respaldo cuando no hay conexión y la ruta no está cacheada. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-muted">
        <CloudSlash className="size-8 text-muted-foreground" weight="duotone" />
      </span>
      <div>
        <h1 className="text-xl font-bold">Sin conexión</h1>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          No pudimos cargar esta pantalla. Tus datos guardados siguen disponibles
          y todo lo que registres se sincroniza al reconectar.
        </p>
      </div>
      <Link href="/dashboard" className={buttonVariants()}>
        Reintentar
      </Link>
    </main>
  );
}
