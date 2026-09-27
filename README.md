# 📊 Finanzas Familiares App

Aplicación web progresiva (PWA) instalable enfocada en el control de gastos e ingresos personales y familiares. Diseñada bajo la filosofía **Local-First / Offline-First** para garantizar velocidad, privacidad y disponibilidad sin conexión.

## 🛠 Stack Tecnológico

*   **Framework:** Next.js (App Router)
*   **Lenguaje:** TypeScript
*   **Estilos:** Tailwind CSS
*   **Componentes UI:** shadcn/ui
*   **Iconografía:** Phosphor Icons (`@phosphor-icons/react` en reemplazo de Lucide para un diseño más limpio)
*   **Backend / BaaS:** Firebase (Auth & Firestore)
*   **Almacenamiento Local (Offline):** IndexedDB (mediante el caché persistente nativo de Firestore)

## 🏗 Arquitectura y Sincronización

La aplicación utiliza un modelo **Local-First**:
1.  Las lecturas y escrituras se realizan de manera instantánea contra la base de datos local del dispositivo (`IndexedDB`).
2.  La UI reacciona sin latencia (sin *loading spinners* por red).
3.  En segundo plano, Firebase Firestore sincroniza los datos locales con la nube y resuelve conflictos entre dispositivos automáticamente.
4.  Si no hay conexión, los datos se encolan localmente y se sincronizan al recuperar internet.

## 🔐 Autenticación

El estado de la sesión se maneja en el cliente (Client Components) usando el SDK web de Firebase, envuelto en un Provider global (`AuthContext`).

## 🗄️ Esquema de Base de Datos (Firestore)

El modelo de datos está diseñado para multi-tenancy familiar.

1.  **`users`**: Perfil de usuario. Contiene el `currentFamilyId` para saber en qué entorno está operando.
2.  **`families`**: Agrupa a los usuarios. Contiene un array `members` con los UIDs. Crucial para reglas de seguridad de lectura/escritura (RLS). Al registrarse, se crea una familia "Personal" por defecto.
3.  **`transactions`**: Egresos e ingresos. Pertenecen a un `familyId`, no a un usuario directamente. Incluyen un `updatedAt` para resolver conflictos de sincronización offline (LWW).

**Métodos habilitados:**
*   Email y Contraseña.
*   Google (via Popup/Redirect).

**Guardián de Rutas (`AuthGuard`):**
Un componente envuelve la aplicación y gestiona el acceso:
*   Rutas públicas (`/`, `/login`): Redirigen a `/dashboard` si hay una sesión activa.
*   Rutas privadas (`/dashboard`, etc.): Redirigen a `/login` si no hay sesión activa.
*   Estado de carga: Muestra un `Loader2` de lucide-react mientras Firebase verifica la caché local para evitar destellos (flickering) en la UI.

## 🗂 Estructura de Carpetas Principal

\`\`\`
src/
├── app/
│   ├── layout.tsx       # Root layout (inyecta AuthProvider y AuthGuard)
│   ├── page.tsx         # Landing page / Home
│   ├── login/           # Pantalla de acceso (Email/Google)
│   └── dashboard/       # Pantalla principal post-login
├── components/
│   ├── ui/              # Componentes de shadcn (Button, Input, Card, etc.)
│   └── auth-guard.tsx   # Componente protector de rutas
└── lib/
    └── firebase/
        ├── config.ts        # Inicialización de Firebase (Auth, Firestore offline)
        └── auth-context.tsx # Estado global del usuario (Provider)
\`\`\`

## 🚀 Estado Actual del Desarrollo

*   [x] Configuración de Next.js y Tailwind CSS.
*   [x] Integración de `shadcn/ui`.
*   [x] Configuración de Firebase Project (Auth + Firestore).
*   [x] Habilitación de caché offline en Firestore (IndexedDB).
*   [x] Pantalla de Login y Registro (Email/Pass + Google).
*   [x] Contexto global de autenticación (`useAuth`).
*   [x] Protección y redirección de rutas segura.
*   [ ] Estructura de base de datos para "Familias" (Multi-tenancy).
*   [ ] CRUD de Gastos/Ingresos offline.
*   [ ] Configuración de PWA (Service Workers y Manifest).

---
*Documento vivo - Última actualización durante la fase de Autenticación.*