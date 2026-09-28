'use client';

import { useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { createFamily, deleteFamilyCascade, joinFamily, renameFamily, switchFamily, useFamily, useMyFamilies } from "@/lib/firebase/family";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopNav } from "@/components/desktop-nav";
import { Avatar } from "@/components/avatar";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { Check, Copy, Pencil, Users, X } from "@phosphor-icons/react";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";

export default function FamilyPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const familyId = profile?.currentFamilyId ?? null;
  const { family, members, loading, error } = useFamily(familyId);
  const { families: myFamilies } = useMyFamilies(user?.uid ?? null);

  const [inviteCopied, setInviteCopied] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteMsg, setDeleteMsg] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

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

  const handleRename = async () => {
    setRenameError("");
    if (!familyId || renaming) return;
    setRenaming(true);
    try {
      await renameFamily(familyId, nameDraft);
      setEditingName(false);
    } catch (err: unknown) {
      setRenameError(err instanceof Error ? err.message : "No se pudo renombrar.");
    } finally {
      setRenaming(false);
    }
  };

    const handleSwitch = async (id: string) => {
    if (!user || id === familyId || switchingId) return;
    setSwitchingId(id);
    try {
      await switchFamily(id, user.uid);
      await refreshProfile();
    } catch (err: unknown) {
      console.error("Error cambiando de familia:", err);
    } finally {
      setSwitchingId(null);
    }
  };

  const handleDelete = async () => {
    if (!familyId || !user || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteFamilyCascade(familyId, user.uid, (msg) => setDeleteMsg(msg));
      await refreshProfile();
      setDeleteOpen(false);
      setDeleteConfirm("");
      setDeleteMsg("");
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {    e.preventDefault();
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
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-medium">Familia activa</CardTitle>
              {editingName ? (
                <span className="mt-1 flex items-center gap-1">
                  <Input
                    value={nameDraft}
                    maxLength={40}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="h-9 text-xl font-bold"
                    autoFocus
                  />
                  <Button size="icon-sm" onClick={handleRename} disabled={renaming} title="Guardar">
                    <Check className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditingName(false)} title="Cancelar">
                    <X className="size-4" />
                  </Button>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <CardDescription className="truncate text-2xl font-bold text-foreground">
                    {loading ? "…" : (family?.name ?? "—")}
                  </CardDescription>
                  {!loading && family && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Cambiar nombre (cualquier miembro puede)"
                      onClick={() => { setNameDraft(family.name); setRenameError(""); setEditingName(true); }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                </span>
              )}
              {renameError && <p className="mt-1 text-xs text-red-500">{renameError}</p>}
            </div>
            <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
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

        {/* Mis familias: cambiar entre ellas */}
        {myFamilies.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Mis familias</CardTitle>
              <CardDescription>Estás en {myFamilies.length}. Tocá para cambiar de activa.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {myFamilies.map((f) => {
                  const active = f.id === familyId;
                  return (
                    <li key={f.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {f.name}
                          {active && (
                            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                              Activa
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{f.memberCount} miembro{f.memberCount === 1 ? "" : "s"}</p>
                      </div>
                      {!active && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={switchingId === f.id}
                          onClick={() => handleSwitch(f.id)}
                        >
                          {switchingId === f.id ? "Cambiando..." : "Cambiar"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

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

        {/* Zona de peligro */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Eliminar esta familia</CardTitle>
            <CardDescription>
              Borra movimientos, recurrencias, categorías, presupuestos y metas. Los miembros
              pasan a otra familia suya o a una Personal nueva.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => { setDeleteConfirm(""); setDeleteError(""); setDeleteMsg(""); setDeleteOpen(true); }}
            >
              Eliminar {family?.name ?? "familia"}...
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Confirmación de borrado: hay que escribir el nombre */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!deleting) setDeleteOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar “{family?.name}”</DialogTitle>
            <DialogDescription>
              Esto borra TODOS los datos de la familia en cascada y no se puede deshacer.
              Escribí <span className="font-bold">{family?.name}</span> para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {deleteError && <p className="text-sm font-medium text-red-500">{deleteError}</p>}
            {deleteMsg && <p className="text-sm text-muted-foreground">{deleteMsg}</p>}
            <div className="grid gap-2">
              <Label htmlFor="delete-confirm">Nombre de la familia</Label>
              <Input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={family?.name ?? ""}
                disabled={deleting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className="w-full"
              disabled={deleting || deleteConfirm.trim() !== (family?.name ?? "")}
              onClick={handleDelete}
            >
              {deleting ? (deleteMsg || "Eliminando...") : "Sí, eliminar todo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
