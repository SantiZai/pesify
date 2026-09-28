import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad · Pesify",
  description: "Cómo Pesify trata tus datos personales.",
};

const CONTACT_EMAIL = "santiagozaidandev@gmail.com";
const UPDATED = "28 de septiembre de 2026";

function H({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h2 className="mt-8 text-lg font-bold tracking-tight">
      {n}. {children}
    </h2>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          ← Volver a Pesify
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Política de Privacidad</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Responsable: Pesify · Contacto:{" "}
          <a className="font-medium text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          · Última actualización: {UPDATED}
        </p>

        <div className="mt-4 space-y-3 text-sm leading-relaxed">
          <p>
            Esta política explica qué datos personales trata Pesify (app de finanzas
            familiares), con qué finalidad y qué derechos tenés sobre ellos, conforme a la
            Ley 25.326 de Protección de Datos Personales de la República Argentina.
          </p>

          <H n="1">Datos que tratamos</H>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Datos de cuenta:</strong> nombre, email y foto de perfil (los provee
              Google si ingresás con Google, o tu email si usás el enlace mágico).
            </li>
            <li>
              <strong>Contenido que cargás:</strong> ingresos, egresos, presupuestos, cuentas
              del mes, recurrencias, metas de ahorro y gastos de viajes, con sus montos,
              fechas, categorías y descripciones.
            </li>
            <li>
              <strong>Datos técnicos mínimos:</strong> identificadores de sesión y una copia
              local en tu dispositivo (IndexedDB) para que la app funcione sin internet. No
              usamos cookies de rastreo ni publicidad.
            </li>
          </ul>

          <H n="2">Finalidades</H>
          <p>
            Usamos tus datos solo para operar el servicio: autenticarte, guardar y
            sincronizar tus finanzas entre tus dispositivos y con tu familia, mostrar
            saldos/reportes y mantener la seguridad de la app. No vendemos tus datos ni
            los usamos para publicidad.
          </p>

          <H n="3">Con quién se comparten</H>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Tu familia y viajes:</strong> los miembros de tu familia ven el saldo,
              los movimientos y los datos compartidos; los participantes de un viaje ven
              sus gastos y balances. Es el funcionamiento central de la app: no cargues
              información que no quieras compartir con ellos.
            </li>
            <li>
              <strong>Proveedores técnicos:</strong> Google (Firebase Authentication y
              Firestore) aloja y procesa los datos por nuestra cuenta, incluso fuera de
              Argentina, bajo sus compromisos de seguridad.
            </li>
            <li>
              <strong>Autoridades:</strong> solo si una norma o una orden judicial lo exige.
            </li>
          </ul>

          <H n="4">Conservación</H>
          <p>
            Conservamos tus datos mientras tu cuenta esté activa. Si borrás una familia,
            un viaje o un movimiento desde la app, ese contenido se elimina de nuestros
            sistemas (pueden quedar copias de resguardo por un tiempo limitado por
            razones técnicas).
          </p>

          <H n="5">Tus derechos (Ley 25.326)</H>
          <p>
            Tenés derecho a acceder, rectificar, actualizar y suprimir tus datos
            personales. Podés editar o borrar gran parte directamente desde la app
            (movimientos, presupuestos, cuentas, recurrencias, viajes y familias). Para
            cualquier otro pedido escribinos a{" "}
            <a className="font-medium text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>{" "}
            y lo resolvemos dentro de los 30 días. También podés reclamar ante la Agencia
            de Acceso a la Información Pública (AAIP).
          </p>

          <H n="6">
            <span id="eliminacion" className="scroll-mt-20">
              Eliminación de datos
            </span>
          </H>
          <p>Para borrar tus datos podés:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Borrar tu contenido desde la app (Ajustes/Familia: borrar familia; Viajes:
              borrar viaje; y cada movimiento, presupuesto o recurrencia).
            </li>
            <li>
              Pedir la eliminación completa de tu cuenta y tus datos escribiendo a{" "}
              <a className="font-medium text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}?subject=Eliminar%20mis%20datos%20de%20Pesify`}>
                {CONTACT_EMAIL}
              </a>{" "}
              con el asunto “Eliminar mis datos de Pesify” desde el email de tu cuenta.
            </li>
          </ol>

          <H n="7">Menores</H>
          <p>
            Pesify no está dirigida a menores de 13 años. Si sos padre/madre o tutor y
            creés que un menor nos dio sus datos, escribinos y los eliminamos.
          </p>

          <H n="8">Seguridad</H>
          <p>
            Aplicamos medidas razonables de seguridad (cifrado en tránsito, reglas de
            acceso por familia en la base de datos y sesiones de Firebase). Ningún
            sistema es 100% seguro: usá una cuenta y un dispositivo protegidos y no
            compartas tus códigos de invitación con desconocidos (quien tiene el código
            de un viaje o familia puede unirse).
          </p>

          <H n="9">Cookies y almacenamiento local</H>
          <p>
            Solo usamos lo necesario para que la app funcione: sesión de autenticación y
            caché local offline en tu dispositivo. No hay rastreadores de terceros con
            fines publicitarios.
          </p>

          <H n="10">Cambios</H>
          <p>
            Si cambiamos esta política, publicaremos la nueva versión en esta página con
            su fecha. El uso continuado de la app implica aceptación de la versión
            vigente.
          </p>

          <p className="pt-4 text-muted-foreground">
            ¿Dudas? Escribinos a{" "}
            <a className="font-medium text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
