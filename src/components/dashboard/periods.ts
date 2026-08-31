import { startOfMonth, subDays } from "date-fns";
import type { DateRange } from "@/components/analytics-section";

export type PeriodKey = "7j" | "30j" | "mois" | "tout";

export const PERIODS: { key: PeriodKey; label: string; compute: () => DateRange }[] = [
  { key: "7j", label: "7 j", compute: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { key: "30j", label: "30 j", compute: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { key: "mois", label: "Ce mois", compute: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { key: "tout", label: "Tout", compute: () => ({ from: null, to: null }) },
];
