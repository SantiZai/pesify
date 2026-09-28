import Link from "next/link";
import Image from "next/image";
import {
  Airplane,
  ArrowRight,
  ChartBar,
  CurrencyDollar,
  DownloadSimple,
  PiggyBank,
  Receipt,
  Repeat,
  ShieldCheck,
  Tag,
  UsersThree,
  Wallet,
  WifiHigh,
} from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_VERSION } from "@/lib/version";

const FEATURES = [
  {
    icon: WifiHigh,
    title: "Funciona sin internet",
    description: "Registrá gastos offline. Todo se sincroniza solo al reconectar.",
  },
  {
    icon: UsersThree,
    title: "Finanzas en familia",
    description: "Un saldo y un historial compartidos en tiempo real entre miembros.",
  },
  {
    icon: Receipt,
    title: "Impuestos mensuales",
    description: "Se repiten solos cada mes. Editá monto y vencimiento de cada boleta y tildá al pagar.",
  },
  {
    icon: Repeat,
    title: "Recurrencias automáticas",
    description: "Sueldo, alquiler y servicios se generan solos cada mes, incluso con fecha pasada.",
  },
  {
    icon: ChartBar,
    title: "Reportes claros",
    description: "Gráficos por fecha y categoría para ver a dónde va la plata.",
  },
  {
    icon: PiggyBank,
    title: "Presupuestos y ahorro",
    description: "Límites por categoría con alertas y meta de ahorro mensual.",
  },
  {
    icon: Airplane,
    title: "Viajes compartidos",
    description: "Unite con un código, dividí gastos y mirá quién le debe a quién.",
  },
  {
    icon: CurrencyDollar,
    title: "Multi-moneda real",
    description: "Gastos del viaje en ARS, USD, BRL o EUR. Cada moneda salda por su lado, sin conversiones.",
  },
  {
    icon: Tag,
    title: "Categorías a tu medida",
    description: "Base en español más tus categorías personalizadas de gastos e ingresos.",
  },
  {
    icon: ShieldCheck,
    title: "Privado por diseño",
    description: "Tus datos solo los ve tu familia. Sin publicidad ni rastreadores.",
  },
  {
    icon: DownloadSimple,
    title: "Instalable como app",
    description: "Sumala a tu pantalla de inicio desde el navegador, en Android, iPhone y PC.",
  },
  {
    icon: Wallet,
    title: "Tu moneda de vista",
    description: "Elegí ver todo en pesos, dólares, reales o euros.",
  },
];

const TUTORIAL = [
  {
    n: "1",
    title: "Creá tu cuenta",
    description:
      "Entrá con Google o con un enlace a tu email. Se crea tu familia Personal y tu saldo arranca en cero.",
  },
  {
    n: "2",
    title: "Registrá tu primer movimiento",
    description:
      "Tocá + , elegí ingreso o egreso, poné el monto y la categoría. Ya aparece en tu Disponible del mes.",
  },
  {
    n: "3",
    title: "Automatizá lo mensual",
    description:
      "En Cuentas del mes agregá impuestos: se repiten solos y cada boleta la editás al llegar. En Recurrentes, el sueldo y los fijos se generan solos.",
  },
  {
    n: "4",
    title: "Invitá a tu familia",
    description:
      "Compartí tu código desde Familia. Todos ven el mismo saldo e historial al instante, incluso sin internet.",
  },
  {
    n: "5",
    title: "Viajá y dividí gastos",
    description:
      "Creá un viaje, compartí el código y cargá cada gasto en su moneda. El balance dice quién le debe a quién en cada moneda.",
  },
];

