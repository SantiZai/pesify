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

### 3.1. Autenticación y Cuentas (✅ Completado)
*   Registro e inicio de sesión vía Email/Contraseña y Google Account.
*   Creación automática de un perfil de usuario en la base de datos al primer login.
*   Asignación automática a una "Familia Personal" por defecto.

### 3.2. Gestión Familiar (Multi-tenancy) (🚧 En Progreso)
*   Cada transacción pertenece a una Familia, no a un usuario.
*   **Vistas compartidas:** Cualquier miembro de la familia ve el saldo total y el historial de transacciones de todos los integrantes.
*   *(Futuro)* Capacidad de invitar a un usuario existente a tu familia compartiendo un ID o link.

### 3.3. Gestión de Transacciones (Pendiente)
*   **CRUD Offline:** Crear, leer, actualizar y borrar ingresos y egresos sin internet.
*   **Categorización:** Asignar categorías predefinidas (Ej: Supermercado, Sueldo, Transporte, Ocio, Servicios).
*   **Atribución:** Ver qué miembro de la familia registró el gasto.

### 3.4. Dashboard y Reportes (Pendiente)
*   Cálculo de **Saldo Actual** (Ingresos totales - Egresos totales).
*   Métricas del mes en curso: Total Ingresado, Total Gastado.
*   Lista cronológica de últimos movimientos.

---

## 4. Detalles de Interfaz de Usuario (UI/UX)

La aplicación debe tener un diseño **Mobile-First**, limpio y monocromático (Zinc/Slate), priorizando la velocidad de carga y la facilidad de uso con una sola mano.

### 4.1. Layout Principal
*   **Top Navigation (Mobile & Desktop):** Barra superior simple con el título de la vista actual (ej. "Inicio", "Familia") y el botón/menú de perfil para cerrar sesión.
*   **Bottom Navigation (Mobile):** Barra de navegación inferior fija con íconos de Phosphor (`House`, `PlusCircle`, `Users`, `Gear`).
*   **Componentes base:** Ninguno explícito, uso de HTML nativo (`nav`, `header`) estilizado con Tailwind (`sticky bottom-0 bg-background border-t`).

### 4.2. Pantalla: Dashboard Financiero
*   **Tarjetas de Resumen (Top):**
    *   Componentes: `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardContent>`
    *   Tarjeta principal destacada: "Saldo Total" (texto grande, tipografía bold).
    *   Dos tarjetas secundarias alineadas horizontalmente: "Ingresos (Mes)" en verde, "Gastos (Mes)" en rojo.
*   **Historial Reciente (Bottom):**
    *   Componente: `<Table>` de shadcn, o simplemente una lista con flexbox si se busca algo más "mobile-friendly".
    *   Cada fila debe mostrar: Ícono de categoría, Nombre/Descripción, Monto (rojo/verde), Fecha y Avatar/Nombre inicial de quien lo gastó.

### 4.3. Pantalla/Acción: Agregar Transacción
*   **Interacción:** No es una página nueva, sino un Modal emergente para no perder el contexto.
*   **Componentes a usar:** 
    *   `<Dialog>` (shadcn) para que se abra sobre el dashboard.
    *   `<Input>` (shadcn) tipo `number` para el monto, y tipo `text` para el detalle.
    *   `<Select>` (shadcn) para elegir el Tipo (Ingreso/Egreso) y la Categoría.
    *   `<Button>` (shadcn) para guardar, ocupando todo el ancho (mobile).
*   **UX:** Teclado numérico automático en el celular al enfocar el input de monto (`inputMode="decimal"`).

---

## 5. Modelo de Base de Datos (Firestore NoSQL)

*   **Colección `users`**:
    *   `uid`, `email`, `displayName`, `currentFamilyId`
*   **Colección `families`**:
    *   `id`, `name`, `members` (Array de strings con UIDs), `createdAt`
*   **Colección `transactions`**:
    *   `id`, `familyId` (Ref), `createdBy` (Ref UID), `amount` (Number), `type` (String: 'income' | 'expense'), `category` (String), `description` (String), `date` (Timestamp), `updatedAt` (Timestamp)

---

## 6. Plan de Desarrollo Paso a Paso (Roadmap)

### Fase 1: Setup y Seguridad Base (✅ Completado)
1.  Inicializar Next.js + Tailwind + shadcn/ui.
2.  Configurar Firebase (Auth + Firestore offline cache).
3.  Implementar inicio de sesión (Google / Email).
4.  Proteger rutas con `AuthGuard`.
5.  Crear y asignar familia por defecto en Firestore.

### Fase 2: Servicios de Datos de Transacciones (📍 Próximo Paso)
1.  Instalar componentes faltantes (`dialog`, `select`, `table`).
2.  Crear hooks de Firebase para agregar transacciones (`addTransaction`).
3.  Crear hook de Firebase (`useTransactions`) que utilice `onSnapshot` para escuchar los movimientos de la familia en tiempo real.

### Fase 3: Interfaz del Dashboard y CRUD
1.  Diseñar el modal `<AddTransactionDialog>` usando los componentes instalados.
2.  Conectar el modal con la función de guardado en Firestore.
3.  Diseñar las tarjetas de resumen (Cards) en el Dashboard.
4.  Crear la función de utilidad para calcular el saldo total sumando/restando el array de transacciones.
5.  Renderizar la lista de transacciones recientes debajo de los resúmenes.

### Fase 4: Configuración de Familia
1.  Crear página `/family`.
2.  Mostrar lista de miembros actuales (leyendo los UIDs del array `members`).
3.  Crear lógica para generar un "Código de invitación" o unirse a una familia existente actualizando el `currentFamilyId` del usuario.

### Fase 5: PWA y Pulido
1.  Configurar `next-pwa` o `serwist` para generar el Service Worker.
2.  Crear archivo `manifest.json` y agregar los íconos de la app (App Icons para iOS/Android).
3.  Ajustar las políticas RLS en Firestore para que un usuario solo pueda leer/escribir donde `familyId` coincida con su familia asignada.