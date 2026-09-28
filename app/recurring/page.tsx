'use client';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import {
  deleteRecurring,
  frequencyLabel,
  materializeDueRecurring,
  nextOccurrence,
  updateRecurring,
  useRecurring,
  type RecurringRule,
} from "@/lib/firebase/recurring";
import { formatShortDate } from "@/lib/format";
import { useFx } from "@/lib/fx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecurringDialog } from "@/components/recurring/recurring-dialog";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopNav } from "@/components/desktop-nav";
import { ArrowLeft, Pause, Pencil, Play, Plus, Trash } from "@phosphor-icons/react";
import { cn } from "cn";

function RuleRow({
  rule,
  onEdit,
}: {
  rule: RecurringRule;
  onEdit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const { fmt } = useFx();
  const isIncome = rule.type === "income";
  const next = rule.active ? nextOccurrence(rule) : null;

  const toggle = async () => {
    setBusy(true);
    try {
      await updateRecurring(rule.id, { active: !rule.active });
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
      await deleteRecurring(rule.id);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <li className={cn("flex items-center gap-3 py-3", !rule.active && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {rule.description || rule.category}
          {!rule.active && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
              Pausada
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {frequencyLabel()} · {rule.category} ·{" "}
          {next ? `próximo ${formatShortDate(next)}` : rule.endDate ? "finalizada" : "—"}
        </p>
      </div>

      <p className={cn("shrink-0 text-sm font-bold", isIncome ? "text-green-600" : "text-red-600")}>
        {isIncome ? "+" : "−"}{fmt(rule.amount)}
      </p>

      <div className="flex shrink-0 items-center">
        <Button variant="ghost" size="icon-sm" onClick={toggle} disabled={busy} title={rule.active ? "Pausar" : "Reanudar"}>
          {rule.active ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} title="Editar">
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
      </div>
    </li>
  );
}

export default function RecurringPage() {
  const { user, profile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);

  const familyId = profile?.currentFamilyId ?? null;
  const { rules, loading, error } = useRecurring(familyId);

  // Por si se entra directo a esta página: aplica las vencidas (idempotente).
  const materializedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!familyId || materializedFor.current === familyId) return;
    materializedFor.current = familyId;
    materializeDueRecurring(familyId).catch((e) =>
      console.error("Error materializando recurrencias:", e)
    );
  }, [familyId]);

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
        onAdd={() => setTxDialogOpen(true)}
        displayName={profile?.displayName ?? user?.email ?? ""}
        photoURL={profile?.photoURL ?? user?.photoURL ?? null}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 pb-32 md:p-8 md:pb-8">
        <header className="flex items-center justify-between border-b pb-4">
          <div>
            <Link href="/dashboard" className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowLeft className="size-3" /> Inicio
            </Link>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Recurrentes</h1>
            <p className="text-muted-foreground">Ingresos y gastos que se repiten solos</p>
          </div>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="size-4" weight="bold" /> Nueva
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Reglas activas</CardTitle>
            <CardDescription>
              Al abrir la app se generan los movimientos vencidos. Borrar una regla conserva el historial.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
            ) : error ? (
              <p className="py-8 text-center text-sm text-red-500">{error}</p>
            ) : rules.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium">Sin recurrencias</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Creá una para el sueldo, el alquiler o los servicios.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {rules.map((r) => (
                  <RuleRow key={r.id} rule={r} onEdit={() => { setEditing(r); setDialogOpen(true); }} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <RecurringDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        familyId={familyId}
        uid={user?.uid ?? null}
        displayName={profile?.displayName ?? user?.displayName ?? null}
        editing={editing}
      />
      <AddTransactionDialog
        open={txDialogOpen}
        onOpenChange={setTxDialogOpen}
        familyId={familyId}
        uid={user?.uid ?? null}
        displayName={profile?.displayName ?? user?.displayName ?? null}
        editing={null}
      />

      <BottomNav onAdd={() => setTxDialogOpen(true)} />
    </div>
  );
}
