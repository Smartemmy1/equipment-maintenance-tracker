import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { DowntimeChart } from "../components/DowntimeChart";
import { conditionOf, TagChip } from "../components/TagChip";
import { dueLabel, fmtDate, fmtLongDate, SEVERITY_LABELS } from "../format";
import { useApi } from "../useApi";

export function Overview() {
  const { data, error } = useApi(() => api.dashboard(), []);

  if (error) {
    return (
      <p className="banner-error" role="alert">
        Could not load the overview: {error}. Check that the API is running on port 8000.
      </p>
    );
  }
  if (!data) return <div aria-busy="true" />;

  const counts = [
    { label: "Inspections overdue", value: data.overdue, to: "/equipment?inspection=overdue", tone: "overdue" },
    { label: "Due in the next 14 days", value: data.due_soon, to: "/equipment?inspection=due_soon", tone: "due_soon" },
    { label: "Out of service", value: data.out_of_service, to: "/equipment?equipment_status=out_of_service", tone: "out" },
    { label: "Open failures", value: data.open_failures, to: "#failures", tone: "neutral" },
  ];

  return (
    <>
      <header className="page-head">
        <h1>{fmtLongDate(data.today)}</h1>
        <p className="lede">
          {data.total} items across the plant.{" "}
          {data.overdue + data.out_of_service === 0
            ? "Nothing needs action today."
            : "Start with the overdue inspections and open failures below."}
        </p>
      </header>

      <ul className="counts">
        {counts.map((c) => (
          <li key={c.label}>
            <CountLink to={c.to} className={`count-card tone-${c.value > 0 ? c.tone : "clear"}`}>
              <span className="count-value">{c.value}</span>
              <span className="count-label">{c.label}</span>
            </CountLink>
          </li>
        ))}
      </ul>

      <div className="two-col">
        <section className="panel">
          <h2>Inspections due in 30 days</h2>
          {data.upcoming.length === 0 ? (
            <p className="empty">No inspections due in the next 30 days.</p>
          ) : (
            <ul className="rows">
              {data.upcoming.map((e) => (
                <li key={e.id}>
                  <Link to={`/equipment/${e.id}`} className="row-link">
                    <TagChip tag={e.tag} condition={conditionOf(e)} />
                    <span className="row-main">
                      <span className="row-title">{e.name}</span>
                      <span className="row-sub">{e.location}</span>
                    </span>
                    <span className={`due ${e.days_until_due < 0 ? "late" : ""}`}>
                      {dueLabel(e.days_until_due)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" id="failures">
          <h2>Open failures</h2>
          {data.failures.length === 0 ? (
            <p className="empty">No open failures. Report one from an equipment page.</p>
          ) : (
            <ul className="rows">
              {data.failures.map((f) => (
                <li key={f.id}>
                  <Link to={`/equipment/${f.equipment_id}`} className="row-link">
                    <span className={`severity ${f.severity}`}>{SEVERITY_LABELS[f.severity]}</span>
                    <span className="row-main">
                      <span className="row-title">{f.description}</span>
                      <span className="row-sub">
                        {f.equipment_tag} {f.equipment_name}, reported {fmtDate(f.reported_on)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>Failure downtime by equipment type, last 12 months (hours)</h2>
        <DowntimeChart data={data.downtime_by_category} />
      </section>
    </>
  );
}

/** In-page anchors (#failures) are plain links; everything else is a router link. */
function CountLink({ to, className, children }: { to: string; className: string; children: ReactNode }) {
  return to.startsWith("#") ? (
    <a href={to} className={className}>
      {children}
    </a>
  ) : (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}
