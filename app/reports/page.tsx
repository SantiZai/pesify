import { redirect } from "next/navigation";

// Los reportes viven en la pestaña Familia (/family#reportes).
export default function ReportsPage() {
  redirect("/family");
}
