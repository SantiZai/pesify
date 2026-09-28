import { doc, onSnapshot, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./config";

// ── Meta de ahorro mensual ───────────────────────────────────────────────────

function goalId(familyId: string, monthKey: string): string {
  return `${familyId}_${monthKey}`;
}

/** Crea/actualiza la meta. Con 0 o menos se elimina. */
export async function setSavingsGoal(
  familyId: string,
  monthKey: string,
  amount: number,
  uid: string
): Promise<void> {
  if (!familyId || !uid) throw new Error("Falta tu sesión.");
  const ref = doc(db, "savings_goals", goalId(familyId, monthKey));
  if (!Number.isFinite(amount) || amount <= 0) {
    await deleteDoc(ref).catch(() => {});
    return;
  }
  await setDoc(
    ref,
    { familyId, monthKey, goal: Math.round(amount * 100) / 100, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export function useSavingsGoal(familyId: string | null | undefined, monthKey: string) {
  const [goal, setGoal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) return;
    const unsubscribe = onSnapshot(
      doc(db, "savings_goals", goalId(familyId, monthKey)),
      (snap) => {
        const data = snap.data();
        setGoal(snap.exists() && typeof data?.goal === "number" ? data.goal : null);
        setLoading(false);
      },
      (e) => {
        console.error("Error escuchando meta de ahorro:", e);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [familyId, monthKey]);

  if (!familyId) return { goal: null, loading: false };
  return { goal, loading };
}
