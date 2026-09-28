'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { useTransactions } from "@/lib/firebase/transactions";
import { useRecurring } from "@/lib/firebase/recurring";
import { pendingThisMonth } from "@/lib/firebase/recurring";
import { setSavingsGoal, useSavingsGoal } from "@/lib/firebase/savings";
import { monthKeyOf, monthLabel, shiftMonth } from "@/lib/firebase/budgets";
import { spendingByCategory, useBudgets, STATUS_BAR } from "@/lib/firebase/budgets";
import { formatMoney, moneySizeClass } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopNav } from "@/components/desktop-nav";
import { ArrowLeft, CaretLeft, CaretRight, Check, Pencil, PiggyBank, X } from "@phosphor-icons/react";
import { endOfMonth, format } from "date-fns";
import { cn } from "cn";

export default function SavingsPage() {
  const { user, profile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(monthKeyOf());
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goalError, setGoalError] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  const familyId = profile?.currentFamilyId ?? null;
  const { transactions, loading } = useTransactions(familyId);
  const { rules } = useRecurring(familyId);
  const { goal } = useSavingsGoal(familyId, monthKey);
  const { budgets } = useBudgets(familyId, monthKey);

  const [y, m] = monthKey.split("-").map(Number);
  const isCurrentMonth = monthKey === monthKeyOf();

  const calc = useMemo(() => {
    let income = 0;
    let expense = 0;
    let fixedIncome = 0;
    let fixedExpense = 0;
    for (const t of transactions) {
      const d = t.date.toDate();
      if (d.getFullYear() !== y || d.getMonth() !== m - 1) continue;
      const fixed = !!t.recurringId;
      if (t.type === "income") {
        income += t.amount;
        if (fixed) fixedIncome += t.amount;
      } else {
        expense += t.amount;
        if (fixed) fixedExpense += t.amount;
      }
    }
    // Pendientes del mes visto: futuras cuentan; vencidas sin registrar se avisan.
    const genKeys = new Set(
      transactions
        .filter((t) => t.recurringId)
        .map((t) => `${t.recurringId}_${format(t.date.toDate(), "yyyy-MM-dd")}`)
    );
    const viewedEnd = endOfMonth(new Date(y, m - 1, 1));
    const viewedNow = isCurrentMonth ? new Date() : viewedEnd;
    let pendingIncome = 0;
    let pendingExpense = 0;
    for (const r of rules) {
      if (!r.active) continue;
      const { upcoming } = pendingThisMonth(r, viewedNow, genKeys);
      pendingIncome += r.type === "income" ? r.amount * upcoming.length : 0;
      pendingExpense += r.type === "expense" ? r.amount * upcoming.length : 0;
    }
    // Comprometido (solo fijos) = fijos generados + pendientes − egresos fijos.
    // Lo variable vive en su propia tarjeta.
    const fixedExpenseTotal = fixedExpense + pendingExpense;
    return {
      income, expense, saved: income - expense,
      fixedIncome, fixedExpense,
      varIncome: income - fixedIncome, varExpense: expense - fixedExpense,
      pendingIncome, pendingExpense, fixedExpenseTotal,
      committed: fixedIncome + pendingIncome - fixedExpenseTotal,
    };
  }, [transactions, rules, y, m, isCurrentMonth]);

  const pct = goal && goal > 0 ? Math.min(100, Math.round((calc.saved / goal) * 100)) : 0;

  // Presupuestos del mes: cuánto se lleva gastado de lo presupuestado y
  // proyección de ahorro si se respetan los límites restantes.
  const budgetCalc = useMemo(() => {
    const spending = spendingByCategory(transactions, monthKey);
    let totalLimit = 0;
    let budgetedSpent = 0;
    for (const b of budgets) {
      totalLimit += b.limit;
      budgetedSpent += spending.get(b.category) ?? 0;
    }
    const nonBudgetedSpent = Math.max(0, calc.expense - budgetedSpent);
    return {
      totalLimit,
      budgetedSpent,
      remaining: totalLimit - budgetedSpent,
      projected: calc.income - nonBudgetedSpent - totalLimit,
      hasBudgets: budgets.length > 0,
    };
  }, [budgets, transactions, monthKey, calc.income, calc.expense]);

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

  const saveGoal = async () => {
    setGoalError("");
    const v = Number(String(goalInput).replace(",", "."));
    if (goalInput.trim() !== "" && (!Number.isFinite(v) || v < 0)) {
      setGoalError("Monto inválido (vacío para quitar la meta).");
      return;
    }
    if (!familyId || !user) return;
    setSavingGoal(true);
    try {
      await setSavingsGoal(familyId, monthKey, goalInput.trim() === "" ? 0 : v, user.uid);
      setEditingGoal(false);
    } catch (e: unknown) {
      setGoalError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSavingGoal(false);
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
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Ahorro mensual</h1>
          <p className="text-muted-foreground">Se calcula solo con tus movimientos</p>
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

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <>
            {/* Ahorro + meta */}
            <Card className="bg-primary text-primary-foreground">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium opacity-90">Ahorrado este mes</CardTitle>
                <PiggyBank className="h-4 w-4 opacity-90" />
              </CardHeader>
              <CardContent>
                <div className={`font-bold tracking-tight tabular-nums ${moneySizeClass(calc.saved, "4xl")}`}>
                  {formatMoney(calc.saved)}
                </div>
                <p className="mt-1 text-xs opacity-80">
                  {formatMoney(calc.income)} ingresados − {formatMoney(calc.expense)} gastados
                </p>
                {goal && goal > 0 && (
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-primary-foreground/25">
                      <div
                        className="h-full rounded-full bg-primary-foreground transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs opacity-90">
                      {pct}% de tu meta ({formatMoney(goal)})
                      {calc.saved >= goal ? " ¡Meta cumplida!" : ` · faltan ${formatMoney(goal - calc.saved)}`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Meta */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Meta del mes</CardTitle>
                  <CardDescription>Cuánto querés ahorrar. Vacío para quitarla.</CardDescription>
                </div>
                {!editingGoal && (
                  <Button variant="ghost" size="icon-sm" onClick={() => { setGoalInput(goal ? String(goal) : ""); setEditingGoal(true); }} title="Editar meta">
                    <Pencil className="size-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {editingGoal ? (
                  <div className="grid gap-2">
                    {goalError && <p className="text-sm text-red-500">{goalError}</p>}
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={goalInput}
                        onChange={(e) => setGoalInput(e.target.value)}
                        className="h-9"
                        autoFocus
                      />
                      <Button size="icon" onClick={saveGoal} disabled={savingGoal} title="Guardar">
                        <Check className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditingGoal(false)} title="Cancelar">
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-2xl font-bold tabular-nums">
                    {goal && goal > 0 ? formatMoney(goal) : <span className="text-base font-medium text-muted-foreground">Sin meta — definí una para motivarte</span>}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Fijo vs variable */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Compromiso del mes</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Ingresos fijos del mes</span>
                    <span className="font-bold text-green-600 tabular-nums">+{formatMoney(calc.fixedIncome)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Pendientes de cobro</span>
                    <span className="font-bold text-green-600 tabular-nums">+{formatMoney(calc.pendingIncome)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Egresos fijos</span>
                    <span className="font-bold text-red-600 tabular-nums">−{formatMoney(calc.fixedExpenseTotal)}</span>
                  </p>
                  <p className="flex justify-between border-t pt-1 font-bold">
                    <span>Ahorro comprometido</span>
                    <span className="tabular-nums">{formatMoney(calc.committed)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    generados + pendientes de generarse este mes.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Variable del mes</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Ingresos variables</span>
                    <span className="font-bold text-green-600 tabular-nums">+{formatMoney(calc.varIncome)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Gastos variables</span>
                    <span className="font-bold text-red-600 tabular-nums">−{formatMoney(calc.varExpense)}</span>
                  </p>
                  <p className="flex justify-between border-t pt-1 font-bold">
                    <span>Ahorro variable</span>
                    <span className="tabular-nums">{formatMoney(calc.varIncome - calc.varExpense)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Acá impacta cada gasto que cargás: el ahorro se recalcula solo.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Presupuestos y proyección */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Presupuestos</CardTitle>
                  <CardDescription>Cómo impactan en tu ahorro</CardDescription>
                </div>
                <Link href="/budgets" className="text-sm font-medium text-primary hover:underline">
                  Editar
                </Link>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                {!budgetCalc.hasBudgets ? (
                  <p className="text-muted-foreground">
                    Sin presupuestos este mes.{" "}
                    <Link href="/budgets" className="font-medium text-primary hover:underline">
                      Definilos acá
                    </Link>{" "}
                    y la proyección aparece sola.
                  </p>
                ) : (
                  <>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Presupuestado</span>
                      <span className="font-bold tabular-nums">{formatMoney(budgetCalc.totalLimit)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Gastado de presupuestos</span>
                      <span className="font-bold tabular-nums">{formatMoney(budgetCalc.budgetedSpent)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Disponible en presupuestos</span>
                      <span className={cn("font-bold tabular-nums", budgetCalc.remaining < 0 ? "text-red-600" : "text-green-700")}>
                        {formatMoney(budgetCalc.remaining)}
                      </span>
                    </p>
                    <p className="flex justify-between border-t pt-1 font-bold">
                      <span>Ahorro proyectado</span>
                      <span className="tabular-nums">{formatMoney(budgetCalc.projected)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ingresos − gastos fuera de presupuesto − límites: lo que ahorrarías si respetás cada tope.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Barra general */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Gastado vs ingresado</span>
                  <span className="font-bold tabular-nums">
                    {calc.income > 0 ? Math.round((calc.expense / calc.income) * 100) : 0}% de los ingresos
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      calc.expense > calc.income ? STATUS_BAR.over : calc.income > 0 && calc.expense / calc.income >= 0.8 ? STATUS_BAR.warn : STATUS_BAR.ok
                    )}
                    style={{ width: `${calc.income > 0 ? Math.min(100, (calc.expense / calc.income) * 100) : 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}
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
