# 📋 Documento de Requerimientos: Finanzas Familiares PWA

## 1. Visión General
Aplicación web progresiva (PWA) instalable en móviles y escritorio, diseñada para el control de finanzas personales y familiares. Basada en una arquitectura **Offline-First / Local-First**, la app permite a los usuarios registrar ingresos y egresos sin conexión a internet, sincronizando los datos automáticamente con los miembros de su "Familia" al recuperar la conectividad.

---

## 2. Stack Tecnológico
*   **Framework:** Next.js (App Router)
*   **Lenguaje:** TypeScript
*   **Estilos:** Tailwind CSS
*   **Iconografía:** Phosphor Icons (`@phosphor-icons/react`)
*   **UI Components:** shadcn/ui
*   **Backend & Base de Datos:** Firebase (Authentication + Firestore)
*   **Sincronización Offline:** Firestore Persistent Local Cache (IndexedDB)

---

## 3. Funcionalidades Principales (Core Features)

### 3.1. Autenticación y Rutas (✅ Completado)
*   Registro e inicio de sesión vía Google Account o enlace mágico al email (sin contraseña).
*   Creación automática de un perfil de usuario en la base de datos al primer login.
*   **Landing Page (`/`):** Página de inicio pública promocional. Muestra características, capturas de pantalla y diferenciales. Solo accesible si no hay sesión. 
*   **Redirecciones inteligentes:** 
    *   Usuario sin sesión en `/dashboard` -> Redirige a `/login`.
    *   Usuario logueado en `/` o `/login` -> Redirige a `/dashboard`.

### 3.2. Gestión Familiar (Multi-tenancy) (✅ Completado)
*   Cada transacción pertenece a una Familia, no a un usuario.
*   **Vistas compartidas:** Cualquier miembro de la familia ve el saldo total y el historial de transacciones de todos los integrantes.
*   *(Futuro)* Capacidad de invitar a un usuario existente a tu familia compartiendo un ID o link.

### 3.3. Gestión de Transacciones (✅ Completado)
*   **CRUD Offline:** Crear, leer, actualizar y borrar ingresos y egresos sin internet.
*   **Categorización:** Asignar categorías predefinidas (Ej: Supermercado, Sueldo, Transporte, Ocio, Servicios).
*   **Atribución:** Ver qué miembro de la familia registró el gasto.

### 3.4. Dashboard y Reportes (✅ Completado base, ⏳ Reportes dedicados)
*   Cálculo de **Saldo Actual** (Ingresos totales - Egresos totales).
*   Métricas del mes en curso: Total Ingresado, Total Gastado.
*   Lista cronológica de últimos movimientos.

---

## 4. Detalles de Interfaz de Usuario (UI/UX)

La aplicación debe tener un diseño **Mobile-First**, limpio y monocromático (Zinc/Slate), priorizando la velocidad de carga y la facilidad de uso con una sola mano.

### 4.1. Layout Principal (App)
*   **Top Navigation (Mobile & Desktop):** Barra superior simple con el título de la vista actual (ej. "Inicio", "Familia") y el botón/menú de perfil para cerrar sesión.
*   **Bottom Navigation (Mobile):** Barra de navegación inferior fija con íconos de Phosphor (`House`, `PlusCircle`, `Users`, `Gear`).

### 4.2. Pantalla: Landing Page Pública (`/`)
*   **Objetivo:** Marketing y conversión. Vender la idea del control familiar y el modo offline.
*   **Secciones clave:**
    *   **Hero Section:** Título principal atractivo, subtítulo descriptivo y botones grandes de *Call to Action* ("Comenzar ahora") que dirigen a `/login`.
    *   **Mockups/Imágenes:** Capturas de pantalla de la app funcionando en un celular.
    *   **Features:** Bloques destacando los diferenciales (Sincronización familiar en tiempo real, Funciona sin internet, Privado y seguro).

### 4.3. Pantalla: Dashboard Financiero (`/dashboard`)
*   **Tarjetas de Resumen (Top):**
    *   Componentes: `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardContent>`
    *   Tarjeta principal destacada: "Saldo Total" (texto grande, tipografía bold).
    *   Dos tarjetas secundarias alineadas horizontalmente: "Ingresos (Mes)" en verde, "Gastos (Mes)" en rojo.
*   **Historial Reciente (Bottom):**
    *   Componente: `<Table>` de shadcn, o lista optimizada para móvil.
    *   Cada fila muestra: Ícono de categoría, Nombre/Descripción, Monto (rojo/verde), Fecha y Avatar/Nombre inicial de quien lo gastó.

### 4.4. Pantalla/Acción: Agregar Transacción
*   **Interacción:** Modal emergente para no perder el contexto.
*   **Componentes a usar:** `<Dialog>`, `<Input>` (number/text), `<Select>`, `<Button>`.
*   **UX:** Teclado numérico automático en el celular al enfocar el input de monto (`inputMode="decimal"`).

---

## 5. Modelo de Base de Datos (Firestore NoSQL)

*   **Colección `users`**: `uid`, `email`, `displayName`, `currentFamilyId`
*   **Colección `families`**: `id`, `name`, `members` (Array de strings con UIDs), `createdAt`
*   **Colección `transactions`**: `id`, `familyId`, `createdBy`, `amount`, `type`, `category`, `description`, `date`, `updatedAt`

---

## 6. Plan de Desarrollo Paso a Paso (Roadmap)

### Fase 1: Setup y Seguridad Base
1.  Inicializar Next.js + Tailwind + shadcn/ui.
2.  Configurar Firebase (Auth + Firestore offline cache).
3.  Implementar inicio de sesión y registro.
4.  Proteger rutas y configurar enrutamiento inteligente (Landing vs Dashboard).
5.  Crear y asignar familia por defecto en Firestore.

### Fase 2: Servicios de Datos de Transacciones (✅ Completado)
1.  Instalar componentes faltantes (`dialog`, `select`, `table`).
2.  Crear hooks de Firebase para agregar transacciones (`addTransaction`).
3.  Crear hook de Firebase (`useTransactions`) que utilice `onSnapshot` para escuchar los movimientos de la familia en tiempo real.

### Fase 3: Interfaz del Dashboard y CRUD (✅ Completado)
1.  Diseñar el modal `<AddTransactionDialog>`.
2.  Conectar el modal con la función de guardado en Firestore.
3.  Diseñar las tarjetas de resumen (Cards) en el Dashboard.
4.  Crear función de cálculo de saldo total.
5.  Renderizar lista de transacciones recientes.

### Fase 4: Landing Page y Configuración Familiar (🚧 En progreso: falta Landing `/`)
1.  Diseñar la **Landing Page** (`/`) con features, imágenes del producto y botones hacia `/login`.
2.  Crear página `/family` (Gestión interna).
3.  Mostrar miembros actuales de la familia.
4.  Lógica para unirse a una familia existente con un código/ID.

### Fase 5: PWA y Pulido Final (✅ código listo, ⏳ publicar reglas en consola)
1.  Configurar Service Worker para instalación PWA.
2.  Crear `manifest.json` y agregar iconos iOS/Android.
3.  Ajustar políticas RLS en Firestore (Seguridad final de lectura/escritura).