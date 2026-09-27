import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./config";

// ── Tipos (según REQUERIMENTS.md §5) ─────────────────────────────────────────

export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  familyId: string;
  createdBy: string;
  /** Nombre denormalizado para mostrar quién registró el gasto sin leer users. */
  createdByName: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  date: Timestamp;
  updatedAt: Timestamp | null;
};

export type NewTransaction = {
  familyId: string;
  createdBy: string;
  createdByName: string;
  amount: number;
  type: TransactionType;
  category: string;
  description?: string;
  /** Por defecto: ahora. */
  date?: Timestamp | Date;
};

// ── Categorías predefinidas (§3.3) ───────────────────────────────────────────

export const INCOME_CATEGORIES = ["Sueldo", "Ventas", "Otros ingresos"] as const;

export const EXPENSE_CATEGORIES = [
  "Supermercado",
  "Transporte",
  "Ocio",
  "Servicios",
  "Salud",
  "Vivienda",
  "Educación",
  "Otros gastos",
] as const;

export const ALL_CATEGORIES: readonly string[] = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
];

function toTimestamp(value: Timestamp | Date | undefined): Timestamp {
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  return Timestamp.now();
}

function validateNewTransaction(input: NewTransaction): string | null {
  if (!input.familyId) return "Falta la familia activa.";
  if (!input.createdBy) return "Falta el usuario que registra el gasto.";
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    return "El monto debe ser mayor a 0.";
  if (input.type !== "income" && input.type !== "expense")
    return "Tipo inválido (income | expense).";
  if (!input.category.trim()) return "Elegí una categoría.";
  if ((input.description ?? "").length > 140)
    return "La descripción no puede superar 140 caracteres.";
  return null;
}

// ── Escrituras (CRUD offline: Firestore encola sin internet) ─────────────────

/** Crea un ingreso/egreso dentro de una familia. */
export async function addTransaction(input: NewTransaction): Promise<string> {
  const error = validateNewTransaction(input);
  if (error) throw new Error(error);

  // Redondeo a 2 decimales para evitar 10.999999 por floats.
  const amount = Math.round(input.amount * 100) / 100;

  const ref = await addDoc(collection(db, "transactions"), {
    familyId: input.familyId,
    createdBy: input.createdBy,
    createdByName: input.createdByName || "Miembro",
    amount,
    type: input.type,
    category: input.category,
    description: (input.description ?? "").trim(),
    date: toTimestamp(input.date),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export type UpdateTransactionPatch = Partial<
  Pick<Transaction, "amount" | "type" | "category" | "description" | "date">
>;

export async function updateTransaction(
  id: string,
  patch: UpdateTransactionPatch
): Promise<void> {
  if (!id) throw new Error("Falta el id de la transacción.");
  if (patch.amount !== undefined && (!Number.isFinite(patch.amount) || patch.amount <= 0))
    throw new Error("El monto debe ser mayor a 0.");

  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.amount !== undefined) data.amount = Math.round(patch.amount * 100) / 100;
  if (patch.type !== undefined) data.type = patch.type;
  if (patch.category !== undefined) data.category = patch.category;
  if (patch.description !== undefined) data.description = patch.description.trim();
  if (patch.date !== undefined) data.date = toTimestamp(patch.date as Timestamp | Date);

  await updateDoc(doc(db, "transactions", id), data);
}

export async function deleteTransaction(id: string): Promise<void> {
  if (!id) throw new Error("Falta el id de la transacción.");
  await deleteDoc(doc(db, "transactions", id));
}

// ── Lectura en tiempo real (§Fase 2.3) ───────────────────────────────────────

function parseTransaction(id: string, data: Record<string, unknown>): Transaction | null {
  if (typeof data.familyId !== "string") return null;
  const amount = typeof data.amount === "number" ? data.amount : Number(data.amount);
  if (!Number.isFinite(amount)) return null;

  const type = data.type === "income" ? "income" : "expense";
  const date =
    data.date instanceof Timestamp
      ? data.date
      : typeof data.date === "object" && data.date !== null && "seconds" in data.date
        ? new Timestamp(
            (data.date as { seconds: number }).seconds,
            (data.date as { nanoseconds?: number }).nanoseconds ?? 0
          )
        : Timestamp.now();

  return {
    id,
    familyId: data.familyId,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    createdByName: typeof data.createdByName === "string" ? data.createdByName : "Miembro",
    amount,
    type,
    category: typeof data.category === "string" ? data.category : "Otros gastos",
    description: typeof data.description === "string" ? data.description : "",
    date,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : null,
  };
}

/**
 * Escucha los movimientos de una familia en tiempo real (onSnapshot).
 * Funciona offline gracias al persistent local cache: sin internet devuelve
 * lo cacheado y sincroniza al reconectar.
 *
 * Se filtra por familyId y se ordena en cliente (evita índice compuesto).
 */
export function useTransactions(familyId: string | null | undefined) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!familyId) return;

    const q = query(collection(db, "transactions"), where("familyId", "==", familyId));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: Transaction[] = [];
        snap.forEach((d) => {
          const parsed = parseTransaction(d.id, d.data() as Record<string, unknown>);
          if (parsed) items.push(parsed);
        });
        // Más recientes primero.
        items.sort((a, b) => b.date.toMillis() - a.date.toMillis());
        setTransactions(items);
        setLoading(false);
      },
      (e) => {
        console.error("Error escuchando transacciones:", e);
        setError("No se pudieron cargar los movimientos.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [familyId]);

  // Sin familia activa no hay nada que escuchar: se devuelve vacío.
  if (!familyId) return { transactions: [], loading: false, error: null };

  return { transactions, loading, error };
}

// ── Cálculos (§3.4 / Fase 3.4) ───────────────────────────────────────────────

export type Totals = {
  balance: number;
  incomeTotal: number;
  expenseTotal: number;
  monthIncome: number;
  monthExpense: number;
  count: number;
};

/** Saldo = ingresos − egresos + métricas del mes en curso. */
export function calculateTotals(transactions: Transaction[], now = new Date()): Totals {
  const month = now.getMonth();
  const year = now.getFullYear();

  let incomeTotal = 0;
  let expenseTotal = 0;
  let monthIncome = 0;
  let monthExpense = 0;

  for (const t of transactions) {
    const d = t.date.toDate();
    const isThisMonth = d.getMonth() === month && d.getFullYear() === year;
    if (t.type === "income") {
      incomeTotal += t.amount;
      if (isThisMonth) monthIncome += t.amount;
    } else {
      expenseTotal += t.amount;
      if (isThisMonth) monthExpense += t.amount;
    }
  }

  return {
    balance: incomeTotal - expenseTotal,
    incomeTotal,
    expenseTotal,
    monthIncome,
    monthExpense,
    count: transactions.length,
  };
}
