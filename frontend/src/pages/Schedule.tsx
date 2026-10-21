import { Link } from "react-router-dom";
import { api } from "../api";
import { conditionOf, TagChip } from "../components/TagChip";
import { CRITICALITY_LABELS, dueLabel, fmtDate } from "../format";
import type { Equipment } from "../types";
import { useApi } from "../useApi";

const GROUPS: { title: string; test: (days: number) => boolean; empty: string }[] = [
  { title: "Overdue", test: (d) => d < 0, empty: "Nothing overdue." },
  { title: "This week", test: (d) => d >= 0 && d < 7, empty: "Nothing due this week." },
  { title: "Next three weeks", test: (d) => d >= 7 && d < 28, empty: "Nothing due." },
  { title: "Later this quarter", test: (d) => d >= 28 && d < 90, empty: "Nothing due." },
];

/** The inspection plan for the next 90 days, grouped so a planner can book work. */
export function Schedule() {
  const { data, error } = useApi(() => api.equipment(), []);

  if (error) {
    return (
      <p className="banner-error" role="alert">
        Could not load the schedule: {error}
      </p>
    );
  }

  const byDue = [...(data ?? [])].sort(
    (a, b) => a.days_until_due - b.days_until_due || a.tag.localeCompare(b.tag),
  );

  return (
    <>
      <header className="page-head">
        <h1>Inspection schedule</h1>
        <p className="lede">Inspections due in the next 90 days, soonest first.</p>
      </header>
      {data &&
        GROUPS.map((g) => {
          const items = byDue.filter((e) => g.test(e.days_until_due));
          return (
            <section key={g.title} className="panel schedule-group">
              <h2>
                {g.title}
                <span className="group-count">{items.length}</span>
              </h2>
              {items.length === 0 ? <p className="empty">{g.empty}</p> : <ScheduleRows items={items} />}
            </section>
          );
        })}
    </>
  );
}

function ScheduleRows({ items }: { items: Equipment[] }) {
  return (
    <ul className="rows">
      {items.map((e) => (
        <li key={e.id}>
          <Link to={`/equipment/${e.id}`} className="row-link">
            <TagChip tag={e.tag} condition={conditionOf(e)} />
            <span className="row-main">
              <span className="row-title">{e.name}</span>
              <span className="row-sub">
                {e.location}, {CRITICALITY_LABELS[e.criticality].toLowerCase()} criticality
              </span>
            </span>
            <span className={`due ${e.days_until_due < 0 ? "late" : ""}`}>
              {fmtDate(e.next_inspection_due)}
              <span className="row-sub">{dueLabel(e.days_until_due)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
