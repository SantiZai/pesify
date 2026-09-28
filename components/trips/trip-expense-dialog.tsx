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
import { addTripExpense, type TripMember } from "@/lib/firebase/trips";
import { useAuth } from "@/lib/firebase/auth-context";
import { useFx } from "@/lib/fx";
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
  const { currency } = useFx();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [paidBy, setPaidBy] = useState(sessionUser?.uid ?? members[0]?.uid ?? "");
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [included, setIncluded] = useState<string[]>(members.map((m) => m.uid));
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = Number(String(amount).replace(",", "."));
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
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Ingresá un monto mayor a 0.");
      return;
    }
    if (!paidBy) {
      setError("Elegí quién pagó.");
      return;
    }
    if (included.length === 0) {
      setError("Elegí entre quiénes se divide.");
      return;
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

    const payer = members.find((m) => m.uid === paidBy);
    const [y, m, d] = date.split("-").map(Number);

    setSaving(true);
    try {
      await addTripExpense({
        tripId,
        familyId,
        paidBy,
        paidByName: payer?.displayName ?? sessionUser?.displayName ?? "Miembro",
        paidByPhoto: payer?.photoURL ?? sessionUser?.photoURL ?? "",
        amount: parsed,
        description,
        date: new Date(y, m - 1, d, 12),
        shares,
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

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="te-amount">Monto{currency !== "ARS" ? " (en ARS)" : ""}</Label>
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
          <Label>Fecha</Label>
          <DateField value={date} onChange={setDate} />
        </div>
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
        <p className="text-xs text-muted-foreground">
          Si pagó por otro, incluí a esa persona abajo: le queda debiendo.
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
            return (
              <li key={m.uid} className="flex items-center gap-2 px-2 py-1.5">
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
          <DialogDescription>Elegí quién pagó y entre quiénes se divide.</DialogDescription>
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
