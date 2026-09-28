import Link from "next/link";
import {
  ArrowRight,
  CalendarDots,
  ChartBar,
  PiggyBank,
  Repeat,
  UsersThree,
  Wallet,
  WifiHigh,
} from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    icon: WifiHigh,
    title: "Funciona sin internet",
    description: "Registrá gastos offline. Todo se sincroniza solo al reconectar.",
  },
  {
    icon: UsersThree,
    title: "Finanzas en familia",
    description: "Un saldo y un historial compartidos entre todos los miembros.",
  },
  {
    icon: ChartBar,
    title: "Reportes claros",
    description: "Gráficos por fecha y categoría para ver a dónde va la plata.",
  },
  {
    icon: Repeat,
    title: "Recurrencias automáticas",
    description: "Sueldo, alquiler y servicios se generan solos cada mes.",
  },
  {
    icon: PiggyBank,
    title: "Presupuestos mensuales",
    description: "Límites por categoría con alertas antes de pasarte.",
  },
  {
    icon: CalendarDots,
    title: "Instalable como app",
    description: "Sumala a tu pantalla de inicio desde el navegador.",
  },
];

const STEPS = [
  { n: "1", title: "Creá tu cuenta", description: "Con email o Google, en segundos." },
  { n: "2", title: "Registrá movimientos", description: "Ingresos y egresos con categorías." },
  { n: "3", title: "Invitá a tu familia", description: "Compartí tu código y listo." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2 px-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-5" weight="fill" />
          </span>
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
            100% offline · Gratis
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight md:text-6xl">
            Las finanzas de tu familia, bajo control
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Registrá ingresos y gastos sin conexión, compartilos con tu familia y entendé
            a dónde va la plata con reportes simples.
          </p>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Empezar gratis <ArrowRight className="size-4" />
            </Link>
            <a href="#features" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Ver cómo funciona
            </a>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 pb-16">
          <h2 className="text-center text-2xl font-bold tracking-tight">Todo lo que necesitás</h2>
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

        {/* Pasos */}
        <section className="pb-16">
          <h2 className="text-center text-2xl font-bold tracking-tight">Empezá en 3 pasos</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-3 rounded-xl border p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                  {s.n}
                </span>
                <div>
                  <p className="font-bold">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
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
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wallet className="size-4" weight="fill" />
          </span>
          Pesify · Finanzas familiares offline
        </div>
      </footer>
    </div>
  );
}
