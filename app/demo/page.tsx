'use client';

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";
import {
  calculateTotals,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type Transaction,
  type TransactionType,
} from "@/lib/firebase/transactions";
import { useFx } from "@/lib/fx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionList } from "@/components/transactions/transaction-list";
import { ShadcnBars, ShadcnDonut, ShadcnTrend } from "@/components/reports/shadcn-variants";
import { bucketize, buildCumulative } from "@/components/reports/report-dashboard";
import type { ChartConfig } from "@/components/ui/chart";
import { endOfDay, startOfMonth } from "date-fns";
import { ArrowLeft, Plus, TrendDown, TrendUp, Wallet } from "@phosphor-icons/react";
import { cn } from "cn";

// ── Demo sin cuenta: todo vive en memoria (useState) y se pierde al recargar.
// No hay Firebase acá: ni lectura ni escritura, solo funciones puras
// (calculateTotals) y componentes de presentación (TransactionList). ──────────

function demoDate(daysAgo: number): Timestamp {
  const now = new Date();
  const day = Math.max(1, now.getDate() - daysAgo);
  return Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), day, 12));
}

function seed(): Transaction[] {
  const base = {
    familyId: "demo",
    createdBy: "demo",
    createdByName: "Vos",
    createdByPhoto: "",
    updatedAt: null,
  } as const;
  // Reparto proporcional a los días transcurridos del mes: los gráficos
  // quedan cargados cualquier día que se abra la demo.
  const now = new Date();
  const span = Math.max(1, now.getDate() - 1);
  const at = (frac: number) => demoDate(Math.round(frac * span));
  const rows: Omit<Transaction, "id">[] = [
    { ...base, amount: 850000, type: "income", category: "Sueldo", description: "Sueldo del mes", date: at(1) },
    { ...base, amount: 320000, type: "expense", category: "Vivienda", description: "Alquiler", date: at(0.95) },
    { ...base, amount: 145000, type: "expense", category: "Supermercado", description: "Compra grande", date: at(0.88) },
    { ...base, amount: 28000, type: "expense", category: "Impuestos", description: "ABL", date: at(0.82) },
    { ...base, amount: 120000, type: "income", category: "Ventas", description: "Venta bici usada", date: at(0.75) },
    { ...base, amount: 55000, type: "expense", category: "Educación", description: "Cuota curso", date: at(0.68) },
    { ...base, amount: 98000, type: "expense", category: "Supermercado", description: "Compra semanal", date: at(0.6) },
    { ...base, amount: 22000, type: "expense", category: "Servicios", description: "Luz", date: at(0.53) },
    { ...base, amount: 25000, type: "expense", category: "Transporte", description: "SUBE", date: at(0.45) },
    { ...base, amount: 31000, type: "expense", category: "Salud", description: "Farmacia", date: at(0.38) },
    { ...base, amount: 15000, type: "expense", category: "Servicios", description: "Internet", date: at(0.3) },
    { ...base, amount: 38000, type: "expense", category: "Supermercado", description: "Verdulería", date: at(0.23) },
    { ...base, amount: 24000, type: "expense", category: "Ocio", description: "Cine", date: at(0.15) },
    { ...base, amount: 18000, type: "expense", category: "Transporte", description: "Taxi", date: at(0.08) },
    { ...base, amount: 42000, type: "expense", category: "Ocio", description: "Cena con amigos", date: at(0) },
  ];
  return rows
    .map((r, i) => ({ ...r, id: `demo-seed-${i}` }))
    .sort((a, b) => b.date.toMillis() - a.date.toMillis());
}

const DONUT_COLORS = ["#16a34a", "#0d9488", "#ca8a04", "#ea580c", "#7c3aed", "#db2777", "#64748b"];

