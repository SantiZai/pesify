import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./config";
import { addTransaction, deleteTransaction } from "./transactions";
import { shiftMonth } from "./budgets";

// ── Cuentas fijas del mes (impuestos y gastos por venir) ─────────────────────
// Son MENSUALES: al agregar una se replica a los meses siguientes como
// borrador pendiente (cada mes tiene su propio documento, por eso se puede
// editar monto/vencimiento cuando llega la boleta sin tocar los otros meses).
// Al marcarlas pagas se crea el movimiento real (descuenta del saldo) y al
// desmarcar se borra, como hasta ahora.

/** Cuántos meses cubre el alta con "repetir" (actual + siguientes). */
export const BILL_REPEAT_MONTHS = 12;

export type PlannedBill = {
  id: string;
  familyId: string;
  monthKey: string;
  category: string;
  description: string;
  amount: number;
  /** Día de vencimiento dentro del mes (null = sin día). Editable por mes. */
  dueDay: number | null;
  paid: boolean;
  paidTransactionId: string | null;
  /** true = se repite cada mes (copias pendientes en los meses siguientes). */
  autoRepeat: boolean;
  /** Agrupa las copias mensuales del mismo impuesto (null = solo este mes). */
  templateId: string | null;
};

export type NewPlannedBill = {
  familyId: string;
  monthKey: string;
  category: string;
  description?: string;
  amount: number;
  dueDay?: number | null;
  createdBy: string;
  /** Por defecto true: el impuesto queda agregado a los meses siguientes. */
  repeat?: boolean;
};

