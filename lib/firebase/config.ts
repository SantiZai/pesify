import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Pasar `app` explícitamente: con HMR / múltiples inicializaciones
// `getAuth()` sin argumento puede devolver una instancia distinta y
// la sesión del redirect no se restaura (vuelve a /login sin user).
const auth = getAuth(app);

// La persistencia por defecto ya es `browserLocalPersistence`, pero la
// dejamos explícita. Es asíncrona: capturamos el error en vez de dejar
// una promesa flotante que enmascare fallos (cookies bloqueadas, etc.).
setPersistence(auth, browserLocalPersistence).catch((e) => {
  console.error("No se pudo fijar persistencia de Auth:", e);
});

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const googleProvider = new GoogleAuthProvider();
// Pide siempre elegir cuenta: evita que un redirect silencioso con una
// sesión de Google distinta te devuelva a /login sin explicación.
googleProvider.setCustomParameters({ prompt: "select_account" });

export { app, auth, db, googleProvider };