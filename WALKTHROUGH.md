# Walkthrough: how this project works

Notes for explaining the project in an interview. Read this alongside the code.

## The problem

On an oil and gas facility every pump, compressor, separator and safety valve has to be inspected on a fixed interval, and when something breaks the team needs to know what is down, for how long, and which equipment keeps failing. This app is the register and the schedule in one place.

## Architecture

```
Browser (React + TypeScript, React Router)
   │  fetch /api/...
   ▼
nginx (serves the built app, forwards /api)          ← Docker only; Vite does this in dev
   │
   ▼
FastAPI routers  →  services/maintenance.py  →  SQLAlchemy models
   │
   ▼
PostgreSQL (Docker) or SQLite (local dev and tests)
```

## Data model

```
Equipment 1 ──< Inspection   (date, inspector, result, notes)
          1 ──< Failure      (reported_on, severity, resolved_on, downtime_hours)
```

Note what is **not** stored: the next due date and the "overdue" flag. They are calculated from the last inspection and the interval each time. Storing them would mean they go stale every midnight and must be kept in sync whenever an inspection is logged or the interval changes. The trade-off is that filtering by inspection state happens in Python after the query; for thousands of items you would move that calculation into SQL.

## A request, end to end

Logging a failed inspection on K-302:

1. `InspectionForm` posts `{date, inspector, result: "fail", notes}` to `/api/equipment/5/inspections`.
2. Pydantic validates the body (required fields, valid result value).
3. The router checks the business rules: equipment exists (404 otherwise), date is not in the future and not before installation (422).
4. It saves the inspection and, because the result is a fail, sets the equipment's status to `out_of_service` in the same transaction.
5. The page reloads the equipment; `maintenance.summarize()` recomputes the due date from the new inspection, and the tag chip turns red.

## Key design decisions (and why)

**"Today" is a dependency.** `get_today()` is injected into every route that depends on the date. Tests replace it with a fixed date, so "overdue" means the same thing whenever the test suite runs. Without this, tests would start failing as the calendar moves.

**Business logic lives in a service module.** `services/maintenance.py` has plain functions (`next_inspection_due`, `inspection_state`, `reliability`) that are unit-tested without HTTP. Routers only translate between HTTP and those functions.

**State changes follow events.** A failed inspection or critical failure takes equipment out of service; closing the last open failure can return it. These are the rules a maintenance team actually works by, and they are listed in the README.

**Validation at two levels.** Pydantic checks shape and ranges (interval 1 to 3650 days, downtime not negative). The routers check rules that need context: dates relative to today or to the report date, and duplicate tags via a database unique constraint turned into a 409.

**Filters in the URL.** The overview's count cards link to `/equipment?inspection=overdue`; the list reads its filters from the URL, so links, refresh and the back button all work.

**Native `<dialog>` for forms.** It gives focus trapping and Escape-to-close for free, which is better accessibility than a hand-built modal.

**Colour never stands alone.** Each tag chip also carries its condition as text for screen readers and as a tooltip, and the condition column spells it out.

## Formulas

- **Next inspection** = last inspection (or installation) + interval
- **MTBF** = days in service ÷ number of failures
- **MTTR** = average downtime hours of repaired failures
- **Availability (12 months)** = 1 − downtime hours ÷ hours in the window, where an open failure counts as down from its report date until today

## Questions you may be asked

- *Why not store the overdue flag?* It is derived from data that changes daily; computing it avoids stale data and sync bugs.
- *How would you scale it?* Compute the next due date in SQL (a window function or a materialised view refreshed nightly), paginate the list, and index `inspections(equipment_id, date)`.
- *How do you test date logic?* By injecting "today" as a dependency and pinning it in tests.
- *What would you add next?* Work orders, user roles, reminders before inspections fall due, Alembic migrations.
