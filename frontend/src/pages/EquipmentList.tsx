import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Dialog } from "../components/Dialog";
import { EquipmentForm } from "../components/Forms";
import { ConditionLabel, conditionOf, TagChip } from "../components/TagChip";
import { CATEGORY_LABELS, CRITICALITY_LABELS, dueLabel, fmtDate } from "../format";
import type { EquipmentFilters } from "../types";
import { useApi } from "../useApi";

const VIEWS = [
  { label: "All", params: {} },
  { label: "Overdue", params: { inspection: "overdue" } },
  { label: "Due soon", params: { inspection: "due_soon" } },
  { label: "Out of service", params: { equipment_status: "out_of_service" } },
];

export function EquipmentList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);

  // Filters live in the URL, so links from the overview open a filtered list.
  const filters: EquipmentFilters = {
    q: params.get("q") ?? undefined,
    category: params.get("category") ?? undefined,
    location: params.get("location") ?? undefined,
    inspection: params.get("inspection") ?? undefined,
    equipment_status: params.get("equipment_status") ?? undefined,
  };

  // Debounce typing in the search box so each keystroke doesn't hit the API.
  const [search, setSearch] = useState(filters.q ?? "");
  useEffect(() => {
    const t = setTimeout(() => update({ q: search || undefined }), 250);
    return () => clearTimeout(t);
  }, [search]);

  const list = useApi(() => api.equipment(filters), [params.toString()]);
  const locations = useApi(() => api.locations(), []);

  function update(changes: Partial<EquipmentFilters>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }

  const activeView = VIEWS.findIndex(
    (v) =>
      (v.params as EquipmentFilters).inspection === filters.inspection &&
      (v.params as EquipmentFilters).equipment_status === filters.equipment_status,
  );

  return (
    <>
      <header className="page-head with-action">
        <div>
          <h1>Equipment</h1>
          <p className="lede">Every tagged item, its condition and when it is next due for inspection.</p>
        </div>
        <button type="button" className="button" onClick={() => setAdding(true)}>
          Add equipment
        </button>
      </header>

      <div className="toolbar">
        <div className="segmented" role="radiogroup" aria-label="Show">
          {VIEWS.map((v, i) => (
            <button
              key={v.label}
              type="button"
              role="radio"
              aria-checked={activeView === i}
              onClick={() => update({ inspection: undefined, equipment_status: undefined, ...v.params })}
            >
              {v.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search tag or name"
          aria-label="Search tag or name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Type"
          value={filters.category ?? ""}
          onChange={(e) => update({ category: e.target.value })}
        >
          <option value="">All types</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Location"
          value={filters.location ?? ""}
          onChange={(e) => update({ location: e.target.value })}
        >
          <option value="">All locations</option>
          {locations.data?.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {list.error && (
        <p className="banner-error" role="alert">
          Could not load equipment: {list.error}
        </p>
      )}

      <section className="panel flush">
        {list.data && list.data.length === 0 ? (
          <p className="empty padded">No equipment matches these filters.</p>
        ) : (
          <div className="table-scroll">
            <table className="equipment">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Equipment</th>
                  <th>Criticality</th>
                  <th>Condition</th>
                  <th>Last inspected</th>
                  <th>Next inspection</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map((e) => {
                  const condition = conditionOf(e);
                  return (
                    <tr key={e.id}>
                      <td>
                        <Link to={`/equipment/${e.id}`} className="tag-link">
                          <TagChip tag={e.tag} condition={condition} />
                        </Link>
                      </td>
                      <td>
                        <Link to={`/equipment/${e.id}`} className="name-link">
                          {e.name}
                        </Link>
                        <div className="sub">
                          {CATEGORY_LABELS[e.category]}, {e.location}
                        </div>
                      </td>
                      <td>
                        <span className={`crit ${e.criticality}`}>{CRITICALITY_LABELS[e.criticality]}</span>
                      </td>
                      <td>
                        <ConditionLabel condition={condition} />
                        {e.open_failures > 0 && (
                          <div className="sub">
                            {e.open_failures} open {e.open_failures === 1 ? "failure" : "failures"}
                          </div>
                        )}
                      </td>
                      <td>{fmtDate(e.last_inspection)}</td>
                      <td>
                        {fmtDate(e.next_inspection_due)}
                        <div className={`sub ${e.days_until_due < 0 ? "late" : ""}`}>
                          {dueLabel(e.days_until_due)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={adding} title="Add equipment" onClose={() => setAdding(false)}>
        <EquipmentForm
          locations={locations.data ?? []}
          onCancel={() => setAdding(false)}
          onSaved={(created) => navigate(`/equipment/${created.id}`)}
        />
      </Dialog>
    </>
  );
}
