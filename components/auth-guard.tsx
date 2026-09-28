"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { CircleNotchIcon } from "@phosphor-icons/react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // '/demo' es pública: probar sin cuenta (con sesión va al dashboard).
    const isAuthRoute = pathname === '/login' || pathname === '/' || pathname === '/offline' || pathname === '/demo';

    if (!user && !isAuthRoute) {
      // Si no hay sesión y quiere ir a una ruta privada, al login
      router.replace('/login');
    } else if (user && isAuthRoute) {
      // Si hay sesión y está en login o landing, al dashboard
      router.replace('/dashboard');
    }
  }, [user, loading, pathname, router]);

  // Muestra un estado de carga mientras Firebase revisa si hay sesión
  // Esto evita el destello de pantallas equivocadas
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <CircleNotchIcon className="h-8 w-8 animate-spin text-primary" weight="bold" />
      </div>
    );
  }

  // Si está en una ruta equivocada pero ya mandamos el replace,
  // renderizamos nada hasta que cambie la ruta.
  // ('/offline' es pública: la sirve el Service Worker sin conexión.)
  const isAuthRoute = pathname === '/login' || pathname === '/' || pathname === '/offline' || pathname === '/demo';
  if ((!user && !isAuthRoute) || (user && isAuthRoute)) {
    return null;
  }

  return <>{children}</>;
}