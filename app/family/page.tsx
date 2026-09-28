'use client';

import { useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { createFamily, joinFamily, useFamily } from "@/lib/firebase/family";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopNav } from "@/components/desktop-nav";
import { Avatar } from "@/components/avatar";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { Check, Copy, Users } from "@phosphor-icons/react";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";

export default function FamilyPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const familyId = profile?.currentFamilyId ?? null;
  const { family, members, loading, error } = useFamily(familyId);

  const [inviteCopied, setInviteCopied] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

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

  const handleCopyInvite = async () => {
    if (!familyId) return;
    try {
      await navigator.clipboard.writeText(familyId);
    } catch {
      // Portapapeles no disponible (permisos/HTTP): se muestra el código igual.
    }
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");
    if (!user) return;
    setJoining(true);
    try {
      await joinFamily(joinCode, user.uid);
      await refreshProfile();
      setJoinCode("");
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : "No se pudo unir a la familia.");
    } finally {
      setJoining(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!user) return;
    setCreating(true);
    try {
      await createFamily(newName, user.uid);
      await refreshProfile();
      setNewName("");
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "No se pudo crear la familia.");
    } finally {
      setCreating(false);
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
          <h1 className="text-3xl font-bold tracking-tight">Familia</h1>
          <p className="text-muted-foreground">Quienes comparten tus gastos</p>
        </header>

        {/* Familia actual + miembros */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Familia activa</CardTitle>
              <CardDescription className="text-2xl font-bold text-foreground">
                {loading ? "…" : (family?.name ?? "—")}
              </CardDescription>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-red-500">{error}</p>}

            {/* Código de invitación = id de la familia */}
            {familyId && (
              <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Código de invitación</p>
                  <p className="truncate font-mono text-sm font-bold">{familyId}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyInvite}>
                  {inviteCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {inviteCopied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium">
                Miembros ({loading ? "…" : members.length})
              </p>
              {loading ? (
                <p className="text-sm text-muted-foreground">Cargando miembros...</p>
              ) : (
                <ul className="divide-y">
                  {members.map((m) => (
                    <li key={m.uid} className="flex items-center gap-3 py-2.5">
                      <Avatar name={m.displayName} photoURL={m.photoURL} className="size-9" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {m.displayName}
                          {m.uid === user?.uid && (
                            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                              Tú
                            </span>
                          )}
                        </p>
                        {!!m.email && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Unirse con código */}
        <Card>
          <CardHeader>
            <CardTitle>Unirse a otra familia</CardTitle>
            <CardDescription>Pegá el código que te compartieron para ver sus gastos.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="grid gap-3">
              {joinError && <p className="text-sm font-medium text-red-500">{joinError}</p>}
              <div className="grid gap-2">
                <Label htmlFor="join-code">Código de invitación</Label>
                <Input
                  id="join-code"
                  type="text"
                  placeholder="Pegá el código acá"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={joining}>
                {joining ? "Uniéndote..." : "Unirse"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Crear familia */}
        <Card>
          <CardHeader>
            <CardTitle>Crear una familia nueva</CardTitle>
            <CardDescription>Se crea vacía con vos como único miembro y pasás a ella.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-3">
              {createError && <p className="text-sm font-medium text-red-500">{createError}</p>}
              <div className="grid gap-2">
                <Label htmlFor="family-name">Nombre</Label>
                <Input
                  id="family-name"
                  type="text"
                  maxLength={40}
                  placeholder="Ej: Casa de mamá"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <Button type="submit" variant="outline" disabled={creating}>
                {creating ? "Creando..." : "Crear familia"}
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
