import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Dialog } from "../components/Dialog";
import { FailureForm, InspectionForm, ResolveForm } from "../components/Forms";
import { ConditionLabel, conditionOf, TagChip } from "../components/TagChip";
import {
  CATEGORY_LABELS,
  CRITICALITY_LABELS,
  dueLabel,
  fmtDate,
  fmtHours,
  fmtPct,
  RESULT_LABELS,
  SEVERITY_LABELS,
} from "../format";
import type { Failure, Inspection } from "../types";
import { useApi } from "../useApi";

type Entry =
  | { kind: "inspection"; date: string; item: Inspection }
  | { kind: "failure"; date: string; item: Failure };

type Modal = { type: "inspection" } | { type: "failure" } | { type: "resolve"; failure: Failure } | null;

export function EquipmentDetail() {
  const id = Number(useParams().id);
  const [modal, setModal] = useState<Modal>(null);

  const eq = useApi(() => api.get(id), [id]);
  const inspections = useApi(() => api.inspections(id), [id]);
  const failures = useApi(() => api.failures(id), [id]);

  const reload = () => {
    setModal(null);
    eq.reload();
    inspections.reload();
    failures.reload();
  };

  if (eq.error) {
    return (
      <>
        <Link to="/equipment" className="back">
          All equipment
        </Link>
        <p className="banner-error" role="alert">
          {eq.error}
        </p>
      </>
    );
  }
  const e = eq.data;
  if (!e) return <div aria-busy="true" />;

  const condition = conditionOf(e);
  const history: Entry[] = [
    ...(inspections.data ?? []).map((i) => ({ kind: "inspection" as const, date: i.date, item: i })),
    ...(failures.data ?? []).map((f) => ({ kind: "failure" as const, date: f.reported_on, item: f })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  async function toggleService() {
    await api.setStatus(id, e!.status === "in_service" ? "out_of_service" : "in_service");
    reload();
  }

  return (
    <>
      <Link to="/equipment" className="back">
        All equipment
      </Link>

      <header className="detail-head">
        <TagChip tag={e.tag} condition={condition} large />
        <div className="detail-title">
          <h1>{e.name}</h1>
          <p className="lede">
            {CATEGORY_LABELS[e.category]} at {e.location}
          </p>
        </div>
        <div className="detail-actions">
          <button type="button" className="button" onClick={() => setModal({ type: "inspection" })}>
            Log inspection
          </button>
          <button type="button" className="button secondary" onClick={() => setModal({ type: "failure" })}>
            Report failure
          </button>
        </div>
      </header>

      <div className="detail-grid">
        <section className="panel">
          <h2>Condition</h2>
          <dl className="facts">
            <div>
              <dt>Status</dt>
              <dd>
                <ConditionLabel condition={condition} />
              </dd>
            </div>
            <div>
              <dt>Next inspection</dt>
              <dd>
                {fmtDate(e.next_inspection_due)}
                <span className={`sub block ${e.days_until_due < 0 ? "late" : ""}`}>
                  {dueLabel(e.days_until_due)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Last inspected</dt>
              <dd>{fmtDate(e.last_inspection)}</dd>
            </div>
            <div>
              <dt>Inspection interval</dt>
              <dd>Every {e.inspection_interval_days} days</dd>
            </div>
            <div>
              <dt>Criticality</dt>
              <dd>{CRITICALITY_LABELS[e.criticality]}</dd>
            </div>
            <div>
              <dt>Installed</dt>
              <dd>{fmtDate(e.installed_on)}</dd>
            </div>
          </dl>
          {e.notes && <p className="notes">{e.notes}</p>}
          <button type="button" className="text-button" onClick={toggleService}>
            {e.status === "in_service" ? "Take out of service" : "Return to service"}
          </button>
        </section>

        <section className="panel">
          <h2>Reliability</h2>
          <dl className="metrics">
            <div>
              <dt>Availability, last 12 months</dt>
              <dd>{fmtPct(e.metrics.availability)}</dd>
            </div>
            <div>
              <dt>Mean time between failures</dt>
              <dd>{e.metrics.mtbf_days == null ? "No failures" : `${Math.round(e.metrics.mtbf_days)} days`}</dd>
            </div>
            <div>
              <dt>Mean time to repair</dt>
              <dd>{fmtHours(e.metrics.mttr_hours)}</dd>
            </div>
            <div>
              <dt>Failures recorded</dt>
              <dd>{e.metrics.failure_count}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="panel">
        <h2>History</h2>
        {history.length === 0 ? (
          <p className="empty">No inspections or failures yet. Log the first inspection above.</p>
        ) : (
          <ol className="timeline">
            {history.map((entry) =>
              entry.kind === "inspection" ? (
                <li key={`i${entry.item.id}`} className={`event inspection ${entry.item.result}`}>
                  <time dateTime={entry.date}>{fmtDate(entry.date)}</time>
                  <div>
                    <strong>Inspection: {RESULT_LABELS[entry.item.result]}</strong>
                    <span className="sub"> by {entry.item.inspector}</span>
                    {entry.item.notes && <p>{entry.item.notes}</p>}
                  </div>
                </li>
              ) : (
                <li
                  key={`f${entry.item.id}`}
                  className={`event failure ${entry.item.resolved_on ? "closed" : "open"}`}
                >
                  <time dateTime={entry.date}>{fmtDate(entry.date)}</time>
                  <div>
                    <strong>
                      {SEVERITY_LABELS[entry.item.severity]} failure: {entry.item.description}
                    </strong>
                    {entry.item.resolved_on ? (
                      <p>
                        Repaired {fmtDate(entry.item.resolved_on)} after {fmtHours(entry.item.downtime_hours)}{" "}
                        down. {entry.item.resolution}
                      </p>
                    ) : (
                      <p>
                        Open.{" "}
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setModal({ type: "resolve", failure: entry.item })}
                        >
                          Close this failure
                        </button>
                      </p>
                    )}
                  </div>
                </li>
              ),
            )}
          </ol>
        )}
      </section>

      <Dialog open={modal?.type === "inspection"} title={`Log inspection for ${e.tag}`} onClose={() => setModal(null)}>
        <InspectionForm equipmentId={id} onSaved={reload} onCancel={() => setModal(null)} />
      </Dialog>
      <Dialog open={modal?.type === "failure"} title={`Report failure on ${e.tag}`} onClose={() => setModal(null)}>
        <FailureForm equipmentId={id} onSaved={reload} onCancel={() => setModal(null)} />
      </Dialog>
      <Dialog open={modal?.type === "resolve"} title="Close failure" onClose={() => setModal(null)}>
        {modal?.type === "resolve" && (
          <ResolveForm failure={modal.failure} onSaved={reload} onCancel={() => setModal(null)} />
        )}
      </Dialog>
    </>
  );
}
