"use client";

import { useState } from "react";
import {
  Book,
  Briefcase,
  Bus,
  DotsThreeCircle,
  GameController,
  Heart,
  House,
  Lightbulb,
  Pencil,
  Receipt,
  Repeat,
  ShoppingCart,
  Storefront,
  Trash,
  type Icon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import type { Transaction } from "@/lib/firebase/transactions";
import { formatShortDate } from "@/lib/format";
import { useFx } from "@/lib/fx";
import { cn } from "cn";

const CATEGORY_ICONS: Record<string, Icon> = {
  Supermercado: ShoppingCart,
  Transporte: Bus,
  Ocio: GameController,
  Servicios: Lightbulb,
  Impuestos: Receipt,
  Salud: Heart,
  Vivienda: House,
  Educación: Book,
  Sueldo: Briefcase,
  Ventas: Storefront,
};

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Cmp = CATEGORY_ICONS[category] ?? DotsThreeCircle;
  return <Cmp className={className} weight="duotone" />;
}

type Props = {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => Promise<void>;
};

function Row({
  t,
  onEdit,
  onDelete,
}: {
  t: Transaction;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isIncome = t.type === "income";
  const { fmt } = useFx();

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <CategoryIcon category={t.category} className="size-5 text-foreground" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          <span className="truncate">{t.description || t.category}</span>
          {t.recurringId && (
            <span title="Generado por una recurrencia" className="flex shrink-0">
              <Repeat className="size-3.5 text-primary" weight="bold" />
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {t.category} · {formatShortDate(t.date.toDate())}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p className={cn("text-sm font-bold", isIncome ? "text-green-600" : "text-red-600")}>
            {isIncome ? "+" : "−"}{fmt(t.amount)}
          </p>
          <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            <Avatar name={t.createdByName} photoURL={t.createdByPhoto} className="size-4 text-[8px]" />
            <span className="max-w-20 truncate">{t.createdByName}</span>
          </p>
        </div>

        <Button variant="ghost" size="icon-sm" onClick={onEdit} title="Editar">
          <Pencil className="size-4" />
        </Button>
        <Button
          variant={confirming ? "destructive" : "ghost"}
          size="icon-sm"
          onClick={handleDelete}
          onBlur={() => setConfirming(false)}
          disabled={deleting}
          title={confirming ? "Tocá de nuevo para confirmar" : "Borrar"}
        >
          <Trash className="size-4" />
        </Button>
      </div>
    </li>
  );
}

export function TransactionList({ transactions, loading, error, onEdit, onDelete }: Props) {
  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Cargando movimientos...</p>;
  }
  if (error) {
    return <p className="py-8 text-center text-sm text-red-500">{error}</p>;
  }
  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm font-medium">Sin movimientos todavía</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tocá + para registrar tu primer ingreso o gasto.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {transactions.map((t) => (
        <Row key={t.id} t={t} onEdit={() => onEdit(t)} onDelete={() => onDelete(t.id)} />
      ))}
    </ul>
  );
}
