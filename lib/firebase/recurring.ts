import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { db } from "./config";
import type { TransactionType } from "./transactions";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type Frequency = "monthly";

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "monthly", label: "Mensual" },
];

export function frequencyLabel(): string {
  return "Mensual";
}

export type RecurringRule = {
  id: string;
  familyId: string;
  createdBy: string;
  createdByName: string;
  createdByPhoto: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  frequency: Frequency;
  startDate: Timestamp;
  /** null = sin fin. */
  endDate: Timestamp | null;
  active: boolean;
  /** Última ocurrencia ya generada como transacción (null = nunca). */
  lastGenerated: Timestamp | null;
};

export type NewRecurringRule = {
  familyId: string;
  createdBy: string;
  createdByName: string;
  createdByPhoto?: string;
  amount: number;
  type: TransactionType;
  category: string;
  description?: string;
  frequency: Frequency;
  startDate: Date;
  endDate?: Date | null;
};

// ── Matemática de ocurrencias ────────────────────────────────────────────────

function step(date: Date): Date {
  return addMonths(date, 1);
}

/** Primera ocurrencia >= `from` (respeta inicio y fin). null si no hay. */
export function nextOccurrence(rule: RecurringRule, from = new Date()): Date | null {
  let current = rule.startDate.toDate();
  const fromDay = startOfDay(from);
  const end = rule.endDate?.toDate() ?? null;

  let guard = 0;
  while (isBefore(current, fromDay) && guard++ < 5000) {
    current = step(current);
  }
  if (guard >= 5000) return null;
  if (end && isAfter(startOfDay(current), endOfDay(end))) return null;
  return current;
}

export type MonthPending = {
  /** Ocurrencias futuras del mes, aún no generadas: cuentan como comprometido. */
  upcoming: Date[];
  /** Ocurrencias ya vencidas sin movimiento registrado: se avisan, no se cuentan. */
  overdue: Date[];
};

/** Pendientes estrictamente dentro del mes en curso (nunca del mes siguiente).
 *  `generatedKeys` = `${recurringId}_${yyyy-MM-dd}` de transacciones existentes:
 *  lo ya ingresado (aunque se haya generado y esté registrado) no cuenta. */
