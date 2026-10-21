import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "../api";
import { CATEGORY_LABELS, CRITICALITY_LABELS, RESULT_LABELS, SEVERITY_LABELS, todayIso } from "../format";
import type {
  Category,
  Criticality,
  EquipmentDetail,
  Failure,
  InspectionResult,
  Severity,
} from "../types";

/** Shared submit handling: busy state, API errors shown inline. */
function useSubmit<T>(action: () => Promise<T>, onDone: (result: T) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(await action());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

function Actions({ busy, error, label, onCancel }: {
  busy: boolean;
  error: string | null;
  label: string;
  onCancel: () => void;
}) {
  return (
    <>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button" disabled={busy}>
          {busy ? "Saving…" : label}
        </button>
      </div>
    </>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

// ---------- Add equipment ----------
export function EquipmentForm({
  locations,
  onSaved,
  onCancel,
}: {
  locations: string[];
  onSaved: (created: EquipmentDetail) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState({
    tag: "",
    name: "",
    category: "pump" as Category,
    location: locations[0] ?? "",
    criticality: "medium" as Criticality,
    interval: "90",
    installed_on: todayIso(),
    notes: "",
  });
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((prev) => ({ ...prev, [key]: e.target.value }));

  const { busy, error, submit } = useSubmit(
    () =>
      api.create({
        tag: v.tag.trim().toUpperCase(),
        name: v.name.trim(),
        category: v.category,
        location: v.location.trim(),
        criticality: v.criticality,
        inspection_interval_days: Number(v.interval),
        installed_on: v.installed_on,
        notes: v.notes,
      }),
    onSaved,
  );

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Tag number">
        <input required maxLength={30} placeholder="P-101A" value={v.tag} onChange={set("tag")} />
      </Field>
      <Field label="Name">
        <input required maxLength={120} placeholder="Crude transfer pump A" value={v.name} onChange={set("name")} />
      </Field>
      <Field label="Type">
        <select value={v.category} onChange={set("category")}>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Criticality">
        <select value={v.criticality} onChange={set("criticality")}>
          {Object.entries(CRITICALITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Location" wide>
        <input required maxLength={120} list="locations" value={v.location} onChange={set("location")} />
        <datalist id="locations">
          {locations.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <Field label="Inspect every (days)">
        <input type="number" required min={1} max={3650} value={v.interval} onChange={set("interval")} />
      </Field>
      <Field label="Installed on">
        <input type="date" required max={todayIso()} value={v.installed_on} onChange={set("installed_on")} />
      </Field>
      <Field label="Notes (optional)" wide>
        <textarea rows={2} value={v.notes} onChange={set("notes")} />
      </Field>
      <Actions busy={busy} error={error} label="Add equipment" onCancel={onCancel} />
    </form>
  );
}

// ---------- Log inspection ----------
export function InspectionForm({
  equipmentId,
  onSaved,
  onCancel,
}: {
  equipmentId: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState({ date: todayIso(), inspector: "", result: "pass" as InspectionResult, notes: "" });
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((prev) => ({ ...prev, [key]: e.target.value }));
  const { busy, error, submit } = useSubmit(() => api.logInspection(equipmentId, v), onSaved);

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Date">
        <input type="date" required max={todayIso()} value={v.date} onChange={set("date")} />
      </Field>
      <Field label="Inspector">
        <input required maxLength={80} value={v.inspector} onChange={set("inspector")} />
      </Field>
      <fieldset className="field wide choices">
        <legend>Result</legend>
        {(Object.keys(RESULT_LABELS) as InspectionResult[]).map((r) => (
          <label key={r} className={`choice result-${r}`}>
            <input type="radio" name="result" value={r} checked={v.result === r} onChange={set("result")} />
            {RESULT_LABELS[r]}
          </label>
        ))}
      </fieldset>
      {v.result === "fail" && (
        <p className="field wide hint">A failed inspection takes the equipment out of service.</p>
      )}
      <Field label={v.result === "pass" ? "Notes (optional)" : "Findings"} wide>
        <textarea rows={3} required={v.result !== "pass"} value={v.notes} onChange={set("notes")} />
      </Field>
      <Actions busy={busy} error={error} label="Log inspection" onCancel={onCancel} />
    </form>
  );
}

// ---------- Report failure ----------
export function FailureForm({
  equipmentId,
  onSaved,
  onCancel,
}: {
  equipmentId: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState({ reported_on: todayIso(), description: "", severity: "minor" as Severity });
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((prev) => ({ ...prev, [key]: e.target.value }));
  const { busy, error, submit } = useSubmit(() => api.reportFailure(equipmentId, v), onSaved);

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Reported on">
        <input type="date" required max={todayIso()} value={v.reported_on} onChange={set("reported_on")} />
      </Field>
      <Field label="Severity">
        <select value={v.severity} onChange={set("severity")}>
          {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {v.severity === "critical" && (
        <p className="field wide hint">A critical failure takes the equipment out of service.</p>
      )}
      <Field label="What happened" wide>
        <textarea rows={3} required maxLength={2000} value={v.description} onChange={set("description")} />
      </Field>
      <Actions busy={busy} error={error} label="Report failure" onCancel={onCancel} />
    </form>
  );
}

// ---------- Resolve failure ----------
export function ResolveForm({
  failure,
  onSaved,
  onCancel,
}: {
  failure: Failure;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState({ resolved_on: todayIso(), downtime_hours: "", resolution: "", return_to_service: true });
  const set = (key: "resolved_on" | "downtime_hours" | "resolution") => (e: { target: { value: string } }) =>
    setV((prev) => ({ ...prev, [key]: e.target.value }));
  const { busy, error, submit } = useSubmit(
    () => api.resolveFailure(failure.id, { ...v, downtime_hours: Number(v.downtime_hours) }),
    onSaved,
  );

  return (
    <form className="form" onSubmit={submit}>
      <p className="field wide resolving">{failure.description}</p>
      <Field label="Repaired on">
        <input
          type="date"
          required
          min={failure.reported_on}
          max={todayIso()}
          value={v.resolved_on}
          onChange={set("resolved_on")}
        />
      </Field>
      <Field label="Downtime (hours)">
        <input type="number" required min={0} step="0.5" value={v.downtime_hours} onChange={set("downtime_hours")} />
      </Field>
      <Field label="Repair carried out" wide>
        <textarea rows={3} required maxLength={2000} value={v.resolution} onChange={set("resolution")} />
      </Field>
      <label className="field wide checkbox">
        <input
          type="checkbox"
          checked={v.return_to_service}
          onChange={(e) => setV((prev) => ({ ...prev, return_to_service: e.target.checked }))}
        />
        Return to service if no other failures are open
      </label>
      <Actions busy={busy} error={error} label="Close failure" onCancel={onCancel} />
    </form>
  );
}
