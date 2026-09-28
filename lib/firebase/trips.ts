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

/** Gasto de viaje: quién puso la plata + cuánto debe cada uno (suma = monto).
 *  Así se contempla todo: uno paga todo, pagan por separado, alguien no paga
 *  (otro paga su parte) o paga solo algo (montos personalizados). */
export type TripExpense = {
  id: string;
  tripId: string;
  familyId: string;
  paidBy: string;
  paidByName: string;
  paidByPhoto: string;
  amount: number;
  description: string;
  category: string;
  date: Timestamp;
  shares: Record<string, number>;
};

export type NewTripExpense = {
  tripId: string;
  familyId: string;
  paidBy: string;
  paidByName: string;
  paidByPhoto?: string;
  amount: number;
  description?: string;
  category?: string;
  date?: Timestamp | Date;
  shares: Record<string, number>;
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

export function useTrip(tripId: string | null | undefined) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
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
  }, [tripId]);

  if (!tripId) return { trip: null, members: [], loading: false, error: null };
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
  if (!input.paidBy) throw new Error("Elegí quién pagó.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("El monto debe ser mayor a 0.");

  const entries = Object.entries(input.shares).filter(([, v]) => Number.isFinite(v) && v > 0);
  if (entries.length === 0) throw new Error("Elegí entre quiénes se divide.");
  const sum = entries.reduce((acc, [, v]) => acc + v, 0);
  if (Math.abs(sum - input.amount) > 0.01) {
    throw new Error(`La división suma ${sum.toFixed(2)} y el gasto es ${input.amount.toFixed(2)}.`);
  }

  const ref = await addDoc(collection(db, "trip_expenses"), {
    tripId: input.tripId,
    familyId: input.familyId,
    paidBy: input.paidBy,
    paidByName: input.paidByName || "Miembro",
    paidByPhoto: input.paidByPhoto || "",
    amount: Math.round(input.amount * 100) / 100,
    description: (input.description ?? "").trim().slice(0, 140),
    category: (input.category ?? "").trim().slice(0, 30),
    date: toTimestamp(input.date),
    shares: Object.fromEntries(entries.map(([k, v]) => [k, Math.round(v * 100) / 100])),
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
  return {
    id,
    tripId: data.tripId,
    familyId: typeof data.familyId === "string" ? data.familyId : "",
    paidBy: typeof data.paidBy === "string" ? data.paidBy : "",
    paidByName: typeof data.paidByName === "string" ? data.paidByName : "Miembro",
    paidByPhoto: typeof data.paidByPhoto === "string" ? data.paidByPhoto : "",
    amount,
    description: typeof data.description === "string" ? data.description : "",
    category: typeof data.category === "string" ? data.category : "",
    date: data.date instanceof Timestamp ? data.date : Timestamp.now(),
    shares,
  };
}

export function useTripExpenses(tripId: string | null | undefined) {
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
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
  }, [tripId]);

  if (!tripId) return { expenses: [], loading: false };
  return { expenses, loading };
}

// ── Balances: quién pagó, quién debe y quién le debe a quién ─────────────────

export type Settlement = { from: string; to: string; amount: number };

export function computeBalances(
  expenses: TripExpense[],
  participantUids: string[]
): { paid: Map<string, number>; owed: Map<string, number>; net: Map<string, number> } {
  const paid = new Map<string, number>();
  const owed = new Map<string, number>();
  for (const uid of participantUids) {
    paid.set(uid, 0);
    owed.set(uid, 0);
  }
  for (const e of expenses) {
    paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + e.amount);
    for (const [uid, share] of Object.entries(e.shares)) {
      owed.set(uid, (owed.get(uid) ?? 0) + share);
    }
  }
  const net = new Map<string, number>();
  for (const uid of new Set([...paid.keys(), ...owed.keys()])) {
    net.set(uid, Math.round(((paid.get(uid) ?? 0) - (owed.get(uid) ?? 0)) * 100) / 100);
  }
  return { paid, owed, net };
}

/** Deudas simplificadas (avaricioso): pares deudor → acreedor. */
export function settleDebts(net: Map<string, number>): Settlement[] {
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
    out.push({ from: debtors[i].uid, to: creditors[j].uid, amount: Math.round(pay * 100) / 100 });
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount <= 0.005) i++;
    if (creditors[j].amount <= 0.005) j++;
  }
  return out;
}