export default function DemoPage() {
  const [items, setItems] = useState<Transaction[]>(seed);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [pieType, setPieType] = useState<"expense" | "income">("expense");
  const idSeq = useRef(0);

  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");

  const { fmt, size } = useFx();
  const totals = useMemo(() => calculateTotals(items), [items]);
  const monthBalance = totals.monthIncome - totals.monthExpense;
  const monthItems = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return items.filter((t) => {
      const d = t.date.toDate();
      return d.getMonth() === m && d.getFullYear() === y;
    });
  }, [items]);

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Métricas de los datos de prueba (mismo cálculo que Reportes).
  const rangeFrom = useMemo(() => startOfMonth(new Date()), []);
  const rangeTo = useMemo(() => new Date(), []);
  const buckets = useMemo(() => bucketize(items, rangeFrom, rangeTo), [items, rangeFrom, rangeTo]);
  const cumulative = useMemo(() => buildCumulative(items, rangeFrom, rangeTo), [items, rangeFrom, rangeTo]);
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    const fromMs = rangeFrom.getTime();
    // Fin del día: incluye lo recién agregado aunque el rango se capturó antes.
    const toMs = endOfDay(rangeTo).getTime();
    for (const t of items) {
      if (t.type !== pieType) continue;
      const ms = t.date.toDate().getTime();
      if (ms < fromMs || ms > toMs) continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6).reduce((acc, [, v]) => acc + v, 0);
    const out = top.map(([name, value], i) => ({
      name,
      value: Math.round(value * 100) / 100,
      fill: DONUT_COLORS[i % DONUT_COLORS.length],
    }));
    if (rest > 0) {
      out.push({ name: "Otras", value: Math.round(rest * 100) / 100, fill: DONUT_COLORS[6] });
    }
    return out;
  }, [items, pieType, rangeFrom, rangeTo]);
  const pieConfig = useMemo(
    () =>
      Object.fromEntries(byCategory.map((c) => [c.name, { label: c.name, color: c.fill }])) as ChartConfig,
    [byCategory]
  );
  const hasChartData = buckets.some((b) => b.ingresos !== 0 || b.egresos !== 0);

  const openCreate = () => {
    setEditing(null);
    setType("expense");
    setAmount("");
    setCategory("");
    setDescription("");
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setType(t.type);
    setAmount(String(t.amount));
    setCategory(t.category);
    setDescription(t.description);
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const parsed = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFormError("Ingresá un monto mayor a 0.");
      return;
    }
    if (!category) {
      setFormError("Elegí una categoría.");
      return;
    }
    if (description.length > 140) {
      setFormError("La descripción no puede superar 140 caracteres.");
      return;
    }
    const rounded = Math.round(parsed * 100) / 100;
    if (editing) {
      setItems((prev) =>
        prev
          .map((t) =>
            t.id === editing.id
              ? { ...t, amount: rounded, type, category, description: description.trim() }
              : t
          )
          .sort((a, b) => b.date.toMillis() - a.date.toMillis())
      );
    } else {
      idSeq.current += 1;
      const created: Transaction = {
        id: `demo-${Date.now()}-${idSeq.current}`,
        familyId: "demo",
        createdBy: "demo",
        createdByName: "Vos",
        createdByPhoto: "",
        amount: rounded,
        type,
        category,
        description: description.trim(),
        date: Timestamp.now(),
        updatedAt: null,
      };
      setItems((prev) => [created, ...prev].sort((a, b) => b.date.toMillis() - a.date.toMillis()));
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 pb-32 md:p-8 md:pb-8">
        <header className="border-b pb-4">
          <Link href="/" className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="size-3" /> Pesify
          </Link>
          <div className="mt-1 flex items-center justify-between gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Demo</h1>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600">
              Sin cuenta
            </span>
          </div>
          <p className="text-muted-foreground">
            Probá cargar, editar y borrar movimientos.
          </p>
        </header>

        {/* Resumen */}
        <div className="grid gap-4">
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium opacity-90">Disponible del mes</CardTitle>
              <Wallet className="h-4 w-4 opacity-90" />
            </CardHeader>
            <CardContent>
              <div className={`font-bold tracking-tight tabular-nums ${size(fmt(monthBalance), "4xl")}`}>
                {fmt(monthBalance)}
              </div>
              <p className="mt-1 text-xs opacity-80">
                {totals.monthCount} movimiento{totals.monthCount === 1 ? "" : "s"} este mes
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos (mes)</CardTitle>
                <TrendUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className={`font-bold text-green-600 tabular-nums ${size(fmt(totals.monthIncome))}`}>
                  {fmt(totals.monthIncome)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gastos (mes)</CardTitle>
                <TrendDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className={`font-bold text-red-600 tabular-nums ${size(fmt(totals.monthExpense))}`}>
                  {fmt(totals.monthExpense)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Movimientos */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Movimientos del mes</h2>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" weight="bold" /> Agregar
            </Button>
          </div>
          <Card>
            <CardContent>
              <TransactionList
                transactions={monthItems}
                loading={false}
                error={null}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            </CardContent>
          </Card>
        </section>

        {/* Métricas de los datos de prueba */}
        <section>
          <div className="mb-2">
            <h2 className="text-lg font-semibold">Métricas</h2>
            <p className="text-sm text-muted-foreground">
              Se recalculan solas con lo que agregues, edites o borres.
            </p>
          </div>
          {!hasChartData ? (
            <Card>
              <CardContent>
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sin datos para graficar. Agregá un movimiento.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ingresos vs egresos</CardTitle>
                  <CardDescription>Del mes en curso</CardDescription>
                </CardHeader>
                <CardContent>
                  <ShadcnBars data={buckets} />
                </CardContent>
              </Card>

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
                    <ShadcnDonut
                      data={byCategory}
                      config={pieConfig}
                      totalLabel={pieType === "expense" ? "Gastado" : "Ingresado"}
                    />
                  )}
                </CardContent>
              </Card>

              {cumulative.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Evolución del saldo</CardTitle>
                    <CardDescription>Neto acumulado del período</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ShadcnTrend data={cumulative} />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </section>

        {/* CTA */}
        <Card className="border-primary">
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="font-bold">¿Te gusta? Guardá tus datos de verdad</p>
            <p className="text-sm text-muted-foreground">
              Creá tu cuenta gratis: tus movimientos se sincronizan y no se borran.
            </p>
            <Link
              href="/login"
              className="mt-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground"
            >
              Crear mi cuenta gratis
            </Link>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
            <DialogDescription>Solo vive en esta página: se borra al recargar.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid gap-4">
            {formError && <p className="text-sm font-medium text-red-500">{formError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={type === "expense" ? "default" : "outline"}
                className={cn("w-full", type === "expense" && "bg-red-600 hover:bg-red-600/90")}
                onClick={() => { setType("expense"); setCategory(""); }}
              >
                Gasto
              </Button>
              <Button
                type="button"
                variant={type === "income" ? "default" : "outline"}
                className={cn("w-full", type === "income" && "bg-green-600 hover:bg-green-600/90")}
                onClick={() => { setType("income"); setCategory(""); }}
              >
                Ingreso
              </Button>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="demo-amount">Monto (ARS)</Label>
              <Input
                id="demo-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="demo-category">Categoría</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
                <SelectTrigger id="demo-category" className="w-full">
                  <SelectValue placeholder="Elegí" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="demo-desc">Detalle (opcional)</Label>
              <Input
                id="demo-desc"
                maxLength={140}
                placeholder="Ej: Supermercado"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">
                {editing ? "Guardar cambios" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
