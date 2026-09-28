"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase/config";
import { useAuth } from "./firebase/auth-context";

// ── Moneda de visualización por familia ──────────────────────────────────────
// Los montos se guardan en ARS (base). Cada familia elige moneda de display y
// una conversión manual: rateToArs = cuántos ARS vale 1 unidad de la moneda.

export const DEFAULT_CURRENCY = "ARS";

type FxPrefs = { currency: string; rateToArs: number };

const FxContext = createContext<FxPrefs>({ currency: DEFAULT_CURRENCY, rateToArs: 1 });

export function FxProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [prefs, setPrefs] = useState<FxPrefs>({ currency: DEFAULT_CURRENCY, rateToArs: 1 });

  useEffect(() => {
    const familyId = profile?.currentFamilyId;
    if (!familyId) return;
    const unsubscribe = onSnapshot(
      doc(db, "families", familyId),
      (snap) => {
        const data = snap.data();
        const currency = data && typeof data.currency === "string" ? data.currency : DEFAULT_CURRENCY;
        const rate = data && typeof data.rateToArs === "number" && data.rateToArs > 0 ? data.rateToArs : 1;
        setPrefs({ currency, rateToArs: rate });
      },
      () => setPrefs({ currency: DEFAULT_CURRENCY, rateToArs: 1 })
    );
    return () => unsubscribe();
  }, [profile?.currentFamilyId]);

  // Sin familia (logout) siempre ARS, sin setState en el efecto.
  const value = profile?.currentFamilyId ? prefs : { currency: DEFAULT_CURRENCY, rateToArs: 1 };
  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
}

function sizeFor(text: string, base: "2xl" | "4xl" = "2xl"): string {
  const len = text.length;
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

export function useFx() {
  const { currency, rateToArs } = useContext(FxContext);

  const formatters = useMemo(() => {
    let code = currency;
    try {
      // Valida el código (tira si no es ISO válido).
      new Intl.NumberFormat("es", { style: "currency", currency: code });
    } catch {
      code = DEFAULT_CURRENCY;
    }
    return {
      code,
      full: new Intl.NumberFormat("es", { style: "currency", currency: code, maximumFractionDigits: 2 }),
      compact: new Intl.NumberFormat("es", {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    };
  }, [currency]);

  return useMemo(
    () => ({
      currency: formatters.code,
      /** Monto (guardado en ARS) formateado en la moneda de la familia. */
      fmt: (amountArs: number) => formatters.full.format(amountArs / rateToArs),
      /** Corto para ejes ($1,2 M con el símbolo de la moneda). */
      fmtC: (amountArs: number) =>
        `${formatters.full.formatToParts(0).find((p) => p.type === "currency")?.value ?? "$"}${formatters.compact.format(amountArs / rateToArs)}`,
      /** Eje de gráficos: compacto SIN símbolo (la moneda va en el título).
       *  Así "1,2 M" entra siempre, sin importar el símbolo de cada entorno. */
      fmtAxis: (amountArs: number) => formatters.compact.format(amountArs / rateToArs),
      /** Achica el texto si no entra. */
      size: (text: string, base: "2xl" | "4xl" = "2xl") => sizeFor(text, base),
    }),
    [formatters, rateToArs]
  );
}
