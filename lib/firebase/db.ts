import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./config";

// 1. Inicializar usuario y crearle una familia por defecto si no tiene
export async function initializeUserProfile(uid: string, email: string | null, displayName: string | null) {
  if (!uid) return null;

  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  // Si el usuario ya existe, devolvemos sus datos
  if (userSnap.exists()) {
    return userSnap.data();
  }

  // Si es nuevo: Le creamos una Familia personal primero
  const familyRef = await addDoc(collection(db, "families"), {
    name: "Personal",
    members: [uid], // Él es el único miembro por ahora
    createdAt: serverTimestamp(),
  });

  // Luego creamos su perfil apuntando a esa familia
  const newUser = {
    uid,
    email: email || "",
    displayName: displayName || email?.split('@')[0] || "Usuario",
    currentFamilyId: familyRef.id,
  };

  await setDoc(userRef, newUser);
  return newUser;
}