function newTemplateId(): string {
  try {
    // Disponible en navegadores modernos y Node 19+.
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function monthKeysFrom(monthKey: string, count: number): string[] {
  const keys = [monthKey];
  for (let i = 1; i < count; i++) keys.push(shiftMonth(monthKey, i));
  return keys;
}

export async function addBill(input: NewPlannedBill): Promise<string> {
  const cleanDesc = (input.description ?? "").trim().slice(0, 140);
  if (!input.familyId || !input.createdBy) throw new Error("Falta tu sesión.");
  if (!input.monthKey) throw new Error("Falta el mes.");
  if (!input.category.trim()) throw new Error("Elegí una categoría.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("El monto debe ser mayor a 0.");
  if (input.dueDay !== undefined && input.dueDay !== null && (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31)) {
    throw new Error("El día debe estar entre 1 y 31.");
  }

  // Repetir = crear la copia de este mes + las de los meses siguientes.
  // Cada mes queda con su propio documento: editar monto/vencimiento de la
  // boleta nueva no toca los meses anteriores ni los ya pagados.
  const repeat = input.repeat !== false;
  const templateId = repeat ? newTemplateId() : null;
  const keys = repeat ? monthKeysFrom(input.monthKey, BILL_REPEAT_MONTHS) : [input.monthKey];
  const amount = Math.round(input.amount * 100) / 100;

  const batch = writeBatch(db);
  let firstId = "";
  for (const key of keys) {
    const ref = doc(collection(db, "planned_bills"));
    if (key === input.monthKey) firstId = ref.id;
    batch.set(ref, {
      familyId: input.familyId,
      monthKey: key,
      category: input.category,
      description: cleanDesc,
      amount,
      dueDay: input.dueDay ?? null,
      paid: false,
      paidTransactionId: null,
      autoRepeat: repeat,
      templateId,
      originMonthKey: input.monthKey,
      createdBy: input.createdBy,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();

  // El mes de alta ya tiene contenido: se marca inicializado para que el
  // arrastre automático no lo duplique ni lo rellene de más.
  await setDoc(
    doc(db, "bill_months", `${input.familyId}_${input.monthKey}`),
    { familyId: input.familyId, monthKey: input.monthKey, initialized: true, updatedAt: serverTimestamp() },
    { merge: true }
  ).catch(() => {});

  return firstId;
}

export async function updateBill(
  id: string,
  patch: Partial<Pick<PlannedBill, "category" | "description" | "amount" | "dueDay" | "autoRepeat">>
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
  // El vencimiento se edita por mes: solo toca este documento.
  if (patch.dueDay !== undefined) {
    if (patch.dueDay !== null && (!Number.isInteger(patch.dueDay) || patch.dueDay < 1 || patch.dueDay > 31)) {
      throw new Error("El día debe estar entre 1 y 31.");
    }
    data.dueDay = patch.dueDay;
  }
  if (patch.autoRepeat !== undefined) data.autoRepeat = patch.autoRepeat === true;
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
  // Solo borra ESTE mes: las copias de los meses siguientes se conservan.
  if (paidTx) {
    await deleteTransaction(paidTx).catch(() => {});
  }
  await deleteDoc(doc(db, "planned_bills", id));
}

/**
 * Borra esta cuenta y sus copias de los meses siguientes (mismo impuesto
 * mensual). Útil cuando el impuesto deja de existir. Si alguna copia estaba
 * paga, también borra su movimiento para no descuadrar el saldo.
 */
export async function deleteBillAndFollowing(bill: PlannedBill): Promise<number> {
  if (!bill.templateId) {
    await deleteBill(bill.id);
    return 1;
  }
  const snap = await getDocs(
    query(collection(db, "planned_bills"), where("familyId", "==", bill.familyId))
  );
  const batch = writeBatch(db);
  let count = 0;
  const paidTxIds: string[] = [];
  snap.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    if (data.templateId !== bill.templateId) return;
    if (typeof data.monthKey !== "string" || data.monthKey < bill.monthKey) return;
    if (typeof data.paidTransactionId === "string" && data.paidTransactionId) {
      paidTxIds.push(data.paidTransactionId);
    }
    batch.delete(d.ref);
    count++;
  });
  if (count === 0) {
    await deleteBill(bill.id);
    return 1;
  }
  await batch.commit();
  for (const txId of paidTxIds) {
    await deleteTransaction(txId).catch(() => {});
  }
  return count;
}

/**
 * Arrastre mensual (idempotente): si el mes visto está vacío, lo rellena con
 * copias pendientes de los impuestos del mes anterior más cercano. Así un
 * impuesto agregado en septiembre ya aparece en octubre y siguientes, listo
 * para editar monto/vencimiento cuando llega la boleta nueva.
 *
 * No toca los meses que ya tienen contenido ni regenera lo que el usuario
 * borró a propósito (marca `bill_months/{family}_{mes}` como inicializado).
 */
export async function ensureMonthBills(familyId: string, monthKey: string): Promise<number> {
  if (!familyId || !monthKey) return 0;
  const markerRef = doc(db, "bill_months", `${familyId}_${monthKey}`);
  try {
    const marker = await getDoc(markerRef);
    if (marker.exists()) return 0;
  } catch {
    return 0;
  }

  let snap;
  try {
    snap = await getDocs(
      query(collection(db, "planned_bills"), where("familyId", "==", familyId))
    );
  } catch {
    return 0;
  }

  let hasCurrent = false;
  let sourceKey: string | null = null;
  const sourceDocs: { ref: ReturnType<typeof doc>; data: Record<string, unknown> }[] = [];
  const byMonth = new Map<string, { ref: ReturnType<typeof doc>; data: Record<string, unknown> }[]>();
  snap.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const key = typeof data.monthKey === "string" ? data.monthKey : null;
    if (!key) return;
    if (key === monthKey) hasCurrent = true;
    const list = byMonth.get(key) ?? [];
    list.push({ ref: d.ref, data });
    byMonth.set(key, list);
  });

  const markInitialized = () =>
    setDoc(markerRef, { familyId, monthKey, initialized: true, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});

  if (hasCurrent) {
    await markInitialized();
    return 0;
  }
  for (const key of [...byMonth.keys()].sort()) {
    if (key < monthKey) sourceKey = key;
  }
  if (!sourceKey) {
    await markInitialized();
    return 0;
  }
  for (const item of byMonth.get(sourceKey) ?? []) {
    if (item.data.autoRepeat === false) continue;
    sourceDocs.push(item);
  }
  if (sourceDocs.length === 0) {
    await markInitialized();
    return 0;
  }

  const batch = writeBatch(db);
  for (const item of sourceDocs) {
    const data = item.data;
    const amount = typeof data.amount === "number" ? data.amount : Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const ref = doc(collection(db, "planned_bills"));
    batch.set(ref, {
      familyId,
      monthKey,
      category: typeof data.category === "string" ? data.category : "Impuestos",
      description: typeof data.description === "string" ? data.description : "",
      amount: Math.round(amount * 100) / 100,
      dueDay: typeof data.dueDay === "number" ? data.dueDay : null,
      paid: false,
      paidTransactionId: null,
      autoRepeat: true,
      templateId:
        typeof data.templateId === "string" && data.templateId ? data.templateId : newTemplateId(),
      originMonthKey: typeof data.originMonthKey === "string" ? data.originMonthKey : sourceKey,
      createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
      createdAt: serverTimestamp(),
    });
  }
  batch.set(markerRef, { familyId, monthKey, initialized: true, updatedAt: serverTimestamp() }, { merge: true });
  await batch.commit();
  return sourceDocs.length;
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
    // Las cuentas viejas (sin el campo) se tratan como mensuales.
    autoRepeat: data.autoRepeat !== false,
    templateId: typeof data.templateId === "string" ? data.templateId : null,
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
