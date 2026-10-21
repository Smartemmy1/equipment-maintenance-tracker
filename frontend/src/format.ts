import type { Category, Criticality, InspectionResult, Severity } from "./types";

export const CATEGORY_LABELS: Record<Category, string> = {
  pump: "Pump",
  compressor: "Compressor",
  separator: "Separator",
  heat_exchanger: "Heat exchanger",
  valve: "Valve",
  generator: "Generator",
  tank: "Tank",
};

export const CRITICALITY_LABELS: Record<Criticality, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const RESULT_LABELS: Record<InspectionResult, string> = {
  pass: "Passed",
  pass_with_findings: "Passed with findings",
  fail: "Failed",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  minor: "Minor",
  major: "Major",
  critical: "Critical",
};

export const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Never";

export const fmtLongDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

/** "Due today", "Due in 5 days", "12 days overdue" */
export function dueLabel(days: number): string {
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 0) return `Due in ${days} days`;
  return days === -1 ? "1 day overdue" : `${-days} days overdue`;
}

export const fmtHours = (h: number | null) =>
  h == null ? "–" : `${new Intl.NumberFormat("en-CA", { maximumFractionDigits: 1 }).format(h)} h`;

export const fmtPct = (f: number) => `${(f * 100).toFixed(1)}%`;

export const todayIso = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // local date, not UTC
  return d.toISOString().slice(0, 10);
};
