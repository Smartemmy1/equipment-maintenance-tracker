"""API tests through FastAPI's TestClient. "Today" is pinned to 2026-06-15."""

from app.seed import seed
from tests.conftest import TODAY


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_create_equipment_computes_schedule(client, make_equipment):
    eq = make_equipment(installed_on="2026-04-01", inspection_interval_days=90)
    assert eq["status"] == "in_service"
    assert eq["last_inspection"] is None
    assert eq["next_inspection_due"] == "2026-06-30"
    assert eq["days_until_due"] == 15
    assert eq["inspection_state"] == "ok"
    assert eq["metrics"]["availability"] == 1.0


def test_duplicate_tag_conflicts(client, make_equipment):
    make_equipment(tag="P-1")
    res = client.post(
        "/api/equipment",
        json={
            "tag": "P-1",
            "name": "Other",
            "category": "pump",
            "location": "X",
            "inspection_interval_days": 30,
            "installed_on": "2026-01-01",
        },
    )
    assert res.status_code == 409


def test_invalid_interval_rejected(client, make_equipment):
    res = client.post(
        "/api/equipment",
        json={
            "tag": "P-1",
            "name": "X",
            "category": "pump",
            "location": "X",
            "inspection_interval_days": 0,
            "installed_on": "2026-01-01",
        },
    )
    assert res.status_code == 422


def test_unknown_equipment_404(client):
    assert client.get("/api/equipment/999").status_code == 404


def test_logging_inspection_moves_due_date(client, make_equipment):
    eq = make_equipment(installed_on="2026-01-01", inspection_interval_days=90)
    assert eq["inspection_state"] == "overdue"  # due 2026-04-01

    res = client.post(
        f"/api/equipment/{eq['id']}/inspections",
        json={"date": "2026-06-10", "inspector": "J. Walsh", "result": "pass"},
    )
    assert res.status_code == 201
    updated = client.get(f"/api/equipment/{eq['id']}").json()
    assert updated["last_inspection"] == "2026-06-10"
    assert updated["next_inspection_due"] == "2026-09-08"
    assert updated["inspection_state"] == "ok"


def test_failed_inspection_takes_equipment_out_of_service(client, make_equipment):
    eq = make_equipment()
    client.post(
        f"/api/equipment/{eq['id']}/inspections",
        json={"date": "2026-06-10", "inspector": "J. Walsh", "result": "fail"},
    )
    assert client.get(f"/api/equipment/{eq['id']}").json()["status"] == "out_of_service"


def test_future_or_pre_install_inspection_rejected(client, make_equipment):
    eq = make_equipment(installed_on="2026-01-01")
    url = f"/api/equipment/{eq['id']}/inspections"
    future = {"date": "2026-07-01", "inspector": "A", "result": "pass"}
    early = {"date": "2025-12-01", "inspector": "A", "result": "pass"}
    assert client.post(url, json=future).status_code == 422
    assert client.post(url, json=early).status_code == 422


def test_failure_lifecycle(client, make_equipment):
    eq = make_equipment()
    res = client.post(
        f"/api/equipment/{eq['id']}/failures",
        json={"reported_on": "2026-06-12", "description": "Seal leak", "severity": "critical"},
    )
    failure = res.json()
    assert res.status_code == 201
    assert failure["resolved_on"] is None

    detail = client.get(f"/api/equipment/{eq['id']}").json()
    assert detail["status"] == "out_of_service"
    assert detail["open_failures"] == 1

    resolve = {"resolved_on": "2026-06-14", "downtime_hours": 40, "resolution": "Seal replaced"}
    res = client.post(f"/api/failures/{failure['id']}/resolve", json=resolve)
    assert res.status_code == 200
    assert res.json()["downtime_hours"] == 40

    detail = client.get(f"/api/equipment/{eq['id']}").json()
    assert detail["status"] == "in_service"
    assert detail["open_failures"] == 0
    assert detail["metrics"]["mttr_hours"] == 40

    # Resolving twice is an error
    assert client.post(f"/api/failures/{failure['id']}/resolve", json=resolve).status_code == 409


def test_stays_out_of_service_while_other_failures_open(client, make_equipment):
    eq = make_equipment()
    url = f"/api/equipment/{eq['id']}/failures"
    first = client.post(
        url, json={"reported_on": "2026-06-10", "description": "A", "severity": "critical"}
    ).json()
    client.post(url, json={"reported_on": "2026-06-11", "description": "B", "severity": "minor"})
    client.post(
        f"/api/failures/{first['id']}/resolve",
        json={"resolved_on": "2026-06-12", "downtime_hours": 5, "resolution": "Fixed"},
    )
    assert client.get(f"/api/equipment/{eq['id']}").json()["status"] == "out_of_service"


def test_resolution_date_must_follow_report(client, make_equipment):
    eq = make_equipment()
    failure = client.post(
        f"/api/equipment/{eq['id']}/failures",
        json={"reported_on": "2026-06-12", "description": "A", "severity": "minor"},
    ).json()
    bad = {"resolved_on": "2026-06-11", "downtime_hours": 1, "resolution": "x"}
    assert client.post(f"/api/failures/{failure['id']}/resolve", json=bad).status_code == 422


def test_filters(client, make_equipment):
    make_equipment(tag="P-1", name="Feed pump", installed_on="2026-01-01")  # overdue
    make_equipment(tag="K-1", name="Compressor", category="compressor", installed_on="2026-05-01")
    make_equipment(tag="V-1", name="Separator", category="separator", location="Other site")

    def tags(**params):
        return [e["tag"] for e in client.get("/api/equipment", params=params).json()]

    assert tags() == ["K-1", "P-1", "V-1"]
    assert tags(q="feed") == ["P-1"]
    assert tags(category="compressor") == ["K-1"]
    assert tags(location="Other site") == ["V-1"]
    assert tags(inspection="ok") == ["K-1"]
    assert client.get("/api/equipment/locations").json() == ["Other site", "Test plant"]


def test_patch_and_delete(client, make_equipment):
    eq = make_equipment()
    res = client.patch(f"/api/equipment/{eq['id']}", json={"inspection_interval_days": 30})
    assert res.json()["inspection_interval_days"] == 30
    assert client.delete(f"/api/equipment/{eq['id']}").status_code == 204
    assert client.get(f"/api/equipment/{eq['id']}").status_code == 404


def test_history_endpoints_newest_first(client, make_equipment):
    eq = make_equipment()
    for day in ["2026-03-01", "2026-05-01"]:
        client.post(
            f"/api/equipment/{eq['id']}/inspections",
            json={"date": day, "inspector": "A", "result": "pass"},
        )
    dates = [i["date"] for i in client.get(f"/api/equipment/{eq['id']}/inspections").json()]
    assert dates == ["2026-05-01", "2026-03-01"]
    assert client.get(f"/api/equipment/{eq['id']}/failures").json() == []


def test_dashboard_on_demo_data(client, db):
    seed(db, today=TODAY)
    d = client.get("/api/dashboard").json()
    assert d["today"] == TODAY.isoformat()
    assert d["total"] == 18
    assert d["out_of_service"] == 1  # K-301, critical failure
    assert d["open_failures"] == 3
    assert d["overdue"] >= 3  # K-302, T-602, XV-1001 are set up overdue
    assert [f["equipment_tag"] for f in d["failures"]][0] == "G-650"  # newest first
    # Upcoming list is sorted by days until due, overdue first
    days = [e["days_until_due"] for e in d["upcoming"]]
    assert days == sorted(days)
    assert all(day <= 30 for day in days)
    assert d["downtime_by_category"]
