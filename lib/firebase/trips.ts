import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import { endOfDay, startOfDay } from "date-fns";
import { db } from "./config";

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Monedas de la app: solo pesos, dólares, reales y euros. Lista cerrada para
 *  evitar "USD" vs "usd" y que un mismo saldo se parta en dos. Sin
 *  conversión: cada moneda salda por su lado. */
export const TRIP_CURRENCIES = ["ARS", "USD", "BRL", "EUR"] as const;

export type TripCurrency = (typeof TRIP_CURRENCIES)[number];

export function normalizeTripCurrency(value: unknown): TripCurrency {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return (TRIP_CURRENCIES as readonly string[]).includes(code) ? (code as TripCurrency) : "ARS";
}

export type Trip = {
  id: string;
  familyId: string;
  name: string;
  description: string;
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  /** UIDs participantes (el código de invitación es el id). */
  participants: string[];
  createdBy: string;
};

export type TripMember = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
};

/** Gasto de viaje: quiénes pusieron plata + cuánto debe cada uno (sumas = monto).
 *  Así se contempla todo: uno paga todo, varios pagan (por separado o por
 *  otro), alguien no paga (otro cubre su parte) o paga solo algo. */
export type TripExpense = {
  id: string;
  tripId: string;
  familyId: string;
  /** Mayor aportante (display y compatibilidad). */
  paidBy: string;
  paidByName: string;
  paidByPhoto: string;
  /** Cuánto puso cada UID. */
  paid: Record<string, number>;
  amount: number;
  /** Moneda del gasto (gastos viejos = ARS). Cada moneda salda por separado. */
  currency: TripCurrency;
  description: string;
  category: string;
  date: Timestamp;
  shares: Record<string, number>;
  /** Por quién pagan otros: uid -> uids que cubren su parte (se suma a su cuenta). */
  coveredBy: Record<string, string[]>;
};

export type NewTripExpense = {
  tripId: string;
  familyId: string;
  /** Cuánto puso cada UID (debe sumar el monto). */
  paid: Record<string, number>;
  paidByName: string;
  paidByPhoto?: string;
  amount: number;
  description?: string;
  category?: string;
  /** Por defecto ARS. */
  currency?: string;
  date?: Timestamp | Date;
  shares: Record<string, number>;
  coveredBy?: Record<string, string[]>;
};

// ── Viajes: CRUD ─────────────────────────────────────────────────────────────

