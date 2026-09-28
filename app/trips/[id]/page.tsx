'use client';

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import {
  computeBalancesByCurrency,
  deleteTripCascade,
  deleteTripExpense,
  renameTrip,
  settleAllByCurrency,
  totalsByCurrency,
  useTrip,
  useTripExpenses,
  type TripMember,
} from "@/lib/firebase/trips";
import { formatMoneyIn, formatShortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TripExpenseDialog } from "@/components/trips/trip-expense-dialog";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopNav } from "@/components/desktop-nav";
import { Avatar } from "@/components/avatar";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Pencil,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import { cn } from "cn";

function memberName(members: TripMember[], uid: string): string {
  return members.find((m) => m.uid === uid)?.displayName ?? "Miembro";
}

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, profile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [tab, setTab] = useState<"expenses" | "balances">("expenses");
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Al borrar se dan de baja las suscripciones antes de la cascada.
  const [leaving, setLeaving] = useState(false);

  const { trip, members, loading, error } = useTrip(id, !leaving);
  const { expenses, loading: loadingExpenses } = useTripExpenses(id, !leaving);

  const familyId = profile?.currentFamilyId ?? null;

  // Sin conversiones: cada moneda acumula y salda por separado.
  const balances = useMemo(
    () => computeBalancesByCurrency(expenses, members.map((m) => m.uid)),
    [expenses, members]
  );
  const settlements = useMemo(() => settleAllByCurrency(balances), [balances]);
  const totals = useMemo(() => totalsByCurrency(expenses), [expenses]);
  const totalLine = useMemo(
    () => [...totals].map(([c, t]) => formatMoneyIn(t, c)).join(" + "),
    [totals]
  );

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // Portapapeles no disponible: el código se ve igual.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRename = async () => {
    if (!nameDraft.trim()) return;
    await renameTrip(id, nameDraft);
    setEditingName(false);
  };

  const handleDeleteTrip = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleting(true);
    setLeaving(true);
    try {
      await deleteTripCascade(id);
      router.replace("/trips");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
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
        <header className="border-b pb-4">
          <Link href="/trips" className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="size-3" /> Viajes
          </Link>
          {loading ? (
            <p className="mt-1 text-muted-foreground">Cargando...</p>
          ) : error || !trip ? (
            <p className="mt-1 text-red-500">{error ?? "Viaje no encontrado."}</p>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              {editingName ? (
                <span className="flex flex-1 items-center gap-1">
                  <Input
                    value={nameDraft}
                    maxLength={60}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="h-9 text-xl font-bold"
                    autoFocus
                  />
                  <Button size="icon-sm" onClick={handleRename} title="Guardar">
                    <Check className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditingName(false)} title="Cancelar">
                    <X className="size-4" />
                  </Button>
                </span>
              ) : (
                <>
                  <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">{trip.name}</h1>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Renombrar"
                    onClick={() => { setNameDraft(trip.name); setEditingName(true); }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </>
              )}
            </div>
          )}
          {trip && (
            <p className="text-muted-foreground">
              {expenses.length === 0 ? "Sin gastos" : totalLine} ·{" "}
              {expenses.length} gasto{expenses.length === 1 ? "" : "s"} ·{" "}
              {members.length} participante{members.length === 1 ? "" : "s"}
            </p>
          )}
        </header>

        {trip && (
          <>
            {/* Código + participantes */}
            <Card>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Código de invitación</p>
                    <p className="truncate font-mono text-sm font-bold">{trip.id}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <span key={m.uid} className="flex items-center gap-1.5 rounded-full bg-secondary py-1 pr-3 pl-1 text-xs font-medium">
                      <Avatar name={m.displayName} photoURL={m.photoURL} className="size-5 text-[8px]" />
                      {m.displayName}
                      {m.uid === trip.createdBy && <span className="text-muted-foreground">· creó</span>}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant={tab === "expenses" ? "default" : "outline"} onClick={() => setTab("expenses")}>
                Gastos
              </Button>
              <Button variant={tab === "balances" ? "default" : "outline"} onClick={() => setTab("balances")}>
                Balances
              </Button>
            </div>

            {tab === "expenses" ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Gastos del viaje</CardTitle>
                    <CardDescription>Quién pagó y cómo se divide cada uno</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setDialogOpen(true)}>
                    <Plus className="size-4" weight="bold" /> Agregar
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingExpenses ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Cargando...</p>
                  ) : expenses.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Sin gastos todavía. Agregá el primero.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {expenses.map((e) => {
                        const splitCount = Object.keys(e.shares).length;
                        const payers = Object.keys(e.paid ?? {});
                        const payerNames = payers.length > 1
                          ? `${memberName(members, payers[0])} +${payers.length - 1}`
                          : e.paidByName;
                        const coveredEntries = Object.entries(e.coveredBy ?? {});
                        return (
                          <li key={e.id} className="flex items-center gap-3 py-3">
                            <Avatar name={e.paidByName} photoURL={e.paidByPhoto} className="size-9" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {e.description || "Gasto"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {payers.length > 1 ? `Pagaron ${payerNames}` : `Pagó ${payerNames}`} · entre {splitCount} · {formatShortDate(e.date.toDate())}
                              </p>
                              {coveredEntries.length > 0 && (
                                <p className="truncate text-xs text-primary">
                                  Por {coveredEntries.map(([y, cs]) =>
                                    `${memberName(members, y)} (${cs.map((c) => memberName(members, c)).join(", ")})`
                                  ).join(" · ")}
                                </p>
                              )}
                            </div>
                            <p className="shrink-0 text-sm font-bold tabular-nums">{formatMoneyIn(e.amount, e.currency)}</p>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Borrar"
                              onClick={() => deleteTripExpense(e.id)}
                            >
                              <Trash className="size-4" />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ) : balances.size === 0 ? (
              <Card>
                <CardContent>
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Sin gastos todavía. Agregá el primero.
                  </p>
                </CardContent>
              </Card>
            ) : (
              [...balances].map(([currency, b]) => {
                const cur = settlements.get(currency) ?? [];
                return (
                  <Card key={currency}>
                    <CardHeader>
                      <CardTitle>{currency}</CardTitle>
                      <CardDescription>
                        Pagado menos parte que le toca, en {currency} (sin convertir)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="divide-y">
                        {members.map((m) => {
                          const paid = b.paid.get(m.uid) ?? 0;
                          const owed = b.owed.get(m.uid) ?? 0;
                          const net = b.net.get(m.uid) ?? 0;
                          return (
                            <li key={m.uid} className="flex items-center gap-3 py-2.5">
                              <Avatar name={m.displayName} photoURL={m.photoURL} className="size-9" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{m.displayName}</p>
                                <p className="text-xs text-muted-foreground">
                                  Pagó {formatMoneyIn(paid, currency)} · le toca {formatMoneyIn(owed, currency)}
                                </p>
                              </div>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                                  net > 0.005 && "bg-green-600/10 text-green-700",
                                  net < -0.005 && "bg-red-600/10 text-red-600",
                                  Math.abs(net) <= 0.005 && "bg-muted text-muted-foreground"
                                )}
                              >
                                {net > 0.005 ? `+${formatMoneyIn(net, currency)}` : formatMoneyIn(net, currency)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {cur.length === 0 ? (
                        <p className="py-2 text-sm text-muted-foreground">
                          Todo saldado en {currency}: nadie le debe a nadie.
                        </p>
                      ) : (
                        <>
                          <p className="mt-3 mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                            Quién le debe a quién
                          </p>
                          <ul className="space-y-2">
                            {cur.map((s, i) => (
                              <li key={`${s.from}-${s.to}-${i}`} className="flex items-center gap-2 text-sm">
                                <span className="font-medium">{memberName(members, s.from)}</span>
                                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                                <span className="font-medium">{memberName(members, s.to)}</span>
                                <span className="ml-auto font-bold tabular-nums">{formatMoneyIn(s.amount, s.currency)}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}

            {/* Borrar viaje */}
            <Card className="border-destructive/50">
              <CardContent className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Borra el viaje y todos sus gastos.</p>
                <Button
                  variant={confirmingDelete ? "destructive" : "outline"}
                  size="sm"
                  disabled={deleting}
                  onClick={handleDeleteTrip}
                  onBlur={() => setConfirmingDelete(false)}
                >
                  {deleting ? "Borrando..." : confirmingDelete ? "Tocá de nuevo para confirmar" : "Borrar viaje"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {trip && (
        <TripExpenseDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          tripId={trip.id}
          familyId={trip.familyId}
          members={members}
        />
      )}
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
