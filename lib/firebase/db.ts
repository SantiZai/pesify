import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./config";

// 1. Inicializar usuario y crearle una familia por defecto si no tiene
export async function initializeUserProfile(
  uid: string,
  email: string | null,
  displayName: string | null,
  photoURL: string | null = null
) {
  if (!uid) return null;

  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  // Si el usuario ya existe, actualizamos foto/nombre por si cambiaron.
  if (userSnap.exists()) {
    const data = userSnap.data();
    const patch: Record<string, unknown> = {};
    if ((photoURL ?? "") !== (data.photoURL ?? "")) patch.photoURL = photoURL ?? "";
    const name = displayName || email?.split('@')[0] || "Usuario";
    if (name !== data.displayName) patch.displayName = name;
    if (Object.keys(patch).length > 0) {
      await setDoc(userRef, patch, { merge: true });
      return { ...data, ...patch };
    }
    return data;
  }

  // Si es nuevo: Le creamos una Familia personal primero
  const familyRef = await addDoc(collection(db, "families"), {
    name: "Personal",
    members: [uid], // Él es el único miembro por ahora
    currency: "ARS",
    rateToArs: 1,
    createdAt: serverTimestamp(),
  });

  // Luego creamos su perfil apuntando a esa familia
  const newUser = {
    uid,
    email: email || "",
    displayName: displayName || email?.split('@')[0] || "Usuario",
    photoURL: photoURL || "",
    currentFamilyId: familyRef.id,
  };

  await setDoc(userRef, newUser);
  return newUser;
}