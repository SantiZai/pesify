'use client';

import { useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, SignOut } from "@phosphor-icons/react";

export default function Dashboard() {
  // Ahora sacamos también el 'profile'
  const { user, profile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  // signOut como promesa flotante dejaba el channel de Firestore a medio
  // cerrar y cualquier rechazo quedaba sin manejar. Así queda limpio;
  // AuthGuard redirige a /login al detectar user == null.
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Error al cerrar sesión:", e);
      setLoggingOut(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <header className="flex justify-between items-center pb-4 border-b">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inicio</h1>
          <p className="text-muted-foreground">Bienvenido, {profile?.displayName}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} disabled={loggingOut} title="Cerrar sesión">
          <SignOut className="h-5 w-5" />
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Familia Activa</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Personal</div>
            <p className="text-xs text-muted-foreground">
              ID: <span className="font-mono">{profile?.currentFamilyId?.slice(0, 8)}...</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}