import { initialOf } from "@/lib/format";
import { cn } from "cn";

type Props = {
  name: string;
  photoURL?: string | null;
  className?: string;
};

/** Foto del usuario (Google) o inicial como respaldo. */
export function Avatar({ name, photoURL, className }: Props) {
  if (photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoURL}
        alt={name}
        referrerPolicy="no-referrer"
        className={cn("shrink-0 rounded-full object-cover", className ?? "size-9")}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold",
        className ?? "size-9"
      )}
      aria-label={name}
    >
      {initialOf(name)}
    </span>
  );
}
