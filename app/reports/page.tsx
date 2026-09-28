'use client';

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { useTransactions, type Transaction } from "@/lib/firebase/transactions";
import { formatCompactMoney, formatMoney, moneySizeClass } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopNav } from "@/components/desktop-nav";
import { CalendarBlank, CaretDown, CaretUp, DownloadSimple, Minus } from "@phosphor-icons/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "cn";

// ── Helpers ──────────────────────────────────────────────────────────────────

type Range = { from: Date; to: Date };

const PRESETS: { label: string; value: () => Range }[] = [
  { label: "Este mes", value: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "Últimos 30 días", value: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "Últimos 3 meses", value: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
  { label: "Este año", value: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

function inRange(t: Transaction, from: Date, to: Date): boolean {
  const d = t.date.toDate().getTime();
  return d >= startOfDay(from).getTime() && d <= endOfDay(to).getTime();
}

type Bucket = { key: string; label: string; ingresos: number; egresos: number };

function bucketize(items: Transaction[], from: Date, to: Date): Bucket[] {
  const days = differenceInCalendarDays(to, from) + 1;
  const round = (n: number) => Math.round(n * 100) / 100;

  const sumRange = (startMs: number, endMs: number) => {
    let ingresos = 0;
    let egresos = 0;
    for (const t of items) {
      const ms = t.date.toDate().getTime();
      if (ms < startMs || ms > endMs) continue;
      if (t.type === "income") ingresos += t.amount;
      else egresos += t.amount;
    }
    return { ingresos: round(ingresos), egresos: round(egresos) };
  };

  // Por día en rangos cortos (máx. 12 barras).
  if (days <= 12) {
    return eachDayOfInterval({ start: from, end: to }).map((d) => ({
      key: format(d, "yyyy-MM-dd"),
      label: format(d, "d MMM", { locale: es }),
      ...sumRange(startOfDay(d).getTime(), endOfDay(d).getTime()),
    }));
  }

  // Por semana en rangos medios (máx. 12 barras).
  if (days <= 84) {
    return eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }).map((w) => {
      const start = startOfWeek(w, { weekStartsOn: 1 });
      const end = endOfDay(new Date(Math.min(start.getTime() + 6 * 86400000, endOfDay(to).getTime())));
      return {
        key: format(start, "yyyy-ww"),
        label: format(start, "d MMM", { locale: es }),
        ...sumRange(start.getTime(), end.getTime()),
      };
    });
  }

  // Por mes (o grupos de meses) para que nunca haya más de 12 barras.
  const months = eachMonthOfInterval({ start: startOfMonth(from), end: to });
  const chunk = Math.ceil(months.length / 12);
  const groups: Date[][] = [];
  for (let i = 0; i < months.length; i += chunk) {
    groups.push(months.slice(i, i + chunk));
  }
  return groups.map((g) => {
    const first = g[0];
    const last = g[g.length - 1];
    const { ingresos, egresos } = sumRange(startOfMonth(first).getTime(), endOfMonth(last).getTime());
    return {
      key: format(first, "yyyy-MM"),
      label:
        g.length === 1
          ? format(first, "MMM yy", { locale: es })
          : `${format(first, "MMM", { locale: es })}–${format(last, "MMM yy", { locale: es })}`,
      ingresos,
      egresos,
    };
  });
}

const PIE_COLORS = ["#16a34a", "#0d9488", "#ca8a04", "#ea580c", "#7c3aed", "#db2777", "#64748b"];

const barConfig = {
  ingresos: { label: "Ingresos", color: "#16a34a" },
  egresos: { label: "Egresos", color: "#dc2626" },
} satisfies ChartConfig;

const balanceConfig = {
  saldo: { label: "Saldo acumulado", color: "#16a34a" },
} satisfies ChartConfig;

// ── Página ───────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user, profile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preset, setPreset] = useState("Este mes");
  const [range, setRange] = useState<Range>({ from: startOfMonth(new Date()), to: new Date() });
  const [pieType, setPieType] = useState<"expense" | "income">("expense");
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Borrador del rango mientras el calendario está abierto: así el primer
  // click se pinta de inmediato y se puede navegar de mes antes del segundo.
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);

  const familyId = profile?.currentFamilyId ?? null;
  const { transactions, loading } = useTransactions(familyId);

  const filtered = useMemo(
    () => transactions.filter((t) => inRange(t, range.from, range.to)),
    [transactions, range]
  );

  const buckets = useMemo(() => bucketize(filtered, range.from, range.to), [filtered, range]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, balance: income - expense, count: filtered.length };
  }, [filtered]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filtered) {
      if (t.type !== pieType) continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6).reduce((acc, [, v]) => acc + v, 0);
    const out = top.map(([name, value], i) => ({
      name,
      value: Math.round(value * 100) / 100,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));
    if (rest > 0) {
      out.push({ name: "Otras", value: Math.round(rest * 100) / 100, fill: PIE_COLORS[6] });
    }
    return out;
  }, [filtered, pieType]);

  const pieConfig = useMemo(
    () =>
      Object.fromEntries(byCategory.map((c) => [c.name, { label: c.name, color: c.fill }])) as ChartConfig,
    [byCategory]
  );

  const cumulative = useMemo(() => {
    const asc = [...filtered].sort((a, b) => a.date.toMillis() - b.date.toMillis());
    return asc.reduce<{ key: string; label: string; saldo: number }[]>((out, t) => {
      const prev = out.length > 0 ? out[out.length - 1].saldo : 0;
      const saldo = Math.round((prev + (t.type === "income" ? t.amount : -t.amount)) * 100) / 100;
      return [
        ...out,
        {
          key: `${t.id}`,
          label: format(t.date.toDate(), "d MMM", { locale: es }),
          saldo,
        },
      ];
    }, []);
  }, [filtered]);

  const topCategory = byCategory[0]?.name ?? "—";
  const avgDailyExpense = useMemo(() => {
    const days = Math.max(1, differenceInCalendarDays(range.to, range.from) + 1);
    return totals.expense / days;
  }, [totals, range]);

  // Mes actual vs anterior (independiente del filtro de fechas).
  const monthCompare = useMemo(() => {
    const now = new Date();
    const curStart = startOfMonth(now).getTime();
    const prevStart = startOfMonth(subMonths(now, 1)).getTime();
    const prevEnd = endOfMonth(subMonths(now, 1)).getTime();
    const cur = { income: 0, expense: 0 };
    const prev = { income: 0, expense: 0 };
    for (const t of transactions) {
      const ms = t.date.toDate().getTime();
      const slot = ms >= curStart ? cur : ms >= prevStart && ms <= prevEnd ? prev : null;
      if (!slot) continue;
      if (t.type === "income") slot.income += t.amount;
      else slot.expense += t.amount;
    }
    const row = (label: string, curV: number, prevV: number, invert: boolean) => {
      const diff = curV - prevV;
      const pct = prevV !== 0 ? (diff / Math.abs(prevV)) * 100 : null;
      const good = diff === 0 ? null : invert ? diff < 0 : diff > 0;
      return { label, curV, prevV, diff, pct, good };
    };
    return [
      row("Ingresos", cur.income, prev.income, false),
      row("Gastos", cur.expense, prev.expense, true),
      row("Balance", cur.income - cur.expense, prev.income - prev.expense, false),
    ];
  }, [transactions]);

  const applyPreset = (label: string, value: Range) => {
    setPreset(label);
    setRange({ from: startOfDay(value.from), to: endOfDay(value.to) });
  };

  const applyCalendar = (r: DateRange | undefined) => {
    setDraft(r);
    // Recién con los dos clicks (inicio y fin) se aplica y se cierra.
    if (r?.from && r?.to) {
      setPreset("Personalizado");
      setRange({ from: startOfDay(r.from), to: endOfDay(r.to) });
      setCalendarOpen(false);
      setDraft(undefined);
    }
  };

  const handleCalendarOpen = (open: boolean) => {
    setCalendarOpen(open);
    // Se abre siempre vacío: si precargáramos el rango aplicado, day-picker
    // completaría el rango con el primer click y se cerraría (min=0).
    // El rango aplicado se sigue viendo en el botón del filtro.
    if (open) setDraft(undefined);
    else setDraft(undefined);
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Error al cerrar sesión:", e);
      setLoggingOut(false);
    }
  };

  // CSV compatible con Excel en español (separador ; y BOM UTF-8).
  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const esc = (v: string | number) => {
      const s = String(v).replace(/"/g, '""');
      return /[;"\n]/.test(s) ? `"${s}"` : s;
    };
    const fmtDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const lines = [
      "fecha;tipo;categoria;detalle;monto;registrado_por",
      ...[...filtered]
        .sort((a, b) => a.date.toMillis() - b.date.toMillis())
        .map((t) =>
          [
            fmtDate(t.date.toDate()),
            t.type === "income" ? "ingreso" : "egreso",
            esc(t.category),
            esc(t.description),
            t.amount.toFixed(2).replace(".", ","),
            esc(t.createdByName),
          ].join(";")
        ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pesify-${format(range.from, "yyyyMMdd")}-${format(range.to, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <DesktopNav
        onAdd={() => setDialogOpen(true)}
        displayName={profile?.displayName ?? user?.email ?? ""}
        photoURL={profile?.photoURL ?? user?.photoURL ?? null}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 pb-32 md:p-8 md:pb-8">
        <header className="border-b pb-4">
          <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground">Cómo se mueve la plata de tu familia</p>
        </header>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              variant={preset === p.label ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset(p.label, p.value())}
            >
              {p.label}
            </Button>
          ))}
          <Popover open={calendarOpen} onOpenChange={handleCalendarOpen}>
            <PopoverTrigger
              className={cn(
                "group/button inline-flex h-7 items-center gap-1.5 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium",
                preset === "Personalizado" && "border-primary text-primary"
              )}
            >
              <CalendarBlank className="size-3.5" />
              {preset === "Personalizado"
                ? `${format(range.from, "d MMM", { locale: es })} – ${format(range.to, "d MMM", { locale: es })}`
                : "Elegir fechas"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                locale={es}
                selected={draft}
                onSelect={applyCalendar}
                numberOfMonths={1}
                // min=1: el primer click solo fija el inicio (sin esto,
                // day-picker devuelve día único completo y se cerraría).
                min={1}
                // Tras el primer click, el segundo no puede ser anterior.
                disabled={draft?.from ? { before: draft.from } : undefined}
              />
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                {draft?.from && !draft?.to
                  ? `Desde el ${format(draft.from, "d MMM", { locale: es })}: elegí la fecha final`
                  : "Elegí la fecha inicial del rango"}
              </p>
            </PopoverContent>
            </Popover>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={loading || filtered.length === 0}
            title="Descargar los movimientos del rango en CSV"
          >
            <DownloadSimple className="size-4" /> CSV
          </Button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cargando movimientos...</p>
        ) : (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Ingresos</CardDescription>
                  <CardTitle className={`tabular-nums text-green-600 ${moneySizeClass(totals.income)}`}>{formatMoney(totals.income)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Gastos</CardDescription>
                  <CardTitle className={`tabular-nums text-red-600 ${moneySizeClass(totals.expense)}`}>{formatMoney(totals.expense)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Balance</CardDescription>
                  <CardTitle className={`tabular-nums ${moneySizeClass(totals.balance)}`}>{formatMoney(totals.balance)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Gasto prom./día</CardDescription>
                  <CardTitle className={`tabular-nums ${moneySizeClass(avgDailyExpense)}`}>{formatMoney(avgDailyExpense)}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Comparador mes actual vs anterior */}
            <Card>
              <CardHeader>
                <CardTitle>Este mes vs anterior</CardTitle>
                <CardDescription>
                  {format(new Date(), "MMMM yyyy", { locale: es })} frente al mes pasado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {monthCompare.map((r) => (
                    <li key={r.label} className="flex items-center gap-2 py-2.5 text-sm">
                      <span className="flex-1 font-medium">{r.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatCompactMoney(r.prevV)}
                      </span>
                      <span className="w-1 text-center text-muted-foreground">→</span>
                      <span className="w-24 text-right font-bold tabular-nums">
                        {formatCompactMoney(r.curV)}
                      </span>
                      <span
                        className={cn(
                          "flex w-20 items-center justify-end gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                          r.good === null && "bg-muted text-muted-foreground",
                          r.good === true && "bg-green-600/10 text-green-700",
                          r.good === false && "bg-red-600/10 text-red-600"
                        )}
                        title={`${r.diff >= 0 ? "+" : ""}${formatMoney(r.diff)} vs mes anterior`}
                      >
                        {r.pct === null || r.diff === 0 ? (
                          <Minus className="size-3" />
                        ) : r.diff > 0 ? (
                          <CaretUp className="size-3" weight="bold" />
                        ) : (
                          <CaretDown className="size-3" weight="bold" />
                        )}
                        {r.pct === null ? "—" : `${Math.abs(Math.round(r.pct))}%`}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Barras: ingresos vs egresos */}
            <Card>
              <CardHeader>
                <CardTitle>Ingresos vs egresos</CardTitle>
                <CardDescription>
                  {totals.count} movimientos · {topCategory !== "—" ? `top: ${topCategory}` : "sin datos"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {buckets.every((b) => b.ingresos === 0 && b.egresos === 0) ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Sin movimientos en este rango.
                  </p>
                ) : (
                  <ChartContainer config={barConfig} className="h-64 w-full">
                    <BarChart data={buckets} margin={{ left: 0, right: 8 }} barCategoryGap="25%">
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => formatCompactMoney(v)}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value))} />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="egresos" fill="var(--color-egresos)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Torta por categoría */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Por categoría</CardTitle>
                  <CardDescription>En qué se va (o entra) la plata</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={pieType === "expense" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPieType("expense")}
                  >
                    Gastos
                  </Button>
                  <Button
                    variant={pieType === "income" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPieType("income")}
                  >
                    Ingresos
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {byCategory.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sin datos.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
                    <ChartContainer config={pieConfig} className="mx-auto h-56 w-full max-w-64">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88} paddingAngle={2}>
                          {byCategory.map((c) => (
                            <Cell key={c.name} fill={c.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <ul className="space-y-2">
                      {byCategory.map((c) => (
                        <li key={c.name} className="flex items-center gap-2 text-sm">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.fill }} />
                          <span className="flex-1 truncate">{c.name}</span>
                          <span className="font-bold">{formatMoney(c.value)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tendencia del saldo */}
            {cumulative.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Evolución del saldo</CardTitle>
                  <CardDescription>Acumulado en el rango elegido</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={balanceConfig} className="h-52 w-full">
                    <AreaChart data={cumulative} margin={{ left: 0, right: 8 }}>
                      {/* Verde debajo de la línea, blanco arriba (fondo) */}
                      <defs>
                        <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#16a34a" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => formatCompactMoney(v)}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value))} />}
                      />
                      <Area
                        dataKey="saldo"
                        // linear: monotone se sobrepasa en caídas bruscas
                        // (saldo a negativo) y el relleno se corta con huecos.
                        type="linear"
                        fill="url(#saldoFill)"
                        stroke="#16a34a"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <AddTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        familyId={familyId}
        uid={user?.uid ?? null}
        displayName={profile?.displayName ?? user?.displayName ?? null}
        editing={null}
      />

      <BottomNav onAdd={() => setDialogOpen(true)} />
    </div>
  );
}
