import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./config";
import { addTransaction, deleteTransaction } from "./transactions";

// ── Cuentas fijas del mes (impuestos y gastos por venir) ─────────────────────
// Se registran aunque no estén pagas; al marcarlas se crea el movimiento real
// (sincroniza saldo) y al desmarcar se borra. Incluye impuestos por categoría.

export type PlannedBill = {
  id: string;
  familyId: string;
  monthKey: string;
  category: string;
  description: string;
  amount: number;
  /** Día de vencimiento dentro del mes (null = sin día). */
  dueDay: number | null;
  paid: boolean;
  paidTransactionId: string | null;
};

export type NewPlannedBill = {
  familyId: string;
  monthKey: string;
  category: string;
  description?: string;
  amount: number;
  dueDay?: number | null;
  createdBy: string;
};

export async function addBill(input: NewPlannedBill): Promise<string> {
  const cleanDesc = (input.description ?? "").trim().slice(0, 140);
  if (!input.familyId || !input.createdBy) throw new Error("Falta tu sesión.");
  if (!input.monthKey) throw new Error("Falta el mes.");
  if (!input.category.trim()) throw new Error("Elegí una categoría.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("El monto debe ser mayor a 0.");
  if (input.dueDay !== undefined && input.dueDay !== null && (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31)) {
    throw new Error("El día debe estar entre 1 y 31.");
  }

  const ref = await addDoc(collection(db, "planned_bills"), {
    familyId: input.familyId,
    monthKey: input.monthKey,
    category: input.category,
    description: cleanDesc,
    amount: Math.round(input.amount * 100) / 100,
    dueDay: input.dueDay ?? null,
    paid: false,
    paidTransactionId: null,
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBill(
  id: string,
  patch: Partial<Pick<PlannedBill, "category" | "description" | "amount" | "dueDay">>
): Promise<void> {
  if (!id) throw new Error("Falta el id.");
  const data: Record<string, unknown> = {};
  if (patch.category !== undefined) {
    if (!patch.category.trim()) throw new Error("Elegí una categoría.");
    data.category = patch.category;
  }
  if (patch.description !== undefined) data.description = patch.description.trim().slice(0, 140);
  if (patch.amount !== undefined) {
    if (!Number.isFinite(patch.amount) || patch.amount <= 0) throw new Error("El monto debe ser mayor a 0.");
    data.amount = Math.round(patch.amount * 100) / 100;
  }
  if (patch.dueDay !== undefined) data.dueDay = patch.dueDay;
  if (Object.keys(data).length === 0) return;
  await updateDoc(doc(db, "planned_bills", id), data);
}

export async function deleteBill(id: string): Promise<void> {
  if (!id) throw new Error("Falta el id.");
  const snap = await getDoc(doc(db, "planned_bills", id));
  const paidTx = snap.exists() && typeof snap.data().paidTransactionId === "string"
    ? (snap.data().paidTransactionId as string)
    : null;
  // Si estaba paga, se borra también el movimiento para no descuadrar el saldo.
  if (paidTx) {
    await deleteTransaction(paidTx).catch(() => {});
  }
  await deleteDoc(doc(db, "planned_bills", id));
}

/** Marcar paga crea el movimiento (egreso) y actualiza el saldo; desmarcar lo borra. */
export async function setBillPaid(
  bill: PlannedBill,
  paid: boolean,
  by: { uid: string; displayName: string; photoURL: string }
): Promise<void> {
  const ref = doc(db, "planned_bills", bill.id);
  if (paid && !bill.paid) {
    const [y, m] = bill.monthKey.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const day = bill.dueDay ? Math.min(bill.dueDay, lastDay) : new Date().getDate();
    const txId = await addTransaction({
      familyId: bill.familyId,
      createdBy: by.uid,
      createdByName: by.displayName || "Miembro",
      createdByPhoto: by.photoURL || "",
      amount: bill.amount,
      type: "expense",
      category: bill.category,
      description: bill.description || bill.category,
      date: new Date(y, m - 1, day, 12),
    });
    await updateDoc(ref, { paid: true, paidTransactionId: txId });
  } else if (!paid && bill.paid) {
    if (bill.paidTransactionId) {
      await deleteTransaction(bill.paidTransactionId).catch(() => {});
    }
    await updateDoc(ref, { paid: false, paidTransactionId: null });
  }
}

function parseBill(id: string, data: Record<string, unknown>): PlannedBill | null {
  if (typeof data.familyId !== "string" || typeof data.monthKey !== "string") return null;
  const amount = typeof data.amount === "number" ? data.amount : Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    id,
    familyId: data.familyId,
    monthKey: data.monthKey,
    category: typeof data.category === "string" ? data.category : "Impuestos",
    description: typeof data.description === "string" ? data.description : "",
    amount,
    dueDay: typeof data.dueDay === "number" ? data.dueDay : null,
    paid: data.paid === true,
    paidTransactionId: typeof data.paidTransactionId === "string" ? data.paidTransactionId : null,
  };
}

export function useBills(familyId: string | null | undefined, monthKey: string) {
  const [bills, setBills] = useState<PlannedBill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) return;
    const q = query(
      collection(db, "planned_bills"),
      where("familyId", "==", familyId),
      where("monthKey", "==", monthKey)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: PlannedBill[] = [];
        snap.forEach((d) => {
          const parsed = parseBill(d.id, d.data() as Record<string, unknown>);
          if (parsed) items.push(parsed);
        });
        items.sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99) || a.description.localeCompare(b.description));
        setBills(items);
        setLoading(false);
      },
      (e) => {
        console.error("Error escuchando cuentas:", e);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [familyId, monthKey]);

  if (!familyId) return { bills: [], loading: false };
  return { bills, loading };
}
