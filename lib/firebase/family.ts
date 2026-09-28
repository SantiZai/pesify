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
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  query,
} from "firebase/firestore";import { useEffect, useMemo, useState } from "react";
import { db } from "./config";

// ── Tipos (según REQUERIMENTS.md §5) ─────────────────────────────────────────

export type Family = {
  id: string;
  name: string;
  members: string[];
  createdAt: Timestamp | null;
  currency: string;
  /** Cuántos ARS vale 1 unidad de la moneda (base de guardado). */
  rateToArs: number;
};

export const CURRENCIES = [
  { code: "ARS", label: "Peso argentino ($)" },
  { code: "USD", label: "Dólar (US$)" },
  { code: "BRL", label: "Real (R$)" },
  { code: "EUR", label: "Euro (€)" },
] as const;

export type MemberProfile = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
};

// ── Lecturas ─────────────────────────────────────────────────────────────────

export async function getFamily(familyId: string): Promise<Family | null> {
  const snap = await getDoc(doc(db, "families", familyId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: typeof data.name === "string" ? data.name : "Familia",
    members: Array.isArray(data.members) ? data.members.filter((m): m is string => typeof m === "string") : [],
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
    currency: typeof data.currency === "string" ? data.currency : "ARS",
    rateToArs: typeof data.rateToArs === "number" && data.rateToArs > 0 ? data.rateToArs : 1,
  };
}

/** Cambia la moneda de display (los montos se guardan en ARS). */
export async function setFamilyCurrency(familyId: string, currency: string, rateToArs: number): Promise<void> {
  if (!familyId) throw new Error("Falta la familia activa.");
  const code = currency.trim().toUpperCase().slice(0, 3);
  if (!code) throw new Error("Elegí una moneda.");
  const rate = code === "ARS" ? 1 : rateToArs;
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("La conversión debe ser mayor a 0.");
  await updateDoc(doc(db, "families", familyId), { currency: code, rateToArs: rate });
}

async function getMemberProfiles(uids: string[]): Promise<MemberProfile[]> {
  const snaps = await Promise.all(uids.map((uid) => getDoc(doc(db, "users", uid))));
  return snaps
    .map((snap, i) => {
      if (!snap.exists()) {
        return { uid: uids[i], displayName: "Miembro", email: "", photoURL: "" };
      }
      const data = snap.data();
      return {
        uid: uids[i],
        displayName: typeof data.displayName === "string" ? data.displayName : "Miembro",
        email: typeof data.email === "string" ? data.email : "",
        photoURL: typeof data.photoURL === "string" ? data.photoURL : "",
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Escucha la familia activa en tiempo real y resuelve los UIDs de `members`
 * a perfiles para mostrar (§Fase 4.2). Funciona offline con el cache local.
 */
export function useFamily(familyId: string | null | undefined) {
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!familyId) return;
    const unsubscribe = onSnapshot(
      doc(db, "families", familyId),
      (snap) => {
        if (!snap.exists()) {
          setFamily(null);
          setMembers([]);
          setError("La familia ya no existe.");
          setLoading(false);
          return;
        }
        const data = snap.data();
        setFamily({
          id: snap.id,
          name: typeof data.name === "string" ? data.name : "Familia",
          members: Array.isArray(data.members)
            ? data.members.filter((m): m is string => typeof m === "string")
            : [],
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
          currency: typeof data.currency === "string" ? data.currency : "ARS",
          rateToArs: typeof data.rateToArs === "number" && data.rateToArs > 0 ? data.rateToArs : 1,
        });
        setError(null);
        setLoading(false);
      },
      (e) => {
        console.error("Error escuchando familia:", e);
        setError("No se pudo cargar la familia.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [familyId]);

  // Clave estable para refetchear perfiles solo si cambian los miembros.
  const membersKey = useMemo(
    () => (family ? [...family.members].sort().join(",") : ""),
    [family]
  );

  useEffect(() => {
    if (!family || family.members.length === 0) return;
    let cancelled = false;
    getMemberProfiles(family.members).then((profiles) => {
      if (!cancelled) setMembers(profiles);
    });
    return () => {
      cancelled = true;
    };
  }, [family, membersKey]);

  if (!familyId) return { family: null, members: [], loading: false, error: null };
  return { family, members, loading, error };
}

// ── Escrituras ───────────────────────────────────────────────────────────────

/**
 * Une al usuario a una familia existente a partir del código de invitación
 * (= id de la familia). Agrega el UID a `members` y actualiza su
 * `currentFamilyId` en una transacción.
 */
export async function joinFamily(rawFamilyId: string, uid: string): Promise<string> {
  const newFamilyId = rawFamilyId.trim();
  if (!newFamilyId) throw new Error("Pegá el código de invitación.");
  if (!uid) throw new Error("Falta tu sesión.");

  await runTransaction(db, async (tx) => {
    const familyRef = doc(db, "families", newFamilyId);
    const familySnap = await tx.get(familyRef);
    if (!familySnap.exists()) throw new Error("Ese código no pertenece a ninguna familia.");

    tx.update(familyRef, { members: arrayUnion(uid) });
    tx.update(doc(db, "users", uid), { currentFamilyId: newFamilyId });
  });

  return newFamilyId;
}

/** Renombra la familia. Las reglas solo permiten el cambio a miembros:
 *  cualquiera de la familia puede hacerlo. */
export async function renameFamily(familyId: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!familyId) throw new Error("Falta la familia activa.");
  if (!clean) throw new Error("Poné un nombre.");
  if (clean.length > 40) throw new Error("El nombre no puede superar 40 caracteres.");
  await updateDoc(doc(db, "families", familyId), { name: clean });
}

/** Crea una familia nueva y mueve al usuario a ella. */
export async function createFamily(name: string, uid: string): Promise<string> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Poné un nombre para la familia.");
  if (cleanName.length > 40) throw new Error("El nombre no puede superar 40 caracteres.");
  if (!uid) throw new Error("Falta tu sesión.");

  const familyRef = await addDoc(collection(db, "families"), {
    name: cleanName,
    members: [uid],
    currency: "ARS",
    rateToArs: 1,
    createdAt: serverTimestamp(),
  });

  await runTransaction(db, async (tx) => {
    tx.update(doc(db, "users", uid), { currentFamilyId: familyRef.id });
  });

  return familyRef.id;
}

// ── Mis familias y cambio ────────────────────────────────────────────────────

export type MyFamily = { id: string; name: string; memberCount: number };

/** Todas las familias donde el UID es miembro (para cambiar entre ellas). */
export function useMyFamilies(uid: string | null | undefined) {
  const [families, setFamilies] = useState<MyFamily[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "families"), where("members", "array-contains", uid));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: MyFamily[] = [];
        snap.forEach((d) => {
          const data = d.data();
          items.push({
            id: d.id,
            name: typeof data.name === "string" ? data.name : "Familia",
            memberCount: Array.isArray(data.members) ? data.members.length : 0,
          });
        });
        items.sort((a, b) => a.name.localeCompare(b.name));
        setFamilies(items);
        setLoading(false);
      },
      (e) => {
        console.error("Error escuchando mis familias:", e);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [uid]);

  if (!uid) return { families: [], loading: false };
  return { families, loading };
}

/** Cambia la familia activa (solo a una donde sos miembro). */
export async function switchFamily(newFamilyId: string, uid: string): Promise<void> {
  if (!newFamilyId || !uid) throw new Error("Faltan datos.");
  const snap = await getDoc(doc(db, "families", newFamilyId));
  const members = snap.exists() && Array.isArray(snap.data().members) ? snap.data().members : [];
  if (!members.includes(uid)) throw new Error("No sos miembro de esa familia.");
  await updateDoc(doc(db, "users", uid), { currentFamilyId: newFamilyId });
}

// ── Borrado en cascada ───────────────────────────────────────────────────────
// Borra movimientos, recurrencias, categorías, presupuestos, metas y la familia.
// Los miembros apuntados a ella pasan a otra suya o a una "Personal" nueva.

async function deleteCollectionWhere(
  collectionName: string,
  familyId: string,
  onProgress: (deleted: number) => void
): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await getDocs(
      query(collection(db, collectionName), where("familyId", "==", familyId), limit(400))
    );
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    onProgress(total);
    if (snap.size < 400) break;
  }
  return total;
}

export async function deleteFamilyCascade(
  familyId: string,
  uid: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  if (!familyId || !uid) throw new Error("Faltan datos.");

  const familySnap = await getDoc(doc(db, "families", familyId));
  if (!familySnap.exists()) throw new Error("La familia ya no existe.");
  const members: string[] = Array.isArray(familySnap.data().members)
    ? (familySnap.data().members as unknown[]).filter((m): m is string => typeof m === "string")
    : [];
  if (!members.includes(uid)) throw new Error("Solo un miembro puede eliminarla.");

  onProgress?.("Borrando movimientos...");
  await deleteCollectionWhere("transactions", familyId, (n) => onProgress?.(`Borrando movimientos... ${n}`));
  onProgress?.("Borrando recurrencias...");
  await deleteCollectionWhere("recurring", familyId, () => {});
  onProgress?.("Borrando categorías...");
  await deleteCollectionWhere("categories", familyId, () => {});
  onProgress?.("Borrando presupuestos...");
  await deleteCollectionWhere("budgets", familyId, () => {});
  onProgress?.("Borrando metas...");
  await deleteCollectionWhere("savings_goals", familyId, () => {});

  // Desliga miembros: otra familia suya o una Personal nueva.
  onProgress?.("Reubicando miembros...");
  for (const memberUid of members) {
    const uref = doc(db, "users", memberUid);
    const usnap = await getDoc(uref);
    if (!usnap.exists() || usnap.data().currentFamilyId !== familyId) continue;
    const others = await getDocs(
      query(collection(db, "families"), where("members", "array-contains", memberUid), limit(10))
    );
    const other = others.docs.find((d) => d.id !== familyId);
    if (other) {
      await updateDoc(uref, { currentFamilyId: other.id });
    } else {
      const fresh = await addDoc(collection(db, "families"), {
        name: "Personal",
        members: [memberUid],
        currency: "ARS",
        rateToArs: 1,
        createdAt: serverTimestamp(),
      });
      await updateDoc(uref, { currentFamilyId: fresh.id });
    }
  }

  // La familia se borra última (las reglas exigen ser miembro).
  onProgress?.("Eliminando familia...");
  await deleteDoc(doc(db, "families", familyId));
}
