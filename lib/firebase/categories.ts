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
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./config";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type TransactionType } from "./transactions";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type CategoryType = "income" | "expense";

export type CustomCategory = {
  id: string;
  familyId: string;
  name: string;
  type: CategoryType;
};

/** Nombres reservados (categorías base): no se pueden crear duplicados. */
export function defaultCategoriesFor(type: CategoryType): readonly string[] {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

/** Base + personalizadas de la familia para un tipo. */
export function mergedCategories(customs: CustomCategory[], type: TransactionType): string[] {
  const base = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const extra = customs.filter((c) => c.type === type).map((c) => c.name);
  return [...base, ...extra];
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function addCategory(
  familyId: string,
  name: string,
  type: CategoryType,
  createdBy: string
): Promise<string> {
  const clean = name.trim();
  if (!familyId) throw new Error("Falta la familia activa.");
  if (!clean) throw new Error("Poné un nombre.");
  if (clean.length > 30) throw new Error("El nombre no puede superar 30 caracteres.");

  const taken = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].some(
    (c) => c.toLowerCase() === clean.toLowerCase()
  );
  if (taken) throw new Error(`"${clean}" ya existe como categoría base.`);

  const existing = await getDocs(
    query(collection(db, "categories"), where("familyId", "==", familyId))
  );
  const dup = existing.docs.some(
    (d) => typeof d.data().name === "string" && (d.data().name as string).toLowerCase() === clean.toLowerCase()
  );
  if (dup) throw new Error(`"${clean}" ya existe en tu familia.`);

  const ref = await addDoc(collection(db, "categories"), {
    familyId,
    name: clean,
    type,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameCategory(id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!id) throw new Error("Falta el id.");
  if (!clean) throw new Error("Poné un nombre.");
  if (clean.length > 30) throw new Error("El nombre no puede superar 30 caracteres.");
  await updateDoc(doc(db, "categories", id), { name: clean });
  // Los movimientos viejos conservan el nombre anterior como historial.
}

/** Solo se puede borrar si ningún movimiento la usa. */
export async function deleteCategory(familyId: string, id: string, name: string): Promise<void> {
  if (!id) throw new Error("Falta el id.");
  const used = await getDocs(
    query(
      collection(db, "transactions"),
      where("familyId", "==", familyId),
      where("category", "==", name),
      limit(1)
    )
  );
  if (!used.empty) {
    throw new Error(`"${name}" tiene movimientos registrados y no se puede borrar.`);
  }
  await deleteDoc(doc(db, "categories", id));
}

// ── Lectura en vivo ──────────────────────────────────────────────────────────

export function useCategories(familyId: string | null | undefined) {
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) return;
    const q = query(collection(db, "categories"), where("familyId", "==", familyId));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: CustomCategory[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (typeof data.name === "string" && (data.type === "income" || data.type === "expense")) {
            items.push({ id: d.id, familyId, name: data.name, type: data.type });
          }
        });
        items.sort((a, b) => a.name.localeCompare(b.name));
        setCategories(items);
        setLoading(false);
      },
      (e) => {
        console.error("Error escuchando categorías:", e);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [familyId]);

  if (!familyId) return { categories: [], loading: false };
  return { categories, loading };
}