export function pendingThisMonth(
  rule: RecurringRule,
  now = new Date(),
  generatedKeys?: Set<string>
): MonthPending {
  const upcoming: Date[] = [];
  const overdue: Date[] = [];
  if (!rule.active) return { upcoming, overdue };
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const todayEnd = endOfDay(now);
  for (const d of occurrencesBetween(rule, monthStart, monthEnd)) {
    // Clamp explícito al mes: aunque cambie la lógica de arriba, del mes no sale.
    if (d < monthStart || d > monthEnd) continue;
    if (generatedKeys?.has(`${rule.id}_${format(d, "yyyy-MM-dd")}`)) continue;
    if (d.getTime() <= todayEnd.getTime()) overdue.push(d);
    else upcoming.push(d);
  }
  return { upcoming, overdue };
}
export function occurrencesBetween(
  rule: RecurringRule,
  from: Date,
  to: Date,
  cap = 500
): Date[] {
  const out: Date[] = [];
  const end = rule.endDate?.toDate() ?? null;
  // Arranca en startDate y avanza hasta entrar en rango.
  let current = rule.startDate.toDate();
  const fromDay = startOfDay(from);
  const toDay = endOfDay(to);

  let guard = 0;
  while (isBefore(current, fromDay) && guard++ < 5000) {
    current = step(current);
  }
  while (!isAfter(current, toDay) && out.length < cap && guard++ < 10000) {
    if (end && isAfter(startOfDay(current), endOfDay(end))) break;
    out.push(current);
    current = step(current);
  }
  return out;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

function validateRule(input: NewRecurringRule): string | null {
  if (!input.familyId) return "Falta la familia activa.";
  if (!input.createdBy) return "Falta tu sesión.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "El monto debe ser mayor a 0.";
  if (!input.category.trim()) return "Elegí una categoría.";
  if ((input.description ?? "").length > 140) return "La descripción no puede superar 140 caracteres.";
  if (input.endDate && isBefore(input.endDate, input.startDate))
    return "La fecha de fin no puede ser anterior al inicio.";
  return null;
}

export async function addRecurring(input: NewRecurringRule): Promise<string> {
  const error = validateRule(input);
  if (error) throw new Error(error);

  const ref = await addDoc(collection(db, "recurring"), {
    familyId: input.familyId,
    createdBy: input.createdBy,
    createdByName: input.createdByName || "Miembro",
    createdByPhoto: input.createdByPhoto || "",
    amount: Math.round(input.amount * 100) / 100,
    type: input.type,
    category: input.category,
    description: (input.description ?? "").trim(),
    frequency: input.frequency,
    startDate: Timestamp.fromDate(startOfDay(input.startDate)),
    endDate: input.endDate ? Timestamp.fromDate(endOfDay(input.endDate)) : null,
    active: true,
    lastGenerated: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export type UpdateRecurringPatch = Partial<
  Pick<
    RecurringRule,
    "amount" | "type" | "category" | "description" | "frequency" | "active"
  >
> & { startDate?: Date; endDate?: Date | null };

export async function updateRecurring(id: string, patch: UpdateRecurringPatch): Promise<void> {
  if (!id) throw new Error("Falta el id.");
  if (patch.amount !== undefined && (!Number.isFinite(patch.amount) || patch.amount <= 0))
    throw new Error("El monto debe ser mayor a 0.");

  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.amount !== undefined) data.amount = Math.round(patch.amount * 100) / 100;
  if (patch.type !== undefined) data.type = patch.type;
  if (patch.category !== undefined) data.category = patch.category;
  if (patch.description !== undefined) data.description = patch.description.trim();
  if (patch.frequency !== undefined) data.frequency = patch.frequency;
  if (patch.active !== undefined) data.active = patch.active;
  if (patch.startDate !== undefined) data.startDate = Timestamp.fromDate(startOfDay(patch.startDate));
  if (patch.endDate !== undefined)
    data.endDate = patch.endDate ? Timestamp.fromDate(endOfDay(patch.endDate)) : null;

  await updateDoc(doc(db, "recurring", id), data);
}

export async function deleteRecurring(id: string): Promise<void> {
  if (!id) throw new Error("Falta el id.");
  await deleteDoc(doc(db, "recurring", id));
  // Las transacciones ya generadas se conservan como historial.
}

// ── Lectura en vivo ──────────────────────────────────────────────────────────

function parseRule(id: string, data: Record<string, unknown>): RecurringRule | null {
  if (typeof data.familyId !== "string") return null;
  const amount = typeof data.amount === "number" ? data.amount : Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!(data.startDate instanceof Timestamp)) return null;

  return {
    id,
    familyId: data.familyId,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    createdByName: typeof data.createdByName === "string" ? data.createdByName : "Miembro",
    createdByPhoto: typeof data.createdByPhoto === "string" ? data.createdByPhoto : "",
    amount,
    type: data.type === "income" ? "income" : "expense",
    category: typeof data.category === "string" ? data.category : "Otros gastos",
    description: typeof data.description === "string" ? data.description : "",
    frequency: "monthly" as Frequency,
    startDate: data.startDate,
    endDate: data.endDate instanceof Timestamp ? data.endDate : null,
    active: data.active !== false,
    lastGenerated: data.lastGenerated instanceof Timestamp ? data.lastGenerated : null,
  };
}

export function useRecurring(familyId: string | null | undefined) {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!familyId) return;
    const q = query(collection(db, "recurring"), where("familyId", "==", familyId));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: RecurringRule[] = [];
        snap.forEach((d) => {
          const parsed = parseRule(d.id, d.data() as Record<string, unknown>);
          if (parsed) items.push(parsed);
        });
        items.sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());
        setRules(items);
        setLoading(false);
      },
      (e) => {
        console.error("Error escuchando recurrencias:", e);
        setError("No se pudieron cargar las recurrencias.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [familyId]);

  if (!familyId) return { rules: [], loading: false, error: null };
  return { rules, loading, error };
}

// ── Materialización: genera transacciones vencidas ───────────────────────────
// Sin backend, el cliente genera al abrir la app las ocurrencias vencidas
// (hasta hoy) como transacciones normales. Es idempotente: antes de crear
// verifica qué fechas ya existen (por `recurringId`) y borra duplicados
// exactos. Así ni el doble-mount de StrictMode ni dos pestañas generan de más.

const MAX_GENERATED_PER_RUN = 100;

function txDateKey(data: Record<string, unknown>): string | null {
  const dt = data.date;
  const d = dt instanceof Timestamp ? dt.toDate() : null;
  if (!d) return null;
  return format(d, "yyyy-MM-dd");
}

export async function materializeDueRecurring(familyId: string): Promise<number> {
  if (!familyId) return 0;
  const today = endOfDay(new Date());

  const snap = await getDocs(
    query(
      collection(db, "recurring"),
      where("familyId", "==", familyId),
      where("active", "==", true),
      limit(50)
    )
  );

  const batch = writeBatch(db);
  let generated = 0;
  let cleaned = 0;
  const touchedRules: { ref: ReturnType<typeof doc>; last: Timestamp }[] = [];

  for (const d of snap.docs) {
    if (generated >= MAX_GENERATED_PER_RUN) break;
    const rule = parseRule(d.id, d.data() as Record<string, unknown>);
    if (!rule) continue;

    // Qué fechas ya existen generadas para esta regla (+ limpieza de duplicados).
    const existing = await getDocs(
      query(collection(db, "transactions"), where("recurringId", "==", rule.id), limit(500))
    );
    const seen = new Set<string>();
    for (const tx of existing.docs) {
      const key = txDateKey(tx.data() as Record<string, unknown>);
      if (!key) continue;
      if (seen.has(key)) {
        const txData = tx.data();
        // Duplicado exacto (misma regla, fecha y monto): se borra el extra.
        if (txData.amount === rule.amount) {
          batch.delete(tx.ref);
          cleaned++;
        }
      } else {
        seen.add(key);
      }
    }

    const cursor = rule.lastGenerated?.toDate() ?? null;
    // Pendientes: desde el día siguiente al cursor (o desde el inicio).
    const from = cursor ? addDays(startOfDay(cursor), 1) : rule.startDate.toDate();
    const due = occurrencesBetween(rule, from, today, MAX_GENERATED_PER_RUN - generated)
      .filter((date) => !seen.has(format(date, "yyyy-MM-dd")));

    for (const date of due) {
      const txRef = doc(collection(db, "transactions"));
      batch.set(txRef, {
        familyId: rule.familyId,
        createdBy: rule.createdBy,
        createdByName: rule.createdByName,
        createdByPhoto: rule.createdByPhoto,
        amount: rule.amount,
        type: rule.type,
        category: rule.category,
        description: rule.description,
        date: Timestamp.fromDate(date),
        recurringId: rule.id,
        updatedAt: serverTimestamp(),
      });
      generated++;
    }
    if (due.length > 0) {
      touchedRules.push({ ref: doc(db, "recurring", rule.id), last: Timestamp.fromDate(due[due.length - 1]) });
    }
  }

  if (generated === 0 && cleaned === 0) return 0;
  for (const t of touchedRules) {
    batch.update(t.ref, { lastGenerated: t.last, updatedAt: serverTimestamp() });
  }
  await batch.commit();
  console.info(`[pesify] recurrencias: ${generated} generadas, ${cleaned} duplicadas borradas`);
  return generated;
}
