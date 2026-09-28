"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarBlank } from "@phosphor-icons/react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateInput(v: string): Date {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/**
 * Selector de fecha con el Calendar de shadcn (igual que en Reportes).
 * Trabaja con strings "YYYY-MM-DD" como un input date nativo.
 */
export function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseDateInput(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
        <CalendarBlank className="size-4 shrink-0 text-muted-foreground" />
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected
            ? format(selected, "d 'de' MMMM 'de' yyyy", { locale: es })
            : "Elegí una fecha"}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={es}
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(toDateInputValue(d));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