export async function createTrip(
  familyId: string,
  input: { name: string; description?: string; startDate?: Date | null; endDate?: Date | null },
  uid: string
): Promise<string> {
  const name = input.name.trim();
  if (!familyId || !uid) throw new Error("Falta tu sesión.");
  if (!name) throw new Error("Poné un nombre al viaje.");
  if (name.length > 60) throw new Error("El nombre no puede superar 60 caracteres.");

  const famSnap = await getDoc(doc(db, "families", familyId));
  const members: unknown[] = famSnap.exists() && Array.isArray(famSnap.data().members) ? famSnap.data().members : [];
  if (!members.includes(uid)) throw new Error("Solo un miembro de la familia puede crear el viaje.");

  const ref = await addDoc(collection(db, "trips"), {
    familyId,
    name,
    description: (input.description ?? "").trim().slice(0, 140),
    startDate: input.startDate ? Timestamp.fromDate(startOfDay(input.startDate)) : null,
    endDate: input.endDate ? Timestamp.fromDate(endOfDay(input.endDate)) : null,
    participants: [uid],
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Unirse con el código (= id del viaje). Vale para miembros o invitados. */
export async function joinTrip(code: string, uid: string): Promise<string> {
  const tripId = code.trim();
  if (!tripId) throw new Error("Pegá el código del viaje.");
  if (!uid) throw new Error("Falta tu sesión.");
  const snap = await getDoc(doc(db, "trips", tripId));
  if (!snap.exists()) throw new Error("Ese código no pertenece a ningún viaje.");
  await updateDoc(doc(db, "trips", tripId), { participants: arrayUnion(uid) });
  return tripId;
}

export async function renameTrip(tripId: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!tripId) throw new Error("Falta el viaje.");
  if (!clean) throw new Error("Poné un nombre.");
  if (clean.length > 60) throw new Error("El nombre no puede superar 60 caracteres.");
  await updateDoc(doc(db, "trips", tripId), { name: clean });
}

export async function deleteTripCascade(tripId: string): Promise<void> {
  if (!tripId) throw new Error("Falta el viaje.");
  for (;;) {
    const snap = await getDocs(
      query(collection(db, "trip_expenses"), where("tripId", "==", tripId), limit(400))
    );
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < 400) break;
  }
  await deleteDoc(doc(db, "trips", tripId));
}

// ── Viajes: lectura ──────────────────────────────────────────────────────────

function parseTrip(id: string, data: Record<string, unknown>): Trip | null {
  if (typeof data.familyId !== "string") return null;
  return {
    id,
    familyId: data.familyId,
    name: typeof data.name === "string" ? data.name : "Viaje",
    description: typeof data.description === "string" ? data.description : "",
    startDate: data.startDate instanceof Timestamp ? data.startDate : null,
    endDate: data.endDate instanceof Timestamp ? data.endDate : null,
    participants: Array.isArray(data.participants)
      ? data.participants.filter((m): m is string => typeof m === "string")
      : [],
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
  };
}

export function useTrips(familyId: string | null | undefined, uid: string | null | undefined = null) {
  const [byFamily, setByFamily] = useState<Trip[]>([]);
  const [invited, setInvited] = useState<Trip[]>([]);
  const [loadingFamily, setLoadingFamily] = useState(true);
  const [loadingInvited, setLoadingInvited] = useState(true);

  useEffect(() => {
    if (!familyId) return;
    const q = query(collection(db, "trips"), where("familyId", "==", familyId));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: Trip[] = [];
        snap.forEach((d) => {
          const parsed = parseTrip(d.id, d.data() as Record<string, unknown>);
          if (parsed) items.push(parsed);
        });
        setByFamily(items);
        setLoadingFamily(false);
      },
      (e) => {
        console.error("Error escuchando viajes:", e);
        setLoadingFamily(false);
      }
    );
    return () => unsubscribe();
  }, [familyId]);

  useEffect(() => {
    if (!uid) return;
    // Viajes donde participo aunque no sean de mi familia activa.
    const q = query(collection(db, "trips"), where("participants", "array-contains", uid));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: Trip[] = [];
        snap.forEach((d) => {
          const parsed = parseTrip(d.id, d.data() as Record<string, unknown>);
          if (parsed) items.push(parsed);
        });
        setInvited(items);
        setLoadingInvited(false);
      },
      (e) => {
        console.error("Error escuchando invitaciones:", e);
        setLoadingInvited(false);
      }
    );
    return () => unsubscribe();
  }, [uid]);

  if (!familyId) return { trips: [], loading: false };
  const seen = new Map<string, Trip>();
  for (const t of [...byFamily, ...invited]) {
    if (!seen.has(t.id)) seen.set(t.id, t);
  }
  const trips = [...seen.values()].sort((a, b) => b.id.localeCompare(a.id));
  return { trips, loading: loadingFamily || (uid ? loadingInvited : false) };
}

