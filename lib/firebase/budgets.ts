import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./config";

// ── Tipos ────────────────────────────────────────────────────────────────────
// Un presupuesto = límite de gasto de una categoría en un mes ("YYYY-MM").

export type Budget = {
  id: string;
  familyId: string;
  category: string;
  /** Mes donde se definió (puede ser anterior al visto: heredado). */
  monthKey: string;
  limit: number;
  /** true si viene heredado de un mes anterior. */
  inherited: boolean;
};

export function budgetStatus(spent: number, limit: number): "ok" | "warn" | "over" {
  if (spent > limit) return "over";
  if (limit > 0 && spent / limit >= 0.8) return "warn";
  return "ok";
}

export const STATUS_BAR = { ok: "bg-green-600", warn: "bg-amber-500", over: "bg-red-600" } as const;
export const STATUS_TEXT = { ok: "text-green-700", warn: "text-amber-600", over: "text-red-600" } as const;

export function monthKeyOf(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const name = new Date(y, m - 1, 1).toLocaleDateString("es", { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d);
}

function budgetId(familyId: string, monthKey: string, category: string): string {
  return `${familyId}_${monthKey}_${encodeURIComponent(category)}`;
}

// ── Escrituras (upsert por id determinístico) ─────────────────────────────────

/** Crea o actualiza el límite. Con 0 o menos se elimina (vuelve al heredado). */
export async function setBudget(
  familyId: string,
  monthKey: string,
  category: string,
  limitAmount: number,
  uid: string
): Promise<void> {
  if (!familyId || !uid) throw new Error("Falta tu sesión.");
  if (!category) throw new Error("Falta la categoría.");
  const ref = doc(db, "budgets", budgetId(familyId, monthKey, category));

  if (!Number.isFinite(limitAmount) || limitAmount <= 0) {
    await deleteDoc(ref).catch(() => {});
    return;
  }

  await setDoc(
    ref,
    {
      familyId,
      category,
      monthKey,
      limit: Math.round(limitAmount * 100) / 100,
      createdBy: uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// ── Lectura en vivo con herencia ──────────────────────────────────────────────
// Un límite rige desde su mes en adelante: el mes visto usa el valor explícito
// si existe, si no el último anterior. Editar un mes nunca toca los anteriores.

export function useBudgets(familyId: string | null | undefined, monthKey: string) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) return;
    const q = query(collection(db, "budgets"), where("familyId", "==", familyId));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const byCategory = new Map<string, Budget>();
        snap.forEach((d) => {
          const data = d.data();
          if (
            typeof data.category !== "string" ||
            typeof data.limit !== "number" ||
            typeof data.monthKey !== "string" ||
            data.monthKey > monthKey
          ) {
            return;
          }
          const prev = byCategory.get(data.category);
          if (!prev || data.monthKey > prev.monthKey) {
            byCategory.set(data.category, {
              id: d.id,
              familyId,
              category: data.category,
              monthKey: data.monthKey,
              limit: data.limit,
              inherited: data.monthKey !== monthKey,
            });
          }
        });
        const items = [...byCategory.values()];
        items.sort((a, b) => a.category.localeCompare(b.category));
        setBudgets(items);
        setLoading(false);
      },
      (e) => {
        console.error("Error escuchando presupuestos:", e);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [familyId, monthKey]);

  if (!familyId) return { budgets: [], loading: false };
  return { budgets, loading };
}

// ── Cálculo de gasto por categoría en un mes ─────────────────────────────────

export function spendingByCategory(
  transactions: { type: string; category: string; amount: number; date: { toDate: () => Date } }[],
  monthKey: string
): Map<string, number> {
  const [y, m] = monthKey.split("-").map(Number);
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const d = t.date.toDate();
    if (d.getFullYear() !== y || d.getMonth() !== m - 1) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return map;
}
