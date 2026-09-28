"use client";

import { useState } from "react";
import { Timestamp } from "firebase/firestore";
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
  addTransaction,
  updateTransaction,
  type Transaction,
  type TransactionType,
} from "@/lib/firebase/transactions";
import { mergedCategories, useCategories } from "@/lib/firebase/categories";
import { DateField } from "@/components/date-field";
import { useAuth } from "@/lib/firebase/auth-context";
import { cn } from "cn";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string | null;
  uid: string | null;
  displayName: string | null;
  /** Si se pasa, el dialog edita en vez de crear. */
  editing?: Transaction | null;
};

function toDateInputValue(ts: Timestamp): string {
  const d = ts.toDate();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayInputValue(): string {
  return toDateInputValue(Timestamp.now());
}

/**
 * Formulario interno: se monta de nuevo en cada apertura (`open && <Form/>`),
 * así el estado inicial sale de las props sin necesidad de useEffect.
 */
function TransactionForm({
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
  const [date, setDate] = useState(editing ? toDateInputValue(editing.date) : todayInputValue());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = !!editing;
  // Base + personalizadas de la familia para el tipo elegido.
  const { categories: customs } = useCategories(familyId);
  const categories = mergedCategories(customs, type);
  const { user: sessionUser } = useAuth();

  // Al cambiar de tipo, la categoría anterior puede no existir: se limpia.
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

    // Mediodía para evitar corrimientos por zona horaria con input date.
    const [y, m, d] = date.split("-").map(Number);
    const dateValue = date ? new Date(y, m - 1, d, 12) : new Date();

    setSaving(true);
    try {
      if (editing) {
        await updateTransaction(editing.id, {
          amount: parsed,
          type,
          category,
          description,
          date: dateValue,
        });
      } else {
        await addTransaction({
          familyId,
          createdBy: uid,
          createdByName: displayName || "Miembro",
          createdByPhoto: sessionUser?.photoURL ?? "",
          amount: parsed,
          type,
          category,
          description,
          date: dateValue,
        });
      }
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

      {/* Tipo: Ingreso / Egreso */}
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
        <Label htmlFor="tx-amount">Monto</Label>
        <Input
          id="tx-amount"
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
        <Label htmlFor="tx-category">Categoría</Label>
        <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
          <SelectTrigger id="tx-category" className="w-full">
            <SelectValue placeholder="Elegí una categoría" />
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
        <Label htmlFor="tx-description">Detalle (opcional)</Label>
        <Input
          id="tx-description"
          type="text"
          maxLength={140}
          placeholder="Ej: Compra semanal"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label>Fecha</Label>
        <DateField value={date} onChange={setDate} />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddTransactionDialog({ open, onOpenChange, familyId, uid, displayName, editing }: Props) {
  const isEditing = !!editing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar movimiento" : "Agregar movimiento"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Modificá los datos del movimiento." : "Se guarda en tu familia y funciona sin internet."}
          </DialogDescription>
        </DialogHeader>

        {open && (
          <TransactionForm
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
