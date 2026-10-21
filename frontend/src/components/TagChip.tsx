import type { Equipment } from "../types";

export type Condition = "out" | "overdue" | "due_soon" | "ok";

/** One condition per item: out of service outranks the inspection schedule. */
export function conditionOf(e: Pick<Equipment, "status" | "inspection_state">): Condition {
  return e.status === "out_of_service" ? "out" : e.inspection_state;
}

export const CONDITION_LABELS: Record<Condition, string> = {
  out: "Out of service",
  overdue: "Inspection overdue",
  due_soon: "Inspection due soon",
  ok: "In service",
};

/**
 * An equipment tag number drawn as the physical inspection tag hung on plant
 * equipment: the punched hole and colour show its condition at a glance.
 * The condition is also given in text (title + screen-reader label), never colour alone.
 */
export function TagChip({
  tag,
  condition,
  large = false,
}: {
  tag: string;
  condition: Condition;
  large?: boolean;
}) {
  return (
    <span
      className={`tagchip ${condition}${large ? " large" : ""}`}
      title={CONDITION_LABELS[condition]}
    >
      <span className="tagchip-hole" aria-hidden="true" />
      {tag}
      <span className="visually-hidden">, {CONDITION_LABELS[condition]}</span>
    </span>
  );
}

export function ConditionLabel({ condition }: { condition: Condition }) {
  return <span className={`condition ${condition}`}>{CONDITION_LABELS[condition]}</span>;
}
