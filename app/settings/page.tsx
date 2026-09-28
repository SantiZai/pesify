'use client';

import { useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import {
  addCategory,
  deleteCategory,
  renameCategory,
  useCategories,
  type CategoryType,
  type CustomCategory,
} from "@/lib/firebase/categories";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/firebase/transactions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopNav } from "@/components/desktop-nav";
import { Avatar } from "@/components/avatar";
import { seedDemoData } from "@/lib/firebase/seed";
import { APP_VERSION } from "@/lib/version";
import Link from "next/link";
import { useTheme } from "next-themes";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Check, Lock, Pencil, Plus, Trash, X } from "@phosphor-icons/react";

function CustomRow({
  category,
  familyId,
  onError,
}: {
  category: CustomCategory;
  familyId: string;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await renameCategory(category.id, name);
      setEditing(false);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "No se pudo renombrar.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      await deleteCategory(familyId, category.id, category.name);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  if (editing) {
    return (
      <li className="flex items-center gap-2 py-2">
        <Input
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          className="h-8"
          autoFocus
        />
        <Button size="icon-sm" onClick={save} disabled={busy} title="Guardar">
          <Check className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => { setEditing(false); setName(category.name); }}
          title="Cancelar"
        >
          <X className="size-4" />
        </Button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 py-2">
      <span className="flex-1 truncate text-sm">{category.name}</span>
      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} title="Renombrar">
        <Pencil className="size-4" />
      </Button>
      <Button
        variant={confirming ? "destructive" : "ghost"}
        size="icon-sm"
        onClick={remove}
        onBlur={() => setConfirming(false)}
        disabled={busy}
        title={confirming ? "Tocá de nuevo para confirmar" : "Borrar"}
      >
        <Trash className="size-4" />
      </Button>
    </li>
  );
}

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const familyId = profile?.currentFamilyId ?? null;
  const { categories } = useCategories(familyId);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CategoryType>("expense");
  const [formError, setFormError] = useState("");
  const [rowError, setRowError] = useState("");
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedConfirm, setSeedConfirm] = useState(false);
  const [seedProgress, setSeedProgress] = useState("");
  const [seedMsg, setSeedMsg] = useState("");
  const [seedWarn, setSeedWarn] = useState("");

  const handleSeed = async () => {
    if (!familyId || !user || seeding) return;
    // Primera vez: avisa si ya hay datos (generar duplica todo).
    if (!seedConfirm) {
      setSeedWarn("");
      try {
        const existing = await getDocs(
          query(collection(db, "transactions"), where("familyId", "==", familyId), limit(6))
        );
        if (existing.size >= 5) {
          setSeedWarn(`Ya hay movimientos en tu familia: generar duplica los datos. Tocá de nuevo solo si querés duplicar.`);
        }
      } catch {
        // Sin conexión no se puede verificar: se pide confirmación igual.
      }
      setSeedConfirm(true);
      return;
    }
    setSeeding(true);
    setSeedMsg("");
    try {
      const msg = await seedDemoData(
        familyId,
        user.uid,
        profile?.displayName ?? user.displayName ?? "Usuario",
        ({ done, total }) => setSeedProgress(`${done}/${total}`)
      );
      setSeedMsg(msg);
    } catch (e: unknown) {
      setSeedMsg(e instanceof Error ? e.message : "Falló la generación.");
    } finally {
      setSeeding(false);
      setSeedConfirm(false);
      setSeedProgress("");
    }
  };

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!familyId || !user) return;
    setAdding(true);
    try {
      await addCategory(familyId, newName, newType, user.uid);
      setNewName("");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setAdding(false);
    }
  };

  const groups: { type: CategoryType; title: string; base: readonly string[] }[] = [
    { type: "expense", title: "Gastos", base: EXPENSE_CATEGORIES },
    { type: "income", title: "Ingresos", base: INCOME_CATEGORIES },
  ];

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
          <h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>
          <p className="text-muted-foreground">Personalizá tu app</p>
        </header>

        {/* Mi perfil */}
        <Card>
          <CardContent className="flex items-center gap-4">
            <Avatar
              name={profile?.displayName ?? user?.email ?? ""}
              photoURL={profile?.photoURL ?? user?.photoURL ?? null}
              className="size-14 text-lg"
            />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">
                {profile?.displayName ?? user?.displayName ?? "Usuario"}
              </p>
              {!!(profile?.email ?? user?.email) && (
                <p className="truncate text-sm text-muted-foreground">
                  {profile?.email ?? user?.email}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categorías personalizadas</CardTitle>
            <CardDescription>
              Se suman a las base en los formularios. No se puede borrar una categoría con movimientos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAdd} className="grid gap-3">
              {formError && <p className="text-sm font-medium text-red-500">{formError}</p>}
              <div className="grid grid-cols-[1fr_130px] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="cat-name">Nueva categoría</Label>
                  <Input
                    id="cat-name"
                    maxLength={30}
                    placeholder="Ej: Mascotas"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cat-type">Tipo</Label>
                  <Select value={newType} onValueChange={(v) => setNewType((v ?? "expense") as CategoryType)}>
                    <SelectTrigger id="cat-type" className="w-full">
                      <span className="flex flex-1 truncate text-left">
                        {newType === "expense" ? "Gasto" : "Ingreso"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Gasto</SelectItem>
                      <SelectItem value="income">Ingreso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={adding} className="w-full sm:w-auto">
                <Plus className="size-4" weight="bold" /> {adding ? "Creando..." : "Agregar categoría"}
              </Button>
            </form>

            {rowError && <p className="text-sm font-medium text-red-500">{rowError}</p>}

            {groups.map((g) => (
              <div key={g.type}>
                <p className="mb-1 text-sm font-medium">{g.title}</p>
                <div className="mb-1 flex flex-wrap gap-1.5">
                  {g.base.map((c) => (
                    <span
                      key={c}
                      className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                      title="Categoría base (no editable)"
                    >
                      <Lock className="size-3" /> {c}
                    </span>
                  ))}
                </div>
                {familyId && (
                  <ul className="divide-y">
                    {categories
                      .filter((c) => c.type === g.type)
                      .map((c) => (
                        <CustomRow key={c.id} category={c} familyId={familyId} onError={setRowError} />
                      ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Apariencia */}
        <Card>
          <CardHeader>
            <CardTitle>Apariencia</CardTitle>
            <CardDescription>Tema de la app</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "light", label: "Claro" },
                  { value: "dark", label: "Oscuro" },
                  { value: "system", label: "Sistema" },
                ] as const
              ).map((t) => (
                <Button
                  key={t.value}
                  variant={theme === t.value ? "default" : "outline"}
                  onClick={() => setTheme(t.value)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Legales */}
        <Card>
          <CardHeader>
            <CardTitle>Legales y tus datos</CardTitle>
            <CardDescription>Condiciones, privacidad y cómo borrar tu información</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Link href="/privacy" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Política de Privacidad
              </Link>
              <Link href="/terms" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Términos y Condiciones
              </Link>
            </div>
            <p className="text-muted-foreground">
              Podés borrar tu contenido desde la app (movimientos, presupuestos, cuentas,
              recurrencias, viajes y familias). Para la eliminación completa de tu cuenta
              escribinos a{" "}
              <a
                className="font-medium text-primary hover:underline"
                href="mailto:santiagozaidandev@gmail.com?subject=Eliminar%20mis%20datos%20de%20Pesify"
              >
                santiagozaidandev@gmail.com
              </a>{" "}
              desde el email de tu cuenta.
            </p>
            <p className="text-xs text-muted-foreground">Pesify v{APP_VERSION}</p>
          </CardContent>
        </Card>

        {/* Datos de prueba */}
        <Card>
          <CardHeader>
            <CardTitle>Datos de prueba</CardTitle>
            <CardDescription>
              Genera ~70 movimientos de 4 meses, 3 recurrencias, 2 categorías y 3 presupuestos para probar todo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {seedMsg && <p className="text-sm font-medium text-green-700">{seedMsg}</p>}
            {seedWarn && seedConfirm && !seeding && (
              <p className="text-sm font-medium text-amber-600">{seedWarn}</p>
            )}
            <Button
              type="button"
              variant={seedConfirm ? "destructive" : "outline"}
              onClick={handleSeed}
              disabled={seeding}
              className="w-full sm:w-auto"
            >
              {seeding
                ? `Generando... ${seedProgress}`
                : seedConfirm
                  ? "Confirmar: generar datos"
                  : "Generar datos de prueba"}
            </Button>
            {seedConfirm && !seeding && (
              <p className="text-xs text-muted-foreground">
                Se suman a tus datos actuales. Tocá de nuevo para confirmar.
              </p>
            )}
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
