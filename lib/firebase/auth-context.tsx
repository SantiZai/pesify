"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./config";
import { initializeUserProfile } from "./db";

type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  currentFamilyId: string;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  /** Relee el perfil de Firestore (ej: después de cambiar de familia). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  authError: null,
  clearAuthError: () => {},
  refreshProfile: async () => {},
});

export function getAuthErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const e = error as { code?: unknown; message?: unknown };
    if (typeof e.code === "string" && e.code) return e.code;
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return String(error);
}

export function getFriendlyAuthError(codeOrMessage: string): string {
  if (codeOrMessage.includes("auth/operation-not-allowed"))
    return "El login con Google no está habilitado en Firebase Console (Authentication > Sign-in method > Google).";
  if (codeOrMessage.includes("auth/unauthorized-domain"))
    return "Este dominio no está autorizado en Firebase Console (Authentication > Settings > Authorized domains). Agregá localhost y tu dominio.";
  if (codeOrMessage.includes("auth/popup-blocked"))
    return "El navegador bloqueó el popup de Google. Permitilo o probá de nuevo (se reintenta con redirect).";
  if (codeOrMessage.includes("auth/popup-closed-by-user") || codeOrMessage.includes("auth/cancelled-popup-request"))
    return "Cerraste la ventana de Google antes de terminar. Intentá de nuevo.";
  if (codeOrMessage.includes("auth/network-request-failed"))
    return "Fallo de red al contactar a Google. Revisá tu conexión e intentá de nuevo.";
  if (codeOrMessage.includes("auth/account-exists-with-different-credential"))
    return "Ese email ya está registrado con otro método (email/contraseña). Entrá con ese método.";
  return `No se pudo completar el login con Google: ${codeOrMessage}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshProfile = async () => {
    const current = auth.currentUser;
    if (!current) return;
    const snap = await getDoc(doc(db, "users", current.uid));
    if (snap.exists()) {
      const data = snap.data();
      setProfile({ photoURL: "", ...data } as UserProfile);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: () => void = () => {};

    // 1. Primero resolvemos el redirect de Google (si volvemos de Google).
    // Sin esto, los errores del redirect (dominio no autorizado, provider
    // deshabilitado, etc.) se pierden y el usuario vuelve a /login sin sesión
    // y sin mensaje.
    (async () => {
      try {
        await getRedirectResult(auth);
        // Si llegó hasta acá: o no había redirect pendiente (null) o fue
        // exitoso. El user lo entrega onAuthStateChanged abajo.
        if (!cancelled) setAuthError(null);
      } catch (error: unknown) {
        console.error("Error en redirect de Google:", error);
        if (!cancelled) {
          setAuthError(getFriendlyAuthError(getAuthErrorCode(error)));
        }
      } finally {
        if (cancelled) return;
        // 2. Recién después escuchamos la sesión, para no marcar loading=false
        // antes de procesar el redirect.
        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          setUser(currentUser);

          if (currentUser) {
            try {
              // Carga o crea el perfil en Firestore
              const userData = await initializeUserProfile(
                currentUser.uid,
                currentUser.email,
                currentUser.displayName,
                currentUser.photoURL
              );
              setProfile({ photoURL: "", ...(userData as Record<string, unknown>) } as UserProfile);
            } catch (error) {
              // No cerramos sesión por un fallo de Firestore: el login es
              // válido aunque el perfil falle. El dashboard muestra fallback.
              console.error("Error cargando perfil:", error);
              setProfile(null);
            }
          } else {
            setProfile(null);
          }

          setLoading(false);
        });
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, authError, clearAuthError: () => setAuthError(null), refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext);
