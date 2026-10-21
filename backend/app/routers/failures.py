"""Closing out failures once the repair is done."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db, get_today
from app.models import EquipmentStatus, Failure
from app.schemas import FailureOut, FailureResolve

router = APIRouter(prefix="/api/failures", tags=["failures"])


@router.post("/{failure_id}/resolve", response_model=FailureOut)
def resolve_failure(
    failure_id: int,
    payload: FailureResolve,
    db: Session = Depends(get_db),
    today: date = Depends(get_today),
):
    """Mark a failure as repaired and record the downtime.

    With `return_to_service` (the default), the equipment goes back in service
    once it has no other open failures.
    """
    failure = db.get(Failure, failure_id)
    if failure is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Failure {failure_id} not found")
    if failure.resolved_on is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This failure is already resolved")
    if not failure.reported_on <= payload.resolved_on <= today:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Resolution date must be between the report date and today",
        )

    failure.resolved_on = payload.resolved_on
    failure.downtime_hours = payload.downtime_hours
    failure.resolution = payload.resolution

    eq = failure.equipment
    still_open = any(f.resolved_on is None for f in eq.failures if f.id != failure.id)
    if payload.return_to_service and not still_open:
        eq.status = EquipmentStatus.in_service

    db.commit()
    db.refresh(failure)
    return failure
