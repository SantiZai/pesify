import { Timestamp } from "firebase/firestore";
import { addTransaction } from "./transactions";
import { addRecurring } from "./recurring";
import { addCategory } from "./categories";
import { monthKeyOf, setBudget, spendingByCategory } from "./budgets";

// ── Generador de datos de prueba ─────────────────────────────────────────────
// Crea movimientos de ~4 meses, recurrencias, categorías y presupuestos para
// probar dashboard, reportes, recurrentes y presupuestos de una vez.

type SeedProgress = { done: number; total: number };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EXPENSE_POOL: { category: string; min: number; max: number; details: string[] }[] = [
  { category: "Supermercado", min: 4000, max: 28000, details: ["Compra semanal", "Verdulería", "Almacén", "Hiper"] },
  { category: "Transporte", min: 800, max: 6000, details: ["SUBE", "Nafta", "Taxi", "Peaje"] },
  { category: "Ocio", min: 2500, max: 18000, details: ["Cine", "Salida con amigos", "Streaming", "Juegos"] },
  { category: "Servicios", min: 3500, max: 22000, details: ["Luz", "Internet", "Gas", "Celular"] },
  { category: "Salud", min: 3000, max: 35000, details: ["Farmacia", "Consulta", "Análisis"] },
  { category: "Vivienda", min: 5000, max: 40000, details: ["Limpieza", "Arreglos", "Pintura"] },
  { category: "Mascotas", min: 2000, max: 12000, details: ["Alimento", "Veterinaria"] },
];

const INCOME_POOL = [
  { category: "Sueldo", min: 450000, max: 650000, details: ["Sueldo mensual"] },
  { category: "Freelance", min: 30000, max: 120000, details: ["Proyecto web", "Diseño logo", "Consultoría"] },
];

export async function seedDemoData(
  familyId: string,
  uid: string,
  displayName: string,
  onProgress?: (p: SeedProgress) => void
): Promise<string> {
  const rand = mulberry32(20260927);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const between = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100) / 100;

  const tasks: (() => Promise<unknown>)[] = [];

  // 1. Categorías personalizadas.
  tasks.push(() => addCategory(familyId, "Mascotas", "expense", uid).catch(() => null));
  tasks.push(() => addCategory(familyId, "Freelance", "income", uid).catch(() => null));

  // 2. ~70 movimientos en los últimos 120 días (ingresos escasos).
  const now = new Date();
  const created: { type: string; category: string; amount: number; date: Timestamp }[] = [];
  for (let i = 0; i < 70; i++) {
    const daysAgo = Math.floor(rand() * 120);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(12, 0, 0, 0);

    const isIncome = rand() < 0.12;
    const pool = isIncome ? pick(INCOME_POOL) : pick(EXPENSE_POOL);
    const amount = between(pool.min, pool.max);
    const tx = {
      familyId,
      createdBy: uid,
      createdByName: displayName,
      amount,
      type: (isIncome ? "income" : "expense") as "income" | "expense",
      category: pool.category,
      description: pick(pool.details),
      date,
    };
    created.push({ type: tx.type, category: tx.category, amount, date: Timestamp.fromDate(date) });
    tasks.push(() => addTransaction(tx));
  }

  // 3. Recurrencias (al abrir el dashboard se materializan las vencidas).
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  tasks.push(() =>
    addRecurring({
      familyId, createdBy: uid, createdByName: displayName,
      amount: 550000, type: "income", category: "Sueldo", description: "Sueldo mensual",
      frequency: "monthly", startDate: threeMonthsAgo,
    })
  );
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  tasks.push(() =>
    addRecurring({
      familyId, createdBy: uid, createdByName: displayName,
      amount: 180000, type: "expense", category: "Vivienda", description: "Alquiler",
      frequency: "monthly", startDate: twoMonthsAgo,
    })
  );
  tasks.push(() =>
    addRecurring({
      familyId, createdBy: uid, createdByName: displayName,
      amount: 9000, type: "expense", category: "Servicios", description: "Internet",
      frequency: "monthly", startDate: twoMonthsAgo,
    })
  );

  const total = tasks.length + 3; // +3 presupuestos al final
  let done = 0;
  const report = () => onProgress?.({ done, total });

  // Ejecuta de a 8 en paralelo para que sea rápido.
  for (let i = 0; i < tasks.length; i += 8) {
    await Promise.all(tasks.slice(i, i + 8).map((t) => t().catch(() => null)));
    done += Math.min(8, tasks.length - i);
    report();
  }

  // 4. Presupuestos del mes en curso calibrados: uno pasado, uno al límite, uno sano.
  const mk = monthKeyOf();
  const spending = spendingByCategory(created, mk);
  const sup = spending.get("Supermercado") ?? 30000;
  const trans = spending.get("Transporte") ?? 8000;
  const serv = spending.get("Servicios") ?? 15000;
  await setBudget(familyId, mk, "Supermercado", sup * 0.6, uid).catch(() => null);
  done++; report();
  await setBudget(familyId, mk, "Transporte", trans * 0.95, uid).catch(() => null);
  done++; report();
  await setBudget(familyId, mk, "Servicios", serv * 1.6, uid).catch(() => null);
  done++; report();

  return `Listo: ${created.length} movimientos, 3 recurrencias, 2 categorías y 3 presupuestos.`;
}
