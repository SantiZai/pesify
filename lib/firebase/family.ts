import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "./config";

// ── Tipos (según REQUERIMENTS.md §5) ─────────────────────────────────────────

export type Family = {
  id: string;
  name: string;
  members: string[];
  createdAt: Timestamp | null;
};

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
  };
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

/** Crea una familia nueva y mueve al usuario a ella. */
export async function createFamily(name: string, uid: string): Promise<string> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Poné un nombre para la familia.");
  if (cleanName.length > 40) throw new Error("El nombre no puede superar 40 caracteres.");
  if (!uid) throw new Error("Falta tu sesión.");

  const familyRef = await addDoc(collection(db, "families"), {
    name: cleanName,
    members: [uid],
    createdAt: serverTimestamp(),
  });

  await runTransaction(db, async (tx) => {
    tx.update(doc(db, "users", uid), { currentFamilyId: familyRef.id });
  });

  return familyRef.id;
}
