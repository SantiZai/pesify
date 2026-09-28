import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos y Condiciones · Pesify",
  description: "Condiciones de uso de Pesify.",
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

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          ← Volver a Pesify
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Términos y Condiciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Titular: Pesify · Contacto:{" "}
          <a className="font-medium text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          · Última actualización: {UPDATED}
        </p>

        <div className="mt-4 space-y-3 text-sm leading-relaxed">
          <p>
            Al crear una cuenta o usar Pesify aceptás estos términos. Si no estás de
            acuerdo, no uses el servicio.
          </p>

          <H n="1">Qué es Pesify</H>
          <p>
            Pesify es una app de registro y organización de finanzas familiares: cargar
            ingresos y egresos, presupuestos, cuentas mensuales, recurrencias, ahorro y
            gastos de viajes compartidos. Funciona offline y sincroniza cuando hay
            conexión.
          </p>

          <H n="2">Cuenta y acceso</H>
          <ul className="list-disc space-y-1 pl-5">
            <li>Podés ingresar con tu cuenta de Google o con un enlace a tu email.</li>
            <li>Tenés que tener 13 años o más (o la edad mínima de tu país).</li>
            <li>Sos responsable de mantener el acceso a tu cuenta y a tus dispositivos.</li>
            <li>Podemos suspender cuentas que hagan un uso abusivo o fraudulento.</li>
          </ul>

          <H n="3">Contenido compartido</H>
          <p>
            Todo lo que cargues en una familia lo ven sus miembros, y lo de un viaje lo
            ven sus participantes (saldos, movimientos, balances y deudas). Los códigos
            de invitación funcionan como llave: quien los tenga puede unirse. Compartilos
            solo con personas de confianza.
          </p>

          <H n="4">Uso aceptable</H>
          <ul className="list-disc space-y-1 pl-5">
            <li>No usar la app para fines ilegales ni para dañar a terceros.</li>
            <li>No intentar vulnerar la seguridad, ni extraer datos de otros usuarios.</li>
            <li>No subir contenido ofensivo o que infrinja derechos de terceros.</li>
          </ul>

          <H n="5">Disponibilidad</H>
          <p>
            La app está diseñada para funcionar sin internet y sincronizar después, pero
            no garantizamos disponibilidad ininterrumpida ni que la sincronización sea
            instantánea. Podés exportar o revisar tus datos importantes por tu cuenta. Te
            recomendamos no usar Pesify como único respaldo de información crítica.
          </p>

          <H n="6">No es asesoramiento financiero</H>
          <p>
            Pesify es una herramienta de organización. Nada de lo que muestra (saldos,
            reportes, presupuestos) constituye asesoramiento financiero, contable o
            impositivo. Las decisiones con tu dinero son tuyas.
          </p>

          <H n="7">Costo del servicio</H>
          <p>
            El uso actual es gratuito. Si en el futuro hubiera planes pagos, se
            informarán precio, condiciones y baja antes de cualquier cobro, conforme a la
            Ley 24.240 de Defensa del Consumidor.
          </p>

          <H n="8">Privacidad y datos</H>
          <p>
            El tratamiento de tus datos se rige por nuestra{" "}
            <Link className="font-medium text-primary hover:underline" href="/privacy">
              Política de Privacidad
            </Link>
            , incluyendo cómo borrar tu contenido y pedir la eliminación de tu cuenta.
          </p>

          <H n="9">Limitación de responsabilidad</H>
          <p>
            En la máxima medida permitida por la ley, Pesify no responde por daños
            indirectos ni por decisiones tomadas con base en la información de la app.
            Nuestra responsabilidad total se limita, como máximo, a los montos que nos
            hayas pagado en los 12 meses previos (hoy: cero, el servicio es gratuito).
          </p>

          <H n="10">Cambios y contacto</H>
          <p>
            Podemos actualizar estos términos publicando la nueva versión en esta página.
            Para consultas escribinos a{" "}
            <a className="font-medium text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            . Rigen las leyes de la República Argentina.
          </p>
        </div>
      </main>
    </div>
  );
}
