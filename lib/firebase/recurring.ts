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
//
// Cada regla se confirma en su propio lote: si una regla vieja trae un autor
// inválido (reglas de Firestore exigen que `createdBy` sea miembro de la
// familia) y su escritura es denegada, falla solo esa regla y las demás igual
// se generan. Antes un solo lote global hacía que una regla rota bloqueara
// a todas con "Missing or insufficient permissions".

const MAX_GENERATED_PER_RUN = 100;

function txDateKey(data: Record<string, unknown>): string | null {
  const dt = data.date;
  const d = dt instanceof Timestamp ? dt.toDate() : null;
  if (!d) return null;
  return format(d, "yyyy-MM-dd");
}

/** Genera lo vencido de UNA regla. Lotes separados por tipo de escritura:
 *  1) movimientos (crear/borrar en `transactions`),
 *  2) cursor `lastGenerated` en la regla.
 *  Si (2) es denegado por las reglas publicadas, los movimientos igual quedan
 *  generados: la idempotencia por (`recurringId` + fecha) evita duplicados en
 *  la próxima corrida aunque el cursor no haya avanzado. Devuelve
 *  {generadas, borradas}. Lanza con mensaje prefijado según el paso que falló
 *  (READ_EXISTING | COMMIT_TX | COMMIT_CURSOR) para diagnosticar permisos. */
async function materializeRule(
  rule: RecurringRule,
  authorUid: string,
  today: Date,
  budget: number
): Promise<{ generated: number; cleaned: number }> {
  // Qué fechas ya existen generadas para esta regla (+ limpieza de duplicados).
  // El filtro por `familyId` es obligatorio además del de `recurringId`: las
  // reglas autorizan la lectura según `resource.data.familyId` y Firestore
  // deniega la query completa si los filtros no acotan ese campo (las reglas
  // no son filtros). Requiere índice compuesto (familyId + recurringId),
  // ver firestore.indexes.json.
  let existing;
  try {
    existing = await getDocs(
      query(
        collection(db, "transactions"),
        where("familyId", "==", rule.familyId),
        where("recurringId", "==", rule.id),
        limit(500)
      )
    );
  } catch (e) {
    throw new Error(
      `READ_EXISTING: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  const seen = new Set<string>();
  const dupRefs: ReturnType<typeof doc>[] = [];
  for (const tx of existing.docs) {
    const key = txDateKey(tx.data() as Record<string, unknown>);
    if (!key) continue;
    if (seen.has(key)) {
      const txData = tx.data();
      // Duplicado exacto (misma regla, fecha y monto): se borra el extra.
      if (txData.amount === rule.amount) dupRefs.push(tx.ref);
    } else {
      seen.add(key);
    }
  }

  const cursor = rule.lastGenerated?.toDate() ?? null;
  // Pendientes: desde el día siguiente al cursor (o desde el inicio).
  const from = cursor ? addDays(startOfDay(cursor), 1) : rule.startDate.toDate();
  const due = occurrencesBetween(rule, from, today, budget)
    .filter((date) => !seen.has(format(date, "yyyy-MM-dd")));

  if (due.length === 0 && dupRefs.length === 0) return { generated: 0, cleaned: 0 };

  const txBatch = writeBatch(db);
  for (const date of due) {
    const txRef = doc(collection(db, "transactions"));
    txBatch.set(txRef, {
      familyId: rule.familyId,
      createdBy: authorUid,
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
  }
  for (const ref of dupRefs) txBatch.delete(ref);
  try {
    await txBatch.commit();
  } catch (e) {
    throw new Error(
      `COMMIT_TX: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  // El cursor es optimización (no reescanear): si las reglas publicadas lo
  // deniegan, se avisa y se sigue — los movimientos ya quedaron creados.
  if (due.length > 0) {
    try {
      await updateDoc(doc(db, "recurring", rule.id), {
        lastGenerated: Timestamp.fromDate(due[due.length - 1]),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn(
        `[pesify] movimientos de "${rule.description || rule.category}" generados, pero no se pudo guardar el cursor (revisá las reglas de /recurring en la consola):`,
        e instanceof Error ? e.message : e
      );
    }
  }
  return { generated: due.length, cleaned: dupRefs.length };
}

export async function materializeDueRecurring(
  familyId: string,
  opts?: { uid?: string }
): Promise<number> {
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

  let generated = 0;
  let cleaned = 0;

  for (const d of snap.docs) {
    if (generated >= MAX_GENERATED_PER_RUN) break;
    const rule = parseRule(d.id, d.data() as Record<string, unknown>);
    if (!rule) continue;

    // El autor original puede estar vacío (reglas viejas) o haber salido de
    // la familia: en esos casos se firma con quien abrió la app (miembro).
    const authors = [rule.createdBy, opts?.uid ?? ""].filter(
      (a, i, arr) => a !== "" && arr.indexOf(a) === i
    );
    if (authors.length === 0) {
      console.warn(`[pesify] recurrencia sin autor válido, se omite: ${rule.description || rule.category}`);
      continue;
    }

    let ok = false;
    for (const author of authors) {
      try {
        const r = await materializeRule(rule, author, today, MAX_GENERATED_PER_RUN - generated);
        generated += r.generated;
        cleaned += r.cleaned;
        ok = true;
        break;
      } catch (e) {
        console.warn(
          `[pesify] no se pudo materializar "${rule.description || rule.category}" con autor ${author}:`,
          e instanceof Error ? e.message : e
        );
      }
    }
    if (!ok) {
      console.warn(`[pesify] se omite la regla ${d.id}: sin permiso para generar sus movimientos.`);
    }
  }

  if (generated > 0 || cleaned > 0) {
    console.info(`[pesify] recurrencias: ${generated} generadas, ${cleaned} duplicadas borradas`);
  }
  return generated;
}
