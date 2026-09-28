"use client";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCompactMoney, formatMoney } from "@/lib/format";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

// ── Variantes estilo bloques oficiales de shadcn/ui ──────────────────────────
// (archivos nuevos: los gráficos actuales siguen intactos en reports/page.tsx)

export type Bucket = { key: string; label: string; ingresos: number; egresos: number };
export type Slice = { name: string; value: number; fill: string };
export type Point = { key: string; label: string; saldo: number };

const barConfig = {
  ingresos: { label: "Ingresos", color: "#16a34a" },
  egresos: { label: "Egresos", color: "#dc2626" },
} satisfies ChartConfig;

/** Barras verticales con etiquetas arriba (estilo shadcn "Bar Chart - Label").
 *  Solo dependen de `data`: el toggle de la dona no las afecta. */
export function ShadcnBars({ data }: { data: Bucket[] }) {
  // Aire arriba (+15%) para que las barras altas y sus etiquetas no se corten.
  const max = Math.max(1, ...data.flatMap((d) => [d.ingresos, d.egresos]));
  return (
    <ChartContainer config={barConfig} className="h-64 w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 8, top: 16 }} barCategoryGap="25%">
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis hide domain={[0, Math.ceil(max * 1.15)]} />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value))} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[6, 6, 0, 0]}>
          <LabelList
            dataKey="ingresos"
            position="top"
            formatter={(v: React.ReactNode) => (Number(v) > 0 ? formatCompactMoney(Number(v)) : "")}
            fontSize={10}
          />
        </Bar>
        <Bar dataKey="egresos" fill="var(--color-egresos)" radius={[6, 6, 0, 0]}>
          <LabelList
            dataKey="egresos"
            position="top"
            formatter={(v: React.ReactNode) => (Number(v) > 0 ? formatCompactMoney(Number(v)) : "")}
            fontSize={10}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Dona con total al centro (estilo shadcn "Pie Chart - Donut with Text"). */
export function ShadcnDonut({
  data,
  config,
  totalLabel,
}: {
  data: Slice[];
  config: ChartConfig;
  totalLabel: string;
}) {
  const total = data.reduce((acc, s) => acc + s.value, 0);
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
      <div className="relative mx-auto w-full max-w-64">
        <ChartContainer config={config} className="h-56 w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={88} paddingAngle={2} strokeWidth={0}>
              {data.map((s) => (
                <Cell key={s.name} fill={s.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums">{formatMoney(total)}</span>
          <span className="text-xs text-muted-foreground">{totalLabel}</span>
        </div>
      </div>
      <ul className="space-y-2">
        {data.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.fill }} />
            <span className="flex-1 truncate">{s.name}</span>
            <span className="font-bold tabular-nums">{formatMoney(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Área con degradado y línea marcada (estilo shadcn "Area Chart - Gradient"). */
export function ShadcnTrend({ data }: { data: Point[] }) {
  return (
    <ChartContainer
      config={{ saldo: { label: "Saldo acumulado", color: "#16a34a" } } satisfies ChartConfig}
      className="h-52 w-full"
    >
      <AreaChart accessibilityLayer data={data} margin={{ left: 0, right: 8 }}>
        <defs>
          <linearGradient id="shadcnSaldo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#16a34a" stopOpacity={0.05} />
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
          type="natural"
          fill="url(#shadcnSaldo)"
          stroke="#16a34a"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
