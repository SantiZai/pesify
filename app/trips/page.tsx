'use client';

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { createTrip, joinTrip, useTrips } from "@/lib/firebase/trips";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/date-field";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopNav } from "@/components/desktop-nav";
import { ArrowLeft, Users } from "@phosphor-icons/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TripsPage() {
  const { user, profile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const familyId = profile?.currentFamilyId ?? null;
  const { trips, loading } = useTrips(familyId, user?.uid ?? null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(todayInput());
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!familyId || !user) return;
    setCreating(true);
    try {
      const [y, m, d] = startDate.split("-").map(Number);
      await createTrip(familyId, { name, description, startDate: new Date(y, m - 1, d, 12) }, user.uid);
      setName("");
      setDescription("");
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");
    if (!user) return;
    setJoining(true);
    try {
      await joinTrip(code, user.uid);
      setCode("");
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : "No se pudo unir.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <DesktopNav
        onAdd={() => setDialogOpen(true)}
        displayName={profile?.displayName ?? user?.email ?? ""}
        photoURL={profile?.photoURL ?? user?.photoURL ?? null}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 pb-32 md:p-8 md:pb-8">
        <header className="border-b pb-4">
          <Link href="/family" className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="size-3" /> Familia
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Viajes</h1>
          <p className="text-muted-foreground">Gastos compartidos y quién le debe a quién</p>
        </header>

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle>Viajes de la familia</CardTitle>
            <CardDescription>El código de invitación es el id: compartilo como en familia.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Cargando...</p>
            ) : trips.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sin viajes todavía. Creá uno o unite con un código.
              </p>
            ) : (
              <ul className="divide-y">
                {trips.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Users className="size-5 text-primary" weight="duotone" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.participants.length} participante{t.participants.length === 1 ? "" : "s"}
                        {t.startDate && ` · desde ${format(t.startDate.toDate(), "d MMM", { locale: es })}`}
                      </p>
                    </div>
                    <Link href={`/trips/${t.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Abrir
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Unirse */}
        <Card>
          <CardHeader>
            <CardTitle>Unirse con código</CardTitle>
            <CardDescription>Pegá el código del viaje para participar.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="grid gap-3">
              {joinError && <p className="text-sm font-medium text-red-500">{joinError}</p>}
              <div className="grid gap-2">
                <Label htmlFor="trip-code">Código del viaje</Label>
                <Input
                  id="trip-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Pegá el código acá"
                />
              </div>
              <Button type="submit" disabled={joining}>
                {joining ? "Uniéndote..." : "Unirse"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Crear */}
        <Card>
          <CardHeader>
            <CardTitle>Crear viaje</CardTitle>
            <CardDescription>Se crea con vos como primer participante.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-3">
              {createError && <p className="text-sm font-medium text-red-500">{createError}</p>}
              <div className="grid gap-2">
                <Label htmlFor="trip-name">Nombre</Label>
                <Input
                  id="trip-name"
                  maxLength={60}
                  placeholder="Ej: Bariloche 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="trip-desc">Descripción (opcional)</Label>
                <Input
                  id="trip-desc"
                  maxLength={140}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Fecha de inicio (opcional)</Label>
                <DateField value={startDate} onChange={setStartDate} />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creando..." : "Crear viaje"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <AddTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        familyId={familyId}
        uid={user?.uid ?? null}
        displayName={profile?.displayName ?? user?.displayName ?? null}
        editing={null}
      />

      <BottomNav onAdd={() => setDialogOpen(true)} />
    </div>
  );
}
