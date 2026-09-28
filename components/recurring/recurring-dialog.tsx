"use client";

import { useState } from "react";
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
  SelectValue,
} from "@/components/ui/select";
import {
  addRecurring,
  materializeDueRecurring,
  updateRecurring,
  type RecurringRule,
} from "@/lib/firebase/recurring";
import { DateField, toDateInputValue } from "@/components/date-field";
import { useAuth } from "@/lib/firebase/auth-context";
import { useFx } from "@/lib/fx";
import { mergedCategories, useCategories } from "@/lib/firebase/categories";
import type { TransactionType } from "@/lib/firebase/transactions";
import { cn } from "cn";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string | null;
  uid: string | null;
  displayName: string | null;
  editing?: RecurringRule | null;
};

function RecurringForm({
  familyId,
  uid,
  displayName,
  editing,
  onClose,
}: Omit<Props, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [type, setType] = useState<TransactionType>(editing?.type ?? "expense");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const frequency = "monthly" as const;
  const [startDate, setStartDate] = useState(
    editing ? toDateInputValue(editing.startDate.toDate()) : toDateInputValue(new Date())
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { user: sessionUser } = useAuth();
  const { currency } = useFx();

  const isEditing = !!editing;
  const { categories: customs } = useCategories(familyId);
  const categories = mergedCategories(customs, type);

  const handleTypeChange = (next: TransactionType) => {
    setType(next);
    setCategory("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const parsed = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Ingresá un monto mayor a 0.");
      return;
    }
    if (!category) {
      setError("Elegí una categoría.");
      return;
    }
    if (!familyId || !uid) {
      setError("Todavía se está cargando tu sesión. Esperá un momento.");
      return;
    }

    const parseDate = (v: string) => {
      const [y, m, d] = v.split("-").map(Number);
      return new Date(y, m - 1, d, 12);
    };

    setSaving(true);
    try {
      const payload = {
        amount: parsed,
        type,
        category,
        description,
        frequency,
        startDate: parseDate(startDate),
      };
      if (editing) {
        await updateRecurring(editing.id, payload);
      } else {
        await addRecurring({
          familyId,
          createdBy: uid,
          createdByName: displayName || "Miembro",
          createdByPhoto: sessionUser?.photoURL ?? "",
          ...payload,
        });
      }
      // Si el día de cobro/pago ya pasó (p. ej. creás hoy un ingreso del día
      // 20), se genera el movimiento en el acto para que sume al saldo del
      // mes en vez de esperar a la próxima apertura de la app.
      materializeDueRecurring(familyId, { uid: uid ?? undefined }).catch((e) =>
        console.error("Error materializando recurrencias:", e)
      );
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="grid gap-4">
      {error && <p className="text-sm font-medium text-red-500">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={type === "expense" ? "default" : "outline"}
          className={cn("w-full", type === "expense" && "bg-red-600 hover:bg-red-600/90")}
          onClick={() => handleTypeChange("expense")}
        >
          Egreso
        </Button>
        <Button
          type="button"
          variant={type === "income" ? "default" : "outline"}
          className={cn("w-full", type === "income" && "bg-green-600 hover:bg-green-600/90")}
          onClick={() => handleTypeChange("income")}
        >
          Ingreso
        </Button>
      </div>

      <div className="grid gap-2">
          <Label htmlFor="rec-amount">Monto de cada repetición{currency !== "ARS" ? " (en ARS)" : ""}</Label>
        <Input
          id="rec-amount"
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

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="rec-category">Categoría</Label>
          <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
            <SelectTrigger id="rec-category" className="w-full">
              <SelectValue placeholder="Elegí" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rec-frequency">Se repite</Label>
          <p id="rec-frequency" className="rounded-lg bg-muted px-2.5 py-2 text-sm font-medium">
            Cada mes, automáticamente
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rec-description">Detalle (opcional)</Label>
        <Input
          id="rec-description"
          type="text"
          maxLength={140}
          placeholder="Ej: Alquiler"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label>Día de cobro o pago</Label>
        <DateField value={startDate} onChange={setStartDate} />
        <p className="text-xs text-muted-foreground">
          Cada mes se genera ese día (si el mes no lo tiene, usa el último día).
          Si esa fecha ya pasó, el movimiento se crea ahora y suma al saldo.
        </p>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear recurrencia"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RecurringDialog({ open, onOpenChange, familyId, uid, displayName, editing }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar recurrencia" : "Nueva recurrencia"}</DialogTitle>
          <DialogDescription>
            Se aplica solo cada mes al abrir la app, incluso sin conexión.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <RecurringForm
            familyId={familyId}
            uid={uid}
            displayName={displayName}
            editing={editing}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
