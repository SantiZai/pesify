'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { auth } from "@/lib/firebase/config";
import {
  calculateTotals,
  deleteTransaction,
  useTransactions,
  type Transaction,
} from "@/lib/firebase/transactions";
import { formatMoney, moneySizeClass } from "@/lib/format";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { TransactionList } from "@/components/transactions/transaction-list";
import { Avatar } from "@/components/avatar";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopNav } from "@/components/desktop-nav";
import { CaretRight, PiggyBank, Repeat, SignOut, TrendDown, TrendUp, Wallet, WarningCircle } from "@phosphor-icons/react";
import { materializeDueRecurring } from "@/lib/firebase/recurring";
import { cn } from "cn";
import {
  budgetStatus,
  monthKeyOf,
  spendingByCategory,
  STATUS_TEXT,
  useBudgets,
} from "@/lib/firebase/budgets";
import { useSavingsGoal } from "@/lib/firebase/savings";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const familyId = profile?.currentFamilyId ?? null;
  const { transactions, loading, error } = useTransactions(familyId);
  const totals = calculateTotals(transactions);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [visibleCount, setVisibleCount] = useState(8);

  // El dashboard es del mes actual: saldo, movimientos y ahorro del mes.
  const monthBalance = totals.monthIncome - totals.monthExpense;
  const monthTransactions = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return transactions.filter((t) => {
      const d = t.date.toDate();
      return d.getMonth() === m && d.getFullYear() === y;
    });
  }, [transactions]);
  const visibleTransactions = monthTransactions.slice(0, visibleCount);
  const remaining = monthTransactions.length - visibleTransactions.length;

  // Presupuestos del mes en curso para las alertas.
  const { budgets } = useBudgets(familyId, monthKeyOf());
  const { goal: savingsGoal } = useSavingsGoal(familyId, monthKeyOf());
  const budgetAlerts = useMemo(() => {
    const spending = spendingByCategory(transactions, monthKeyOf());
    return budgets
      .map((b) => {
        const spent = spending.get(b.category) ?? 0;
        return { ...b, spent, pct: b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0, status: budgetStatus(spent, b.limit) };
      })
      .filter((b) => b.status !== "ok")
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, transactions]);

  // Al abrir la app se materializan las recurrencias vencidas como
  // transacciones (una vez por familia). Seguro offline: sincroniza después.
  const materializedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!familyId || materializedFor.current === familyId) return;
    materializedFor.current = familyId;
    materializeDueRecurring(familyId)
      .then((n) => {
        if (n > 0) setGeneratedCount(n);
      })
      .catch((e) => console.error("Error materializando recurrencias:", e));
  }, [familyId]);

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

  const handleAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (t: Transaction) => {
    setEditing(t);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <DesktopNav
        onAdd={handleAdd}
        displayName={profile?.displayName ?? user?.email ?? ""}
        photoURL={profile?.photoURL ?? user?.photoURL ?? null}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 pb-32 md:p-8 md:pb-8">
        {/* Header mobile: en desktop lo reemplaza DesktopNav */}
        <header className="flex items-center justify-between border-b pb-4 md:hidden">
          <div className="flex items-center gap-3">
            <Avatar
              name={profile?.displayName ?? user?.email ?? ""}
              photoURL={profile?.photoURL ?? user?.photoURL ?? null}
              className="size-11"
            />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Inicio</h1>
              <p className="text-muted-foreground">Bienvenido, {profile?.displayName ?? user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} disabled={loggingOut} title="Cerrar sesión">
            <SignOut className="h-5 w-5" />
          </Button>
        </header>

        {/* Tarjetas de resumen (§4.2) */}
        <div className="grid gap-4">
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium opacity-90">Disponible del mes</CardTitle>
              <Wallet className="h-4 w-4 opacity-90" />
            </CardHeader>
            <CardContent>
              <div className={`font-bold tracking-tight tabular-nums ${moneySizeClass(monthBalance, "4xl")}`}>{formatMoney(monthBalance)}</div>
              <p className="mt-1 text-xs opacity-80">
                {totals.monthCount} movimiento{totals.monthCount === 1 ? "" : "s"} este mes
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos (mes)</CardTitle>
                <TrendUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className={`font-bold text-green-600 tabular-nums ${moneySizeClass(totals.monthIncome)}`}>{formatMoney(totals.monthIncome)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gastos (mes)</CardTitle>
                <TrendDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className={`font-bold text-red-600 tabular-nums ${moneySizeClass(totals.monthExpense)}`}>{formatMoney(totals.monthExpense)}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Ahorro del mes */}
        <Link href="/savings">
          <Card className="transition-colors hover:border-primary">
            <CardContent className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <PiggyBank className="size-5 text-primary" weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">Ahorro de este mes</p>
                <p className={`font-bold tabular-nums ${moneySizeClass(monthBalance)}`}>
                  {formatMoney(monthBalance)}
                </p>
                {savingsGoal && savingsGoal > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Meta: {formatMoney(savingsGoal)} · {Math.min(100, Math.round((monthBalance / savingsGoal) * 100))}%
                  </p>
                )}
              </div>
              <CaretRight className="size-5 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        {/* Alertas de presupuestos */}
        {budgets.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Presupuestos</h2>
              <Link
                href="/budgets"
                className="text-sm font-medium text-primary hover:underline"
              >
                Ver todos
              </Link>
            </div>
            <Card>
              <CardContent>
                {budgetAlerts.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">
                    Vas bien: ninguna categoría llegó al 80% de su límite.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {budgetAlerts.map((b) => (
                      <li key={b.id} className="flex items-center gap-2 py-2.5 text-sm">
                        <WarningCircle className={cn("size-5 shrink-0", STATUS_TEXT[b.status])} weight="fill" />
                        <span className="flex-1 truncate font-medium">{b.category}</span>
                        <span className="text-muted-foreground">
                          {formatMoney(b.spent)} / {formatMoney(b.limit)}
                        </span>
                        <span className={cn("w-12 text-right font-bold", STATUS_TEXT[b.status])}>
                          {b.pct}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Historial reciente (§4.2) */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Movimientos del mes</h2>
            <div className="flex items-center gap-3">
              <Link
                href="/budgets"
                className="text-sm font-medium text-primary hover:underline"
              >
                Presupuestos
              </Link>
              <Link
                href="/recurring"
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Repeat className="size-4" /> Recurrentes
              </Link>
            </div>
          </div>
          {generatedCount > 0 && (
            <p className="mb-2 rounded-lg bg-green-600/10 px-3 py-2 text-xs font-medium text-green-700">
              Se generaron {generatedCount} movimiento{generatedCount === 1 ? "" : "s"} recurrente{generatedCount === 1 ? "" : "s"} pendiente{generatedCount === 1 ? "" : "s"}.
            </p>
          )}
          <Card>
            <CardContent>
              <TransactionList
                transactions={visibleTransactions}
                loading={loading}
                error={error}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              {remaining > 0 && (
                <Button
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => setVisibleCount((c) => c + 10)}
                >
                  Mostrar más ({remaining} restantes)
                </Button>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <AddTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        familyId={familyId}
        uid={user?.uid ?? null}
        displayName={profile?.displayName ?? user?.displayName ?? null}
        editing={editing}
      />

      <BottomNav onAdd={handleAdd} />
    </div>
  );
}
