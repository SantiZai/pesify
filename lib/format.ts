// Formato de moneda y fecha en un solo lugar.
// Cambiá CURRENCY/LOCALE según el país (ej: "USD"/"es-MX", "EUR"/"es-ES").
export const CURRENCY = "ARS";
export const LOCALE = "es-AR";

const currencyFmt = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number): string {
  return currencyFmt.format(amount);
}

/** "R$ 150,00" / "US$ 20,00": monto en la moneda indicada, sin convertir. */
export function formatMoneyIn(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

const compactFmt = new Intl.NumberFormat(LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "$1,2 M": corto para ejes de gráficos donde el número largo desborda. */
export function formatCompactMoney(amount: number): string {
  return `$${compactFmt.format(amount)}`;
}

/** Clase de tamaño según el largo del monto: achica el texto si no entra. */
export function moneySizeClass(amount: number, base: "2xl" | "4xl" = "2xl"): string {
  const len = formatMoney(amount).length;
  if (base === "4xl") {
    if (len <= 12) return "text-4xl";
    if (len <= 16) return "text-3xl";
    if (len <= 22) return "text-2xl";
    return "text-xl";
  }
  if (len <= 13) return "text-2xl";
  if (len <= 17) return "text-xl";
  return "text-lg";
}

/** "12 ene" / "12 ene 2025" si no es del año actual. */
export function formatShortDate(d: Date, now = new Date()): string {
  const sameYear = d.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(d);
}

/** Inicial del nombre para el avatar ("María" -> "M"). */
export function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}
