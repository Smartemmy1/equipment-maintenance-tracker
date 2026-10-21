"""Endpoints for equipment, its inspections and its failures."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.config import Settings, get_settings
from app.database import get_db, get_today
from app.models import (
    Category,
    Equipment,
    EquipmentStatus,
    Failure,
    Inspection,
    InspectionResult,
    Severity,
)
from app.schemas import (
    EquipmentCreate,
    EquipmentDetail,
    EquipmentOut,
    EquipmentUpdate,
    FailureIn,
    FailureOut,
    InspectionIn,
    InspectionOut,
    InspectionState,
)
from app.services import maintenance

router = APIRouter(prefix="/api/equipment", tags=["equipment"])


def get_equipment_or_404(db: Session, equipment_id: int) -> Equipment:
    eq = db.get(Equipment, equipment_id)
    if eq is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Equipment {equipment_id} not found")
    return eq


def check_not_future(day: date, today: date, what: str) -> None:
    if day > today:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"{what} cannot be in the future"
        )


@router.get("", response_model=list[EquipmentOut])
def list_equipment(
    q: str | None = None,
    category: Category | None = None,
    location: str | None = None,
    equipment_status: EquipmentStatus | None = None,
    inspection: InspectionState | None = None,
    db: Session = Depends(get_db),
    today: date = Depends(get_today),
    settings: Settings = Depends(get_settings),
):
    """List equipment with its inspection schedule.

    Filter by free-text search on tag or name (`q`), `category`, `location`,
    `equipment_status`, or `inspection` state (overdue, due_soon, ok).
    """
    query = (
        select(Equipment)
        .options(selectinload(Equipment.inspections), selectinload(Equipment.failures))
        .order_by(Equipment.tag)
    )
    if q:
        pattern = f"%{q.strip()}%"
        query = query.where(or_(Equipment.tag.ilike(pattern), Equipment.name.ilike(pattern)))
    if category:
        query = query.where(Equipment.category == category)
    if location:
        query = query.where(Equipment.location == location)
    if equipment_status:
        query = query.where(Equipment.status == equipment_status)

    items = [maintenance.summarize(eq, today, settings.due_soon_days) for eq in db.scalars(query)]
    # Inspection state is computed, not stored, so it is filtered after the query.
    if inspection:
        items = [e for e in items if e.inspection_state == inspection]
    return items


@router.get("/locations", response_model=list[str])
def list_locations(db: Session = Depends(get_db)):
    return list(db.scalars(select(Equipment.location).distinct().order_by(Equipment.location)))


@router.post("", response_model=EquipmentDetail, status_code=status.HTTP_201_CREATED)
def create_equipment(
    payload: EquipmentCreate,
    db: Session = Depends(get_db),
    today: date = Depends(get_today),
    settings: Settings = Depends(get_settings),
):
    check_not_future(payload.installed_on, today, "Installation date")
    eq = Equipment(**payload.model_dump())
    db.add(eq)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Tag '{payload.tag}' is already in use"
        ) from None
    db.refresh(eq)
    return maintenance.detail(eq, today, settings.due_soon_days)


@router.get("/{equipment_id}", response_model=EquipmentDetail)
def get_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    today: date = Depends(get_today),
    settings: Settings = Depends(get_settings),
):
    """One item with its schedule and reliability metrics (MTBF, MTTR, availability)."""
    return maintenance.detail(get_equipment_or_404(db, equipment_id), today, settings.due_soon_days)


@router.patch("/{equipment_id}", response_model=EquipmentDetail)
def update_equipment(
    equipment_id: int,
    payload: EquipmentUpdate,
    db: Session = Depends(get_db),
    today: date = Depends(get_today),
    settings: Settings = Depends(get_settings),
):
    eq = get_equipment_or_404(db, equipment_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(eq, key, value)
    db.commit()
    db.refresh(eq)
    return maintenance.detail(eq, today, settings.due_soon_days)


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(equipment_id: int, db: Session = Depends(get_db)):
    db.delete(get_equipment_or_404(db, equipment_id))
    db.commit()


# ---------- Inspections ----------
@router.get("/{equipment_id}/inspections", response_model=list[InspectionOut])
def list_inspections(equipment_id: int, db: Session = Depends(get_db)):
    """Inspection history, newest first."""
    get_equipment_or_404(db, equipment_id)
    return db.scalars(
        select(Inspection)
        .where(Inspection.equipment_id == equipment_id)
        .order_by(Inspection.date.desc(), Inspection.id.desc())
    ).all()


@router.post(
    "/{equipment_id}/inspections",
    response_model=InspectionOut,
    status_code=status.HTTP_201_CREATED,
)
def log_inspection(
    equipment_id: int,
    payload: InspectionIn,
    db: Session = Depends(get_db),
    today: date = Depends(get_today),
):
    """Record an inspection. A failed inspection takes the equipment out of service."""
    eq = get_equipment_or_404(db, equipment_id)
    check_not_future(payload.date, today, "Inspection date")
    if payload.date < eq.installed_on:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Inspection date is before installation"
        )
    inspection = Inspection(equipment_id=eq.id, **payload.model_dump())
    db.add(inspection)
    if payload.result == InspectionResult.failed:
        eq.status = EquipmentStatus.out_of_service
    db.commit()
    db.refresh(inspection)
    return inspection


# ---------- Failures ----------
@router.get("/{equipment_id}/failures", response_model=list[FailureOut])
def list_failures(equipment_id: int, db: Session = Depends(get_db)):
    """Failure history, newest first."""
    get_equipment_or_404(db, equipment_id)
    return db.scalars(
        select(Failure)
        .where(Failure.equipment_id == equipment_id)
        .order_by(Failure.reported_on.desc(), Failure.id.desc())
    ).all()


@router.post(
    "/{equipment_id}/failures", response_model=FailureOut, status_code=status.HTTP_201_CREATED
)
def report_failure(
    equipment_id: int,
    payload: FailureIn,
    db: Session = Depends(get_db),
    today: date = Depends(get_today),
):
    """Report a failure. A critical failure takes the equipment out of service."""
    eq = get_equipment_or_404(db, equipment_id)
    check_not_future(payload.reported_on, today, "Report date")
    failure = Failure(equipment_id=eq.id, **payload.model_dump())
    db.add(failure)
    if payload.severity == Severity.critical:
        eq.status = EquipmentStatus.out_of_service
    db.commit()
    db.refresh(failure)
    return failure