const FAQ = [
  {
    q: "¿Funciona sin internet?",
    a: "Sí. La app es offline-first: registrás todo sin conexión y se sincroniza solo al reconectar, en todos los dispositivos de la familia.",
  },
  {
    q: "¿Quién ve mis datos?",
    a: "Solo los miembros de tu familia (saldos y movimientos) y los participantes de cada viaje (sus gastos y balances). Nada es público ni se vende.",
  },
  {
    q: "¿Cómo funcionan los impuestos mensuales?",
    a: "Los agregás una vez y aparecen todos los meses como pendientes. Cuando llega la boleta editás monto y vencimiento de ese mes, y al pagar la tildás: recién ahí descuenta del saldo.",
  },
  {
    q: "¿Puedo manejar dólares, reales y euros?",
    a: "En viajes, cada gasto va en su moneda (ARS, USD, BRL o EUR) y cada una salda por separado, sin conversiones. Además podés elegir la moneda de vista de tu familia.",
  },
  {
    q: "¿Cómo invito a alguien?",
    a: "Desde Familia compartís tu código para el día a día, o desde cada viaje su propio código. Quien lo tenga puede unirse: compartilo solo con gente de confianza.",
  },
  {
    q: "¿Es gratis? ¿Cómo borro mis datos?",
    a: "Sí, la v1.0 es gratis. Y tus datos son tuyos: podés borrar todo desde la app o pedir la eliminación completa desde Ajustes → Legales.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2 px-4">
          <Image src="/logo.png" alt="Pesify" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold tracking-tight">Pesify</span>
          <Link href="/login" className={buttonVariants({ size: "sm", className: "ml-auto" })}>
            Entrar <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4">
        {/* Hero */}
        <section className="flex flex-col items-center py-16 text-center md:py-24">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            v{APP_VERSION} · 100% offline · Gratis
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight md:text-6xl">
            Las finanzas de tu familia, bajo control
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Registrá ingresos y gastos sin conexión, automatizá impuestos y sueldos,
            dividí gastos de viajes en cualquier moneda y compartí todo con tu familia
            en tiempo real.
          </p>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Empezar gratis <ArrowRight className="size-4" />
            </Link>
            <a href="#tutorial" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Aprender a usarla
            </a>
          </div>
          <Link href="/demo" className="mt-4 text-sm font-medium text-primary hover:underline">
            o probá la demo sin crear cuenta →
          </Link>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 pb-16">
          <h2 className="text-center text-2xl font-bold tracking-tight">Todo lo que necesitás</h2>
          <p className="mt-2 text-center text-muted-foreground">
            Cada función pensada para el día a día de una familia real.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <f.icon className="size-5 text-primary" weight="duotone" />
                  </span>
                  <CardTitle className="mt-2 text-base">{f.title}</CardTitle>
                  <CardDescription>{f.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* Tutorial */}
        <section id="tutorial" className="scroll-mt-20 pb-16">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Aprendé a usarla en 5 pasos
          </h2>
          <p className="mt-2 text-center text-muted-foreground">
            De cero a familia organizada en minutos.
          </p>
          <div className="mx-auto mt-6 grid max-w-3xl gap-3">
            {TUTORIAL.map((s) => (
              <div key={s.n} className="flex gap-4 rounded-xl border p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {s.n}
                </span>
                <div>
                  <p className="font-bold">{s.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Crear mi cuenta <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 pb-16">
          <h2 className="text-center text-2xl font-bold tracking-tight">Preguntas frecuentes</h2>
          <div className="mx-auto mt-6 grid max-w-3xl gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-xl border px-4 py-3">
                <summary className="cursor-pointer font-bold marker:text-primary">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="pb-20">
          <div className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Empezá hoy, gratis y sin tarjeta
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm opacity-90">
              Tu familia, tus impuestos, tus viajes y tus monedas. Todo en un solo lugar,
              incluso sin internet.
            </p>
            <Link
              href="/login"
              className={buttonVariants({ size: "lg", variant: "secondary", className: "mt-6" })}
            >
              Crear mi cuenta <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Image src="/logo.png" alt="Pesify" width={24} height={24} className="rounded-md" />
            Pesify · Finanzas familiares offline · v{APP_VERSION}
          </span>
          <span className="ml-auto flex items-center gap-4">
            <Link href="/privacy" className="hover:underline">
              Privacidad
            </Link>
            <Link href="/terms" className="hover:underline">
              Términos
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
