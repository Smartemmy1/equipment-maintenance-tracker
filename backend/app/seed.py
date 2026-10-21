"""Generate a realistic demo dataset: 18 pieces of equipment at two fictional
facilities, with two years of inspection and failure history.

A few items are set up to be overdue, due soon or broken down so the
dashboard has something to show. Run directly to reset the database:

    python -m app.seed
"""

import random
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Category,
    Criticality,
    Equipment,
    EquipmentStatus,
    Failure,
    Inspection,
    InspectionResult,
    Severity,
)

HISTORY_DAYS = 730
PLATFORM = "Avalon Ridge Platform"
TERMINAL = "Placentia Terminal"
INSPECTORS = ["J. Walsh", "M. Okafor", "S. Pike", "R. Byrne", "A. Singh"]

FAILURE_TEXT = {
    Category.pump: ["Mechanical seal leak", "High bearing vibration", "Coupling wear"],
    Category.compressor: ["Dry gas seal leak", "Surge trip", "Lube oil pressure low"],
    Category.separator: ["Level transmitter fault", "Demister fouling", "Gasket weep at manway"],
    Category.heat_exchanger: ["Tube fouling, high outlet temperature", "Tube leak"],
    Category.valve: ["Failed partial stroke test", "Actuator air leak", "Seat leakage"],
    Category.generator: ["Failed to start on test", "Governor fault", "Coolant leak"],
    Category.tank: ["Roof seal damage", "Level gauge stuck", "Coating breakdown on floor"],
}
FINDINGS = {
    Category.pump: "Minor seal weep, monitor",
    Category.compressor: "Vibration slightly elevated, trend",
    Category.separator: "Light corrosion on nozzle, schedule repaint",
    Category.heat_exchanger: "Fouling trend rising, plan cleaning",
    Category.valve: "Stroke time near limit",
    Category.generator: "Battery charger alarm cleared",
    Category.tank: "Minor coating damage at shell",
}


@dataclass
class Plan:
    tag: str
    name: str
    category: Category
    location: str
    criticality: Criticality
    interval: int
    days_since_last: int  # days since the most recent inspection: sets the schedule state
    open_failure: tuple[Severity, str] | None = None
    open_failure_days_ago: int = 3


PLANS = [
    Plan("P-101A", "Crude transfer pump A", Category.pump, PLATFORM, Criticality.high, 90, 40),
    Plan("P-101B", "Crude transfer pump B", Category.pump, PLATFORM, Criticality.high, 90, 81),
    Plan(
        "P-205",
        "Produced water injection pump",
        Category.pump,
        PLATFORM,
        Criticality.medium,
        90,
        60,
        open_failure=(Severity.minor, "Mechanical seal leak"),
        open_failure_days_ago=6,
    ),
    Plan(
        "K-301",
        "Gas export compressor",
        Category.compressor,
        PLATFORM,
        Criticality.high,
        60,
        20,
        open_failure=(Severity.critical, "Dry gas seal leak, unit tripped"),
    ),
    Plan(
        "K-302",
        "Fuel gas booster compressor",
        Category.compressor,
        PLATFORM,
        Criticality.medium,
        90,
        104,
    ),
    Plan(
        "V-110", "HP production separator", Category.separator, PLATFORM, Criticality.high, 180, 120
    ),
    Plan("V-120", "LP test separator", Category.separator, PLATFORM, Criticality.medium, 180, 171),
    Plan("E-401", "Crude cooler", Category.heat_exchanger, PLATFORM, Criticality.medium, 180, 30),
    Plan("G-501", "Main power generator A", Category.generator, PLATFORM, Criticality.high, 30, 12),
    Plan("XV-1001", "Wellhead shutdown valve", Category.valve, PLATFORM, Criticality.high, 30, 37),
    Plan("T-601", "Crude storage tank 1", Category.tank, TERMINAL, Criticality.medium, 365, 200),
    Plan("T-602", "Crude storage tank 2", Category.tank, TERMINAL, Criticality.medium, 365, 390),
    Plan("P-610", "Tanker loading pump", Category.pump, TERMINAL, Criticality.high, 90, 85),
    Plan(
        "E-620",
        "Heating medium exchanger",
        Category.heat_exchanger,
        TERMINAL,
        Criticality.low,
        180,
        90,
    ),
    Plan(
        "G-650",
        "Emergency diesel generator",
        Category.generator,
        TERMINAL,
        Criticality.high,
        30,
        25,
        open_failure=(Severity.major, "Failed to start on test"),
        open_failure_days_ago=2,
    ),
    Plan("PSV-660", "Tank relief valve", Category.valve, TERMINAL, Criticality.high, 180, 60),
    Plan(
        "K-670",
        "Vapour recovery compressor",
        Category.compressor,
        TERMINAL,
        Criticality.medium,
        90,
        15,
    ),
    Plan("V-680", "Slop oil separator", Category.separator, TERMINAL, Criticality.low, 365, 100),
]