export function useTrip(tripId: string | null | undefined, enabled = true) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId || !enabled) return;
    const unsubscribe = onSnapshot(
      doc(db, "trips", tripId),
      (snap) => {
        if (!snap.exists()) {
          setTrip(null);
          setMembers([]);
          setError("El viaje ya no existe.");
          setLoading(false);
          return;
        }
        const parsed = parseTrip(snap.id, snap.data() as Record<string, unknown>);
        setTrip(parsed);
        setError(null);
        setLoading(false);
        if (parsed) {
          Promise.all(parsed.participants.map((uid) => getDoc(doc(db, "users", uid)))).then(
            (snaps) => {
              setMembers(
                snaps
                  .map((s, i) => {
                    const data = s.exists() ? s.data() : null;
                    return {
                      uid: parsed.participants[i],
                      displayName:
                        data && typeof data.displayName === "string" ? data.displayName : "Miembro",
                      email: data && typeof data.email === "string" ? data.email : "",
                      photoURL: data && typeof data.photoURL === "string" ? data.photoURL : "",
                    };
                  })
                  .sort((a, b) => a.displayName.localeCompare(b.displayName))
              );
            }
          );
        }
      },
      (e) => {
        console.error("Error escuchando viaje:", e);
        setError("No se pudo cargar el viaje.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [tripId, enabled]);

  if (!tripId || !enabled) return { trip: null, members: [], loading: false, error: null };
  return { trip, members, loading, error };
}

// ── Gastos del viaje ─────────────────────────────────────────────────────────

function toTimestamp(value: Timestamp | Date | undefined): Timestamp {
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  return Timestamp.now();
}

export async function addTripExpense(input: NewTripExpense): Promise<string> {
  if (!input.tripId || !input.familyId) throw new Error("Falta el viaje.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("El monto debe ser mayor a 0.");

  const paidEntries = Object.entries(input.paid).filter(([, v]) => Number.isFinite(v) && v > 0);
  if (paidEntries.length === 0) throw new Error("Elegí quién pagó.");
  const paidSum = paidEntries.reduce((acc, [, v]) => acc + v, 0);
  if (Math.abs(paidSum - input.amount) > 0.01) {
    throw new Error(`Lo pagado suma ${paidSum.toFixed(2)} y el gasto es ${input.amount.toFixed(2)}.`);
  }
  // Mayor aportante como referencia visible.
  const paidBy = paidEntries.sort((a, b) => b[1] - a[1])[0][0];

  const entries = Object.entries(input.shares).filter(([, v]) => Number.isFinite(v) && v > 0);
  if (entries.length === 0) throw new Error("Elegí entre quiénes se divide.");
  const sum = entries.reduce((acc, [, v]) => acc + v, 0);
  if (Math.abs(sum - input.amount) > 0.01) {
    throw new Error(`La división suma ${sum.toFixed(2)} y el gasto es ${input.amount.toFixed(2)}.`);
  }

  const ref = await addDoc(collection(db, "trip_expenses"), {
    tripId: input.tripId,
    familyId: input.familyId,
    paidBy,
    paidByName: input.paidByName || "Miembro",
    paidByPhoto: input.paidByPhoto || "",
    paid: Object.fromEntries(paidEntries.map(([k, v]) => [k, Math.round(v * 100) / 100])),
    amount: Math.round(input.amount * 100) / 100,
    currency: normalizeTripCurrency(input.currency),
    description: (input.description ?? "").trim().slice(0, 140),
    category: (input.category ?? "").trim().slice(0, 30),
    date: toTimestamp(input.date),
    shares: Object.fromEntries(entries.map(([k, v]) => [k, Math.round(v * 100) / 100])),
    coveredBy: input.coveredBy ?? {},
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteTripExpense(id: string): Promise<void> {
  if (!id) throw new Error("Falta el id.");
  await deleteDoc(doc(db, "trip_expenses", id));
}

function parseExpense(id: string, data: Record<string, unknown>): TripExpense | null {
  if (typeof data.tripId !== "string") return null;
  const amount = typeof data.amount === "number" ? data.amount : Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const shares: Record<string, number> = {};
  if (data.shares && typeof data.shares === "object") {
    for (const [k, v] of Object.entries(data.shares as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) shares[k] = v;
    }
  }
  // Compatibilidad: gastos viejos solo tienen paidBy (puso todo él).
  const paid: Record<string, number> = {};
  if (data.paid && typeof data.paid === "object") {
    for (const [k, v] of Object.entries(data.paid as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) paid[k] = v;
    }
  }
  const paidBy = typeof data.paidBy === "string" ? data.paidBy : "";
  if (Object.keys(paid).length === 0 && paidBy) paid[paidBy] = amount;
  const coveredBy: Record<string, string[]> = {};
  if (data.coveredBy && typeof data.coveredBy === "object") {
    for (const [k, v] of Object.entries(data.coveredBy as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        const uids = v.filter((x): x is string => typeof x === "string");
        if (uids.length > 0) coveredBy[k] = uids;
      }
    }
  }
  return {
    id,
    tripId: data.tripId,
    familyId: typeof data.familyId === "string" ? data.familyId : "",
    paidBy,
    paidByName: typeof data.paidByName === "string" ? data.paidByName : "Miembro",
    paidByPhoto: typeof data.paidByPhoto === "string" ? data.paidByPhoto : "",
    paid,
    amount,
    currency: normalizeTripCurrency(data.currency),
    description: typeof data.description === "string" ? data.description : "",
    category: typeof data.category === "string" ? data.category : "",
    date: data.date instanceof Timestamp ? data.date : Timestamp.now(),
    shares,
    coveredBy,
  };
}

export function useTripExpenses(tripId: string | null | undefined, enabled = true) {
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId || !enabled) return;
    const q = query(collection(db, "trip_expenses"), where("tripId", "==", tripId));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: TripExpense[] = [];
        snap.forEach((d) => {
          const parsed = parseExpense(d.id, d.data() as Record<string, unknown>);
          if (parsed) items.push(parsed);
        });
        items.sort((a, b) => b.date.toMillis() - a.date.toMillis());
        setExpenses(items);
        setLoading(false);
      },
      (e) => {
        console.error("Error escuchando gastos del viaje:", e);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [tripId, enabled]);

  if (!tripId || !enabled) return { expenses: [], loading: false };
  return { expenses, loading };
}

// ── Balances por moneda: quién pagó, quién debe y quién le debe a quién ──────
// Sin conversiones: cada moneda se acumula y salda por separado (uno puede
// deber 20 USD y 15 BRL a otro a la vez).

export type CurrencyBalance = {
  paid: Map<string, number>;
  owed: Map<string, number>;
  net: Map<string, number>;
};

/** Un Map por moneda (orden de aparición), solo con monedas que tienen gastos. */
export function computeBalancesByCurrency(
  expenses: TripExpense[],
  participantUids: string[]
): Map<TripCurrency, CurrencyBalance> {
  const byCurrency = new Map<TripCurrency, CurrencyBalance>();
  const bucket = (currency: TripCurrency): CurrencyBalance => {
    let b = byCurrency.get(currency);
    if (!b) {
      b = { paid: new Map(), owed: new Map(), net: new Map() };
      for (const uid of participantUids) {
        b.paid.set(uid, 0);
        b.owed.set(uid, 0);
      }
      byCurrency.set(currency, b);
    }
    return b;
  };
  for (const e of expenses) {
    const b = bucket(e.currency);
    for (const [uid, put] of Object.entries(e.paid)) {
      b.paid.set(uid, (b.paid.get(uid) ?? 0) + put);
    }
    for (const [uid, share] of Object.entries(e.shares)) {
      b.owed.set(uid, (b.owed.get(uid) ?? 0) + share);
    }
  }
  for (const b of byCurrency.values()) {
    for (const uid of new Set([...b.paid.keys(), ...b.owed.keys()])) {
      b.net.set(uid, Math.round(((b.paid.get(uid) ?? 0) - (b.owed.get(uid) ?? 0)) * 100) / 100);
    }
  }
  return byCurrency;
}

/** Total gastado por moneda (orden de aparición), para el encabezado. */
export function totalsByCurrency(expenses: TripExpense[]): Map<TripCurrency, number> {
  const totals = new Map<TripCurrency, number>();
  for (const e of expenses) {
    totals.set(e.currency, Math.round(((totals.get(e.currency) ?? 0) + e.amount) * 100) / 100);
  }
  return totals;
}

export type Settlement = { from: string; to: string; amount: number; currency: TripCurrency };

/** Deudas simplificadas (avaricioso) dentro de UNA moneda: pares deudor → acreedor. */
export function settleDebts(net: Map<string, number>, currency: TripCurrency): Settlement[] {
  const creditors = [...net.entries()]
    .filter(([, v]) => v > 0.005)
    .map(([uid, amount]) => ({ uid, amount }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = [...net.entries()]
    .filter(([, v]) => v < -0.005)
    .map(([uid, amount]) => ({ uid, amount: -amount }))
    .sort((a, b) => b.amount - a.amount);

  const out: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    out.push({ from: debtors[i].uid, to: creditors[j].uid, amount: Math.round(pay * 100) / 100, currency });
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount <= 0.005) i++;
    if (creditors[j].amount <= 0.005) j++;
  }
  return out;
}

/** Saldos de todas las monedas: moneda → deudas mínimas en esa moneda. */
export function settleAllByCurrency(
  byCurrency: Map<TripCurrency, CurrencyBalance>
): Map<TripCurrency, Settlement[]> {
  const out = new Map<TripCurrency, Settlement[]>();
  for (const [currency, b] of byCurrency) {
    const settlements = settleDebts(b.net, currency);
    if (settlements.length > 0) out.set(currency, settlements);
  }
  return out;
}
