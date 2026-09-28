'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { useTransactions } from "@/lib/firebase/transactions";
import { useCategories } from "@/lib/firebase/categories";
import {
  budgetStatus,
  monthKeyOf,
  monthLabel,
  setBudget,
  shiftMonth,
  spendingByCategory,
  STATUS_BAR,
  STATUS_TEXT,
  useBudgets,
  type Budget,
} from "@/lib/firebase/budgets";
import { EXPENSE_CATEGORIES } from "@/lib/firebase/transactions";
import { useFx } from "@/lib/fx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopNav } from "@/components/desktop-nav";
import { ArrowLeft, CaretLeft, CaretRight, Check, Pencil, X } from "@phosphor-icons/react";
import { cn } from "cn";

function LimitEditor({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: number | null;
  onSave: (v: number) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(initial ? String(initial) : "");
  const { currency } = useFx();
  return (
    <span className="flex items-center gap-1">
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder={currency !== "ARS" ? "ARS 0.00" : "0.00"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-28"
        autoFocus
      />
      <Button
        size="icon-sm"
        disabled={saving}
        onClick={() => onSave(Number(String(value).replace(",", ".")))}
        title="Guardar"
      >
        <Check className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onCancel} title="Cancelar">
        <X className="size-4" />
      </Button>
    </span>
  );
}

function BudgetRow({
  category,
  budget,
  spent,
  familyId,
  uid,
  monthKey,
  onDone,
}: {
  category: string;
  budget: Budget | undefined;
  spent: number;
  familyId: string;
  uid: string;
  monthKey: string;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { fmt } = useFx();

  const pct = budget && budget.limit > 0 ? Math.min(100, Math.round((spent / budget.limit) * 100)) : 0;
  const status = budget ? budgetStatus(spent, budget.limit) : "ok";

  const save = async (v: number) => {
    setError("");
    if (!Number.isFinite(v) || v < 0) {
      setError("Monto inválido.");
      return;
    }
    setSaving(true);
    try {
      await setBudget(familyId, monthKey, category, v, uid);
      setEditing(false);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            <span className="truncate">{category}</span>
            {budget?.inherited && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-bold text-muted-foreground">
                Heredado
              </span>
            )}
          </p>
          {budget ? (
            <p className="text-xs text-muted-foreground">
              {fmt(spent)} de {fmt(budget.limit)}
              <span className={cn("ml-2 font-bold", STATUS_TEXT[status])}>{pct}%</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Sin límite este mes</p>
          )}
        </div>
        {editing ? (
          <LimitEditor
            initial={budget?.limit ?? null}
            onSave={save}
            onCancel={() => { setEditing(false); setError(""); }}
            saving={saving}
          />
        ) : budget ? (
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} title="Editar límite">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Definir
          </Button>
        )}
      </div>
      {budget && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", STATUS_BAR[status])} style={{ width: `${pct}%` }} />
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </li>
  );
}

export default function BudgetsPage() {
  const { user, profile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(monthKeyOf());

  const familyId = profile?.currentFamilyId ?? null;
  const { fmt } = useFx();
  const { transactions } = useTransactions(familyId);
  const { categories: customs } = useCategories(familyId);
  const { budgets, loading } = useBudgets(familyId, monthKey);

  const expenseCategories = useMemo(() => {
    const base: string[] = [...EXPENSE_CATEGORIES];
    const extra = customs.filter((c) => c.type === "expense").map((c) => c.name);
    const seen = new Set(base.map((c) => c.toLowerCase()));
    for (const e of extra) {
      if (!seen.has(e.toLowerCase())) {
        seen.add(e.toLowerCase());
        base.push(e);
      }
    }
    return base;
  }, [customs]);

  const spending = useMemo(() => spendingByCategory(transactions, monthKey), [transactions, monthKey]);
  const budgetByCat = useMemo(() => new Map(budgets.map((b) => [b.category, b])), [budgets]);

  const totals = useMemo(() => {
    let spent = 0;
    let limit = 0;
    for (const b of budgets) {
      limit += b.limit;
      spent += spending.get(b.category) ?? 0;
    }
    return { spent, limit };
  }, [budgets, spending]);

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
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Presupuestos</h1>
          <p className="text-muted-foreground">Límites mensuales por categoría</p>
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

        <Card>
          <CardHeader>
            <CardTitle>Total del mes</CardTitle>
            <CardDescription>
                {fmt(totals.spent)} gastados de {fmt(totals.limit)} presupuestados.
              Los límites rigen desde su mes en adelante: editar este mes no cambia los anteriores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
            ) : (
              <ul className="divide-y">
                {expenseCategories.map((cat) => (
                  <BudgetRow
                    key={cat}
                    category={cat}
                    budget={budgetByCat.get(cat)}
                    spent={spending.get(cat) ?? 0}
                    familyId={familyId ?? ""}
                    uid={user?.uid ?? ""}
                    monthKey={monthKey}
                    onDone={() => {}}
                  />
                ))}
              </ul>
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