def build(plan: Plan, today: date, rng: random.Random) -> Equipment:
    installed = today - timedelta(days=rng.randint(3 * 365, 6 * 365))
    eq = Equipment(
        tag=plan.tag,
        name=plan.name,
        category=plan.category,
        location=plan.location,
        criticality=plan.criticality,
        inspection_interval_days=plan.interval,
        installed_on=installed,
    )
    history_start = today - timedelta(days=HISTORY_DAYS)

    # Inspections, walking back from the most recent one
    day = today - timedelta(days=plan.days_since_last)
    while day >= history_start:
        roll = rng.random()
        if not eq.inspections:
            roll = min(roll, 0.9)  # the latest inspection passed, matching an in-service status
        if roll < 0.80:
            result, notes = InspectionResult.passed, ""
        elif roll < 0.97:
            result, notes = InspectionResult.findings, FINDINGS[plan.category]
        else:
            result, notes = InspectionResult.failed, "Failed; raised work order"
        eq.inspections.append(
            Inspection(date=day, inspector=rng.choice(INSPECTORS), result=result, notes=notes)
        )
        # Real inspections drift a few days either side of the interval
        day -= timedelta(days=plan.interval + rng.randint(-5, 5))

    # Past failures, all repaired
    for _ in range(rng.randint(0, 4)):
        reported = today - timedelta(days=rng.randint(30, HISTORY_DAYS))
        hours = round(rng.uniform(3, 96), 1)
        eq.failures.append(
            Failure(
                reported_on=reported,
                description=rng.choice(FAILURE_TEXT[plan.category]),
                severity=rng.choice([Severity.minor, Severity.minor, Severity.major]),
                resolved_on=reported + timedelta(days=max(1, round(hours / 24))),
                downtime_hours=hours,
                resolution="Repaired and tested",
            )
        )

    if plan.open_failure:
        severity, text = plan.open_failure
        eq.failures.append(
            Failure(
                reported_on=today - timedelta(days=plan.open_failure_days_ago),
                description=text,
                severity=severity,
            )
        )
        if severity == Severity.critical:
            eq.status = EquipmentStatus.out_of_service
    return eq


def seed(db: Session, today: date | None = None, rng_seed: int = 7) -> int:
    """Insert the demo dataset. Returns the number of equipment items created."""
    today = today or date.today()
    rng = random.Random(rng_seed)
    for plan in PLANS:
        db.add(build(plan, today, rng))
    db.commit()
    return len(PLANS)


def seed_if_empty(db: Session) -> bool:
    if db.scalar(select(Equipment.id).limit(1)) is not None:
        return False
    seed(db)
    return True


if __name__ == "__main__":
    from app.database import Base, SessionLocal, engine

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        print(f"Seeded {seed(session)} equipment items with {HISTORY_DAYS} days of history.")
