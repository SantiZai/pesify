"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { DateField } from "@/components/date-field";
import { Avatar } from "@/components/avatar";
import { addTripExpense, TRIP_CURRENCIES, type TripCurrency, type TripMember } from "@/lib/firebase/trips";
import { useAuth } from "@/lib/firebase/auth-context";
import { cn } from "cn";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  familyId: string;
  members: TripMember[];
};

/**
 * Cómo se cubre cada caso:
 * - Uno paga todo: pagador = él, división entre todos en partes iguales.
 * - Pagan por separado: varios gastos o montos personalizados por persona.
 * - Alguien no paga: se lo excluye (destilda).
 * - Alguien paga algo: montos personalizados solo para él.
 * - X paga por Y: pagador = X, Y incluido en la división (Y le debe a X).
 */
function ExpenseForm({
  tripId,
  familyId,
  members,
  onClose,
}: Omit<Props, "open" | "onOpenChange"> & { onClose: () => void }) {
  const { user: sessionUser } = useAuth();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<TripCurrency>("ARS");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [paidBy, setPaidBy] = useState(sessionUser?.uid ?? members[0]?.uid ?? "");
  const [payMode, setPayMode] = useState<"one" | "many">("one");
  const [paidInputs, setPaidInputs] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [included, setIncluded] = useState<string[]>(members.map((m) => m.uid));
  const [custom, setCustom] = useState<Record<string, string>>({});
  // Por quién pagan otros: uid -> uids que cubren su parte (se suma a su cuenta).
  const [covered, setCovered] = useState<Record<string, string[]>>({});
  const [coverOpen, setCoverOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = Number(String(amount).replace(",", "."));
  const paidSum = useMemo(
    () =>
      payMode === "one"
        ? parsed
        : Math.round(
            Object.entries(paidInputs).reduce(
              (acc, [, v]) => acc + (Number(String(v).replace(",", ".")) || 0), 0
            ) * 100
          ) / 100,
    [paidInputs, payMode, parsed]
  );
  const equalShare =
    parsed > 0 && included.length > 0 ? Math.round((parsed / included.length) * 100) / 100 : 0;
  const customSum = useMemo(
    () =>
      Math.round(
        Object.entries(custom)
          .filter(([uid]) => included.includes(uid))
          .reduce((acc, [, v]) => acc + (Number(String(v).replace(",", ".")) || 0), 0) * 100
      ) / 100,
    [custom, included]
  );

  const toggleMember = (uid: string) => {
    setIncluded((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
    // Sin parte base no hay nada que cubrir ni cubrir por él.
    setCovered((prev) => {
      const next: Record<string, string[]> = {};
      for (const [y, cs] of Object.entries(prev)) {
        if (y !== uid) next[y] = cs.filter((c) => c !== uid);
      }
      return next;
    });
    if (coverOpen === uid) setCoverOpen(null);
  };

  const toggleCoverer = (forUid: string, coverer: string) => {
    setCovered((prev) => {
      const cur = prev[forUid] ?? [];
      const next = cur.includes(coverer) ? cur.filter((c) => c !== coverer) : [...cur, coverer];
      if (next.length === 0) {
        const rest = { ...prev };
        delete rest[forUid];
        return rest;
      }
      return { ...prev, [forUid]: next };
    });
  };

  /** Reparte la parte de Y entre quienes pagan por él (centavos al primero). */
  const applyCoverage = (base: Record<string, number>): { shares: Record<string, number>; coveredBy: Record<string, string[]> } => {
    const shares: Record<string, number> = { ...base };
    const coveredBy: Record<string, string[]> = {};
    for (const [y, coverers] of Object.entries(covered)) {
      const valid = coverers.filter((c) => c !== y && members.some((m) => m.uid === c));
      if (valid.length === 0) continue;
      const amt = shares[y] ?? 0;
      if (amt <= 0) continue;
      delete shares[y];
      const cents = Math.round(amt * 100);
      const each = Math.floor(cents / valid.length);
      let rest = cents - each * valid.length;
      valid.forEach((c) => {
        const add = (each + (rest > 0 ? 1 : 0)) / 100;
        if (rest > 0) rest--;
        shares[c] = Math.round(((shares[c] ?? 0) + add) * 100) / 100;
      });
      coveredBy[y] = valid;
    }
    return { shares, coveredBy };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Ingresá un monto mayor a 0.");
      return;
    }
    if (included.length === 0) {
      setError("Elegí entre quiénes se divide.");
      return;
    }

    // Quiénes pusieron plata (uno o varios, incluso por otro).
    let paid: Record<string, number>;
    if (payMode === "one") {
      if (!paidBy) {
        setError("Elegí quién pagó.");
        return;
      }
      paid = { [paidBy]: parsed };
    } else {
      paid = {};
      for (const [uid, raw] of Object.entries(paidInputs)) {
        const v = Number(String(raw).replace(",", "."));
        if (Number.isFinite(v) && v > 0) paid[uid] = Math.round(v * 100) / 100;
      }
      if (Object.keys(paid).length === 0) {
        setError("Indicá cuánto puso cada uno.");
        return;
      }
      if (Math.abs(paidSum - parsed) > 0.01) {
        setError(`Lo pagado suma ${paidSum.toFixed(2)} y el gasto es ${parsed.toFixed(2)}.`);
        return;
      }
    }

    let shares: Record<string, number>;
    if (mode === "equal") {
      shares = Object.fromEntries(included.map((uid) => [uid, equalShare]));
      // Ajuste de centavos a la primera persona.
      const diff = Math.round((parsed - equalShare * included.length) * 100) / 100;
      if (diff !== 0) shares[included[0]] = Math.round((equalShare + diff) * 100) / 100;
    } else {
      shares = {};
      for (const uid of included) {
        const v = Number(String(custom[uid] ?? "").replace(",", "."));
        if (!Number.isFinite(v) || v <= 0) {
          setError("Completá un monto válido para cada incluido.");
          return;
        }
        shares[uid] = Math.round(v * 100) / 100;
      }
      if (Math.abs(customSum - parsed) > 0.01) {
        setError(`La división suma ${customSum.toFixed(2)} y el gasto es ${parsed.toFixed(2)}.`);
        return;
      }
    }

    const topPayerUid = Object.entries(paid).sort((a, b) => b[1] - a[1])[0][0];
    const topPayer = members.find((m) => m.uid === topPayerUid);
    const [y, m, d] = date.split("-").map(Number);
    const { shares: finalShares, coveredBy } = applyCoverage(shares);

    setSaving(true);
    try {
      await addTripExpense({
        tripId,
        familyId,
        paid,
        paidByName: topPayer?.displayName ?? sessionUser?.displayName ?? "Miembro",
        paidByPhoto: topPayer?.photoURL ?? sessionUser?.photoURL ?? "",
        amount: parsed,
        currency,
        description,
        date: new Date(y, m - 1, d, 12),
        shares: finalShares,
        coveredBy,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="grid gap-4">
      {error && <p className="text-sm font-medium text-red-500">{error}</p>}

      <div className="grid grid-cols-[1fr_110px] gap-3">
        <div className="grid gap-2">
          <Label htmlFor="te-amount">Monto</Label>
          <Input
            id="te-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-lg"
          />
        </div>
        <div className="grid gap-2">
          <Label>Moneda</Label>
          <Select value={currency} onValueChange={(v) => setCurrency((v as TripCurrency) ?? "ARS")}>
            <SelectTrigger className="w-full text-base font-bold">
              <span className="flex flex-1 truncate text-left">{currency}</span>
            </SelectTrigger>
            <SelectContent>
              {TRIP_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Fecha</Label>
        <DateField value={date} onChange={setDate} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="te-desc">Detalle</Label>
        <Input
          id="te-desc"
          type="text"
          maxLength={140}
          placeholder="Ej: Cena día 1"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label>¿Quién pagó?</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={payMode === "one" ? "default" : "outline"}
            onClick={() => setPayMode("one")}
          >
            Uno solo
          </Button>
          <Button
            type="button"
            variant={payMode === "many" ? "default" : "outline"}
            onClick={() => setPayMode("many")}
          >
            Entre varios
          </Button>
        </div>
        {payMode === "one" ? (
          <Select value={paidBy} onValueChange={(v) => setPaidBy(v ?? "")}>
            <SelectTrigger className="w-full">
              <span className="flex flex-1 truncate text-left">
                {members.find((m) => m.uid === paidBy)?.displayName ?? "Elegí"}
              </span>
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.uid} value={m.uid}>
                  {m.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <ul className="divide-y rounded-lg border">
            {members.map((m) => (
              <li key={m.uid} className="flex items-center gap-2 px-2 py-1.5">
                <Avatar name={m.displayName} photoURL={m.photoURL} className="size-7 text-[10px]" />
                <span className="min-w-0 flex-1 truncate text-sm">{m.displayName}</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={paidInputs[m.uid] ?? ""}
                  onChange={(e) => setPaidInputs((p) => ({ ...p, [m.uid]: e.target.value }))}
                  className="h-8 w-24"
                />
              </li>
            ))}
          </ul>
        )}
        {payMode === "many" && parsed > 0 && (
          <p className={cn("text-xs", Math.abs(paidSum - parsed) > 0.01 ? "text-red-500" : "text-green-600")}>
            Ponen {paidSum.toFixed(2)} de {parsed.toFixed(2)}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Si alguien pagó por otro, incluí a esa persona abajo: le queda debiendo a quien puso.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={mode === "equal" ? "default" : "outline"}
          onClick={() => setMode("equal")}
        >
          Partes iguales
        </Button>
        <Button
          type="button"
          variant={mode === "custom" ? "default" : "outline"}
          onClick={() => setMode("custom")}
        >
          Personalizado
        </Button>
      </div>

      <div>
        <Label>Se divide entre</Label>
        <ul className="mt-1 divide-y rounded-lg border">
          {members.map((m) => {
            const on = included.includes(m.uid);
            const coverers = covered[m.uid] ?? [];
            const others = members.filter((x) => x.uid !== m.uid);
            return (
              <li key={m.uid} className="px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleMember(m.uid)}
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border text-sm font-bold",
                      on ? "border-primary bg-primary text-primary-foreground" : "text-transparent"
                    )}
                  >
                    ✓
                  </button>
                  <Avatar name={m.displayName} photoURL={m.photoURL} className="size-7 text-[10px]" />
                  <span className={cn("min-w-0 flex-1 truncate text-sm", !on && "text-muted-foreground line-through")}>
                    {m.displayName}
                  </span>
                  {on &&
                    (mode === "equal" ? (
                      <span className="text-sm font-bold tabular-nums">{equalShare.toFixed(2)}</span>
                    ) : (
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={custom[m.uid] ?? ""}
                        onChange={(e) => setCustom((p) => ({ ...p, [m.uid]: e.target.value }))}
                        className="h-8 w-24"
                      />
                    ))}
                </div>
                {on && (
                  <div className="mt-1 ml-7">
                    <button
                      type="button"
                      onClick={() => setCoverOpen(coverOpen === m.uid ? null : m.uid)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {coverers.length === 0
                        ? "Paga lo suyo"
                        : `Pagan por él: ${coverers.map((c) => members.find((x) => x.uid === c)?.displayName ?? "").filter(Boolean).join(", ")}`}
                    </button>
                    {coverOpen === m.uid && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {others.map((o) => {
                          const checked = coverers.includes(o.uid);
                          return (
                            <button
                              key={o.uid}
                              type="button"
                              onClick={() => toggleCoverer(m.uid, o.uid)}
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-xs font-medium",
                                checked ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                              )}
                            >
                              {checked ? "✓ " : ""}{o.displayName}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {mode === "custom" && parsed > 0 && (
          <p className={cn("mt-1 text-xs", Math.abs(customSum - parsed) > 0.01 ? "text-red-500" : "text-green-600")}>
            Suma {customSum.toFixed(2)} de {parsed.toFixed(2)}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? "Guardando..." : "Guardar gasto"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TripExpenseDialog({ open, onOpenChange, tripId, familyId, members }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gasto del viaje</DialogTitle>
          <DialogDescription>Elegí el monto en su moneda, quién pagó y entre quiénes se divide.</DialogDescription>
        </DialogHeader>
        {open && (
          <ExpenseForm
            tripId={tripId}
            familyId={familyId}
            members={members}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
