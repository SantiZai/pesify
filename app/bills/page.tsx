'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { addBill, deleteBill, deleteBillAndFollowing, ensureMonthBills, setBillPaid, updateBill, useBills, type PlannedBill } from "@/lib/firebase/bills";
import { monthKeyOf, monthLabel, shiftMonth } from "@/lib/firebase/budgets";
import { mergedCategories, useCategories } from "@/lib/firebase/categories";
import { useFx } from "@/lib/fx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopNav } from "@/components/desktop-nav";
import { ArrowLeft, CaretLeft, CaretRight, Check, Pencil, Trash, X } from "@phosphor-icons/react";
import { cn } from "cn";

function BillRow({
  bill,
  onToggle,
  onDelete,
  onDeleteFollowing,
  onRename,
  busy,
}: {
  bill: PlannedBill;
  onToggle: () => void;
  onDelete: () => void;
  onDeleteFollowing: (() => void) | null;
  onRename: (patch: { description: string; amount: number; dueDay: number | null }) => Promise<void>;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(bill.description);
  const [amount, setAmount] = useState(String(bill.amount));
  const [dueDay, setDueDay] = useState(bill.dueDay ? String(bill.dueDay) : "");
  const [confirming, setConfirming] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [error, setError] = useState("");
  const { fmt } = useFx();

  const save = async () => {
    setError("");
    const v = Number(String(amount).replace(",", "."));
    const day = dueDay.trim() === "" ? null : Number(dueDay);
    if (!desc.trim() || !Number.isFinite(v) || v <= 0) {
      setError("Completá detalle y monto válido.");
      return;
    }
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) {
      setError("El vencimiento debe estar entre 1 y 31.");
      return;
    }
    try {
      await onRename({ description: desc.trim(), amount: v, dueDay: day });
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  };

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    await onDelete();
    setConfirming(false);
  };

  const removeFollowing = async () => {
    if (!onDeleteFollowing) return;
    if (!confirmingAll) {
      setConfirmingAll(true);
      return;
    }
    await onDeleteFollowing();
    setConfirmingAll(false);
  };

  return (
    <li className={cn("py-3", bill.paid && "opacity-70")}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={bill.paid}
          disabled={busy}
          onClick={onToggle}
          title={bill.paid ? "Marcar impaga (borra el movimiento)" : "Marcar paga (crea el movimiento)"}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md border text-sm font-bold",
            bill.paid ? "border-green-600 bg-green-600 text-white" : "text-transparent"
          )}
        >
          ✓
        </button>
        <div className="min-w-0 flex-1">
          {editing ? (
            <span className="flex flex-wrap items-center gap-1">
              <Input value={desc} maxLength={140} onChange={(e) => setDesc(e.target.value)} className="h-8 min-w-28 flex-1" />
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-8 w-24"
                title="Monto de la boleta de este mes"
              />
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                placeholder="Vto"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="h-8 w-16"
                title="Día de vencimiento de este mes"
              />
              <Button size="icon-sm" onClick={save} title="Guardar">
                <Check className="size-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setEditing(false)} title="Cancelar">
                <X className="size-4" />
              </Button>
            </span>
          ) : (
            <>
              <p className={cn("truncate text-sm font-medium", bill.paid && "line-through")}>
                {bill.description || bill.category}
                {bill.autoRepeat && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                    Mensual
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {bill.category}
                {bill.dueDay ? ` · vence el ${bill.dueDay}` : ""}
                {bill.paid ? " · paga" : " · pendiente"}
              </p>
            </>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <p className="shrink-0 text-sm font-bold tabular-nums">{fmt(bill.amount)}</p>
        {!editing && (
          <>
            <Button variant="ghost" size="icon-sm" onClick={() => { setDesc(bill.description); setAmount(String(bill.amount)); setDueDay(bill.dueDay ? String(bill.dueDay) : ""); setEditing(true); }} title="Editar monto o vencimiento de este mes">
              <Pencil className="size-4" />
            </Button>
            <Button
              variant={confirming ? "destructive" : "ghost"}
              size="icon-sm"
              onClick={remove}
              onBlur={() => setConfirming(false)}
              title={confirming ? "Tocá de nuevo: borra solo este mes" : "Borrar solo este mes"}
            >
              <Trash className="size-4" />
            </Button>
            {onDeleteFollowing && (
              <Button
                variant={confirmingAll ? "destructive" : "ghost"}
                size="icon-sm"
                onClick={removeFollowing}
                onBlur={() => setConfirmingAll(false)}
                title={confirmingAll ? "Tocá de nuevo: borra este mes y los siguientes" : "Borrar este mes y los siguientes"}
              >
                <Trash className="size-4" weight={confirmingAll ? "fill" : "regular"} />
                <span className="text-[10px] font-bold">+</span>
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export default function BillsPage() {
  const { user, profile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(monthKeyOf());
  const [busyId, setBusyId] = useState<string | null>(null);

  const [category, setCategory] = useState("Impuestos");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [repeat, setRepeat] = useState(true);
  const [formError, setFormError] = useState("");
  const [adding, setAdding] = useState(false);

  const familyId = profile?.currentFamilyId ?? null;
  const { fmt, currency } = useFx();
  const { bills, loading } = useBills(familyId, monthKey);
  const { categories: customs } = useCategories(familyId);
  const expenseCats = useMemo(() => ["Impuestos", ...mergedCategories(customs, "expense").filter((c) => c !== "Impuestos")], [customs]);

  // Arrastre mensual: si el mes está vacío, se rellena con los impuestos del
  // mes anterior (una sola vez por mes, no regenera lo borrado a propósito).
  const ensuredKey = useRef<string | null>(null);
  useEffect(() => {
    if (!familyId) return;
    const key = `${familyId}_${monthKey}`;
    if (ensuredKey.current === key) return;
    ensuredKey.current = key;
    ensureMonthBills(familyId, monthKey).catch((e) =>
      console.error("Error arrastrando cuentas del mes anterior:", e)
    );
  }, [familyId, monthKey]);

  const totals = useMemo(() => {
    let pending = 0;
    let paid = 0;
    for (const b of bills) {
      if (b.paid) paid += b.amount;
      else pending += b.amount;
    }
    return { pending, paid, total: pending + paid };
  }, [bills]);

  const isCurrentMonth = monthKey === monthKeyOf();

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
    const parsed = Number(String(amount).replace(",", "."));
    const day = dueDay.trim() === "" ? null : Number(dueDay);
    setAdding(true);
    try {
      await addBill({
        familyId,
        monthKey,
        category,
        description,
        amount: parsed,
        dueDay: day,
        createdBy: user.uid,
        repeat,
      });
      setDescription("");
      setAmount("");
      setDueDay("");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "No se pudo agregar.");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (bill: PlannedBill) => {
    if (!user || busyId) return;
    setBusyId(bill.id);
    try {
      await setBillPaid(bill, !bill.paid, {
        uid: user.uid,
        displayName: profile?.displayName ?? user.displayName ?? "Miembro",
        photoURL: profile?.photoURL ?? user.photoURL ?? "",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteFollowing = async (bill: PlannedBill) => {
    if (busyId) return;
    setBusyId(bill.id);
    try {
      await deleteBillAndFollowing(bill);
    } finally {
      setBusyId(null);
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
          <Link href="/dashboard" className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="size-3" /> Inicio
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Cuentas del mes</h1>
          <p className="text-muted-foreground">Impuestos mensuales: se repiten solos, editá cada boleta al llegar</p>
        </header>

        {/* Navegador de mes */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={() => setMonthKey(shiftMonth(monthKey, -1))} title="Mes anterior">
            <CaretLeft className="size-4" />
          </Button>
          <div className="text-center">
            <p className="font-bold">{monthLabel(monthKey)}</p>
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => setMonthKey(monthKeyOf())}
                className="text-xs font-medium text-primary hover:underline"
              >
                Volver al mes actual
              </button>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={() => setMonthKey(shiftMonth(monthKey, 1))} title="Mes siguiente">
            <CaretRight className="size-4" />
          </Button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pendiente</CardDescription>
              <CardTitle className="text-xl text-amber-600 tabular-nums">{fmt(totals.pending)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pagado</CardDescription>
              <CardTitle className="text-xl text-green-600 tabular-nums">{fmt(totals.paid)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-xl tabular-nums">{fmt(totals.total)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle>Cuentas</CardTitle>
            <CardDescription>
              Tildar como paga crea el egreso y lo descuenta del saldo; destildar lo borra.
              El lápiz edita monto y vencimiento solo de este mes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
            ) : bills.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sin cuentas este mes. Agregá impuestos y fijos abajo.
              </p>
            ) : (
              <ul className="divide-y">
                {bills.map((b) => (
                  <BillRow
                    key={b.id}
                    bill={b}
                    busy={busyId === b.id}
                    onToggle={() => handleToggle(b)}
                    onDelete={() => deleteBill(b.id)}
                    onDeleteFollowing={b.autoRepeat && b.templateId ? () => handleDeleteFollowing(b) : null}
                    onRename={(patch) => updateBill(b.id, patch)}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Alta */}
        <Card>
          <CardHeader>
            <CardTitle>Agregar cuenta</CardTitle>
            <CardDescription>Se registra pendiente aunque todavía no la pagues. Con “repetir” queda agregada a los meses siguientes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid gap-3">
              {formError && <p className="text-sm font-medium text-red-500">{formError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="bill-cat">Categoría</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v ?? "Impuestos")}>
                    <SelectTrigger id="bill-cat" className="w-full">
                      <SelectValue placeholder="Elegí" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCats.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bill-amount">Monto{currency !== "ARS" ? " (en ARS)" : ""}</Label>
                  <Input
                    id="bill-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="bill-desc">Detalle</Label>
                  <Input
                    id="bill-desc"
                    maxLength={140}
                    placeholder="Ej: Luz de septiembre"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bill-day">Vence día</Label>
                  <Input
                    id="bill-day"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="31"
                    placeholder="—"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" disabled={adding}>
                {adding ? "Agregando..." : "Agregar cuenta"}
              </Button>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={repeat}
                  onClick={() => setRepeat((v) => !v)}
                  className={cn(
                    "flex size-5 items-center justify-center rounded-md border text-xs font-bold",
                    repeat ? "border-green-600 bg-green-600 text-white" : "text-transparent"
                  )}
                >
                  ✓
                </button>
                Repetir cada mes (queda agregada a los siguientes meses)
              </label>
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